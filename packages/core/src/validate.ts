import type { BlueprintSpec, PassName, PassResult, Question, Validation, ValidationStatus } from './types.ts';
import { COGNITIVE_LEVELS, DIFFICULTIES, OPTION_KEYS } from './types.ts';
import { flattenSubdomains } from './blueprint.ts';
import { ambiguityWarnings, findDuplicates } from './audit.ts';

export interface SchemaIssue {
  id: string;
  field: string;
  message: string;
}

/** Pass 0 — structural schema validation. */
export function checkSchema(q: Partial<Question>, bp: BlueprintSpec): SchemaIssue[] {
  const id = q.id ?? '(no id)';
  const issues: SchemaIssue[] = [];
  const req = (field: keyof Question, pred: (v: unknown) => boolean, msg: string) => {
    if (!pred((q as Record<string, unknown>)[field])) issues.push({ id, field, message: msg });
  };
  const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  req('id', (v) => typeof v === 'string' && /^FOM-[A-Za-z0-9]+-\d{4}$/.test(v), 'id must match FOM-<code>-NNNN');
  req('domain', (v) => v === 'I' || v === 'II' || v === 'III', 'domain must be I, II or III');
  const subIds = flattenSubdomains(bp).map((s) => s.id);
  req('subdomain', (v) => typeof v === 'string' && subIds.includes(v), `subdomain must be one of ${subIds.join(', ')}`);
  if (q.subdomain && q.domain) {
    const d = flattenSubdomains(bp).find((s) => s.id === q.subdomain)?.domain;
    if (d && d !== q.domain) issues.push({ id, field: 'domain', message: `domain ${q.domain} does not match subdomain ${q.subdomain} (expected ${d})` });
  }
  req('task', nonEmpty, 'task is required');
  req('stem', (v) => nonEmpty(v) && (v as string).length >= 20, 'stem too short');
  if (!q.options || typeof q.options !== 'object') issues.push({ id, field: 'options', message: 'options missing' });
  else {
    for (const k of OPTION_KEYS) if (!nonEmpty(q.options[k])) issues.push({ id, field: `options.${k}`, message: 'option missing or empty' });
    const extra = Object.keys(q.options).filter((k) => !(OPTION_KEYS as readonly string[]).includes(k));
    if (extra.length) issues.push({ id, field: 'options', message: `unexpected option keys ${extra.join(',')}` });
  }
  req('correct', (v) => typeof v === 'string' && (OPTION_KEYS as readonly string[]).includes(v), 'correct must be A-D');
  req('explanation', (v) => nonEmpty(v) && (v as string).length >= 40, 'explanation too short (min 40 chars)');
  if (q.correct && q.distractorExplanations) {
    for (const k of OPTION_KEYS) {
      if (k === q.correct) continue;
      if (!nonEmpty(q.distractorExplanations[k])) issues.push({ id, field: `distractorExplanations.${k}`, message: 'missing distractor explanation' });
    }
  } else if (!q.distractorExplanations) issues.push({ id, field: 'distractorExplanations', message: 'missing' });
  req('learningObjective', nonEmpty, 'learningObjective required');
  req('difficulty', (v) => (DIFFICULTIES as readonly string[]).includes(v as string), 'difficulty invalid');
  req('cognitiveLevel', (v) => (COGNITIVE_LEVELS as readonly string[]).includes(v as string), 'cognitiveLevel invalid');
  req('concepts', (v) => Array.isArray(v) && v.length >= 1 && v.every((c) => typeof c === 'string' && /^[a-z0-9-]+$/.test(c)), 'concepts must be 1+ kebab-case slugs');
  req('references', (v) => Array.isArray(v) && v.length >= 1 && v.every((r) => r && typeof r.source === 'string' && r.source.length > 3), 'references must have 1+ entries with source');
  if (q.distinction) {
    if (!Array.isArray(q.distinction.between) || q.distinction.between.length < 2 || !nonEmpty(q.distinction.key)) {
      issues.push({ id, field: 'distinction', message: 'distinction needs between[2+] and key' });
    }
  }
  return issues;
}

export interface PipelineOptions {
  bp: BlueprintSpec;
  /** Blind-solve results keyed by question id: the independently chosen key and optional concern. */
  blindSolves?: Map<string, { answer: string; confidence?: string; concern?: string; by?: string }>;
  now?: string;
}

export interface PipelineOutcome {
  question: Question;
  issues: string[];
}

function pass(ok: boolean, by: PassResult['by'], now: string, note?: string): PassResult {
  return note ? { ok, by, date: now, note } : { ok, by, date: now };
}

/**
 * Run the automated portion of the validation pipeline over a set of questions.
 * Sets `validation.passes` for schema/uniqueness/distractors/relevance/difficulty/duplication/blindSolve,
 * and recomputes `validation.status`:
 *   - any failed pass → needs_revision
 *   - all automated passes ok AND blindSolve ok → ai_reviewed (unless already human_approved)
 *   - otherwise → draft
 * Passes 1 (factual) and 4 (coherence) require a reader; they are recorded only when a reviewer asserts them
 * (the blind reviewer reports coherence concerns; a concern fails coherence).
 */
export function runPipeline(questions: Question[], opts: PipelineOptions): PipelineOutcome[] {
  const now = opts.now ?? new Date().toISOString();
  const dups = findDuplicates(questions);
  const dupIds = new Map<string, string[]>();
  for (const d of dups) {
    if (d.reason === 'stem') continue; // stem-only similarity is a warning, not a failure
    dupIds.set(d.a, [...(dupIds.get(d.a) ?? []), d.b]);
    dupIds.set(d.b, [...(dupIds.get(d.b) ?? []), d.a]);
  }
  return questions.map((q) => {
    const issues: string[] = [];
    const passes: Partial<Record<PassName, PassResult>> = { ...(q.validation?.passes ?? {}) };

    const schema = checkSchema(q, opts.bp);
    passes.schema = pass(schema.length === 0, 'auto', now, schema.map((s) => `${s.field}: ${s.message}`).join('; ') || undefined);
    issues.push(...schema.map((s) => `schema ${s.field}: ${s.message}`));

    const warns = ambiguityWarnings(q);
    const hard = warns.filter((w) => w.code !== 'absolute-wording' && w.code !== 'option-length-outlier');
    const soft = warns.filter((w) => w.code === 'absolute-wording' || w.code === 'option-length-outlier');
    passes.uniqueness = pass(hard.length === 0, 'auto', now, hard.map((w) => `${w.code}: ${w.detail}`).join('; ') || undefined);
    issues.push(...hard.map((w) => `uniqueness ${w.code}: ${w.detail}`));

    const missingDx = OPTION_KEYS.filter((k) => k !== q.correct && !(q.distractorExplanations?.[k] ?? '').trim());
    passes.distractors = pass(
      missingDx.length === 0 && soft.length === 0,
      'auto',
      now,
      [...missingDx.map((k) => `missing explanation for ${k}`), ...soft.map((w) => `${w.code}: ${w.detail}`)].join('; ') || undefined,
    );
    if (missingDx.length) issues.push(`distractors: missing explanation for ${missingDx.join(',')}`);
    if (soft.length) issues.push(...soft.map((w) => `distractors ${w.code}: ${w.detail}`));

    const subOk = flattenSubdomains(opts.bp).some((s) => s.id === q.subdomain && s.domain === q.domain);
    const taskOk = typeof q.task === 'string' && q.task.startsWith(q.domain);
    passes.relevance = pass(subOk && taskOk, 'auto', now, subOk && taskOk ? undefined : `subdomain/task mismatch (${q.subdomain}, ${q.task})`);
    if (!(subOk && taskOk)) issues.push('relevance: subdomain/task does not map to blueprint');

    const diffOk = (DIFFICULTIES as readonly string[]).includes(q.difficulty) && (COGNITIVE_LEVELS as readonly string[]).includes(q.cognitiveLevel);
    // Calibration sanity: recall must not be advanced; evaluation must not be foundational.
    const calOk = !(q.cognitiveLevel === 'recall' && q.difficulty === 'advanced') && !(q.cognitiveLevel === 'evaluation' && q.difficulty === 'foundational');
    passes.difficulty = pass(diffOk && calOk, 'auto', now, diffOk && calOk ? undefined : 'difficulty/cognitive level inconsistent');
    if (!(diffOk && calOk)) issues.push('difficulty: inconsistent with cognitive level');

    const d = dupIds.get(q.id);
    passes.duplication = pass(!d, 'auto', now, d ? `near-duplicate of ${d.join(', ')}` : undefined);
    if (d) issues.push(`duplication: near-duplicate of ${d.join(', ')}`);

    const bs = opts.blindSolves?.get(q.id);
    if (bs) {
      const agree = bs.answer.toUpperCase() === q.correct;
      passes.blindSolve = pass(agree, 'ai', now, agree ? `independent solver chose ${bs.answer}${bs.confidence ? ` (${bs.confidence})` : ''}` : `independent solver chose ${bs.answer}, key is ${q.correct}${bs.concern ? ` — ${bs.concern}` : ''}`);
      if (!agree) issues.push(`blindSolve: solver chose ${bs.answer} vs key ${q.correct}`);
      // The blind reviewer also reports coherence/factual concerns; a concern fails the coherence pass.
      const hasConcern = !!bs.concern && bs.concern.trim().length > 0;
      passes.coherence = pass(!hasConcern, 'ai', now, hasConcern ? bs.concern : 'no coherence concern raised by independent reviewer');
      passes.factual = pass(agree && !hasConcern, 'ai', now, agree && !hasConcern ? 'independent reviewer agreed with key and raised no concern' : undefined);
      if (hasConcern) issues.push(`coherence: ${bs.concern}`);
    }

    const existing = q.validation?.status;
    let status: ValidationStatus;
    const autoPasses: PassName[] = ['schema', 'uniqueness', 'distractors', 'relevance', 'difficulty', 'duplication'];
    const allAuto = autoPasses.every((p) => passes[p]?.ok);
    const anyFail = Object.values(passes).some((p) => p && !p.ok);
    if (existing === 'rejected') status = 'rejected';
    else if (anyFail) status = 'needs_revision';
    else if (existing === 'human_approved') status = 'human_approved';
    else if (allAuto && passes.blindSolve?.ok) status = 'ai_reviewed';
    else status = 'draft';

    const validation: Validation = { status, passes };
    if (q.validation?.reviewer) validation.reviewer = q.validation.reviewer;
    return { question: { ...q, validation, lastReviewedAt: now, version: q.version ?? 1, createdAt: q.createdAt ?? now }, issues };
  });
}
