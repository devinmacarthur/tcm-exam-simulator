import type { BlueprintSpec, Question, ValidationStatus } from './types.ts';
import { OPTION_KEYS } from './types.ts';
import { flattenSubdomains } from './blueprint.ts';

export interface DuplicateCandidate {
  a: string;
  b: string;
  similarity: number;
  reason: 'stem' | 'options' | 'stem+options';
}

export interface AmbiguityWarning {
  id: string;
  code:
    | 'negative-stem'
    | 'all-none-of-above'
    | 'option-length-outlier'
    | 'stem-leaks-answer'
    | 'duplicate-options'
    | 'absolute-wording'
    | 'option-count';
  detail: string;
}

export interface AuditReport {
  total: number;
  byStatus: Record<string, number>;
  byDomain: Record<string, number>;
  bySubdomain: Record<string, number>;
  byDifficulty: Record<string, number>;
  byCognitiveLevel: Record<string, number>;
  answerKeyBalance: Record<string, number>;
  unvalidated: string[];           // status in draft/needs_revision
  missingExplanations: string[];
  missingDistractorExplanations: string[];
  missingReferences: string[];
  missingLearningObjective: string[];
  duplicateCandidates: DuplicateCandidate[];
  ambiguityWarnings: AmbiguityWarning[];
  blueprintGaps: { subdomain: string; target: number; have: number; eligible: number }[];
  examPoolSize: number;
  /** Subdomains where the eligible pool cannot fill a 100-item form's share with the configured minimum status. */
  examPoolGaps: { subdomain: string; need: number; eligible: number }[];
}

const STOP = new Set('a an the of and or to in with is are for which following most best this that patient presents reports has have her his their she he they it as on at by be from year old'.split(' '));

export function tokens(s: string | undefined | null): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function shingles(ts: string[], k = 2): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + k <= ts.length; i++) out.add(ts.slice(i, i + k).join(' '));
  return out;
}

export function findDuplicates(questions: Question[], stemThreshold = 0.5, optionThreshold = 0.85): DuplicateCandidate[] {
  const prep = questions.map((q) => ({
    id: q.id,
    stem: shingles(tokens(q.stem)),
    opts: new Set(OPTION_KEYS.map((k) => (q.options?.[k] ?? '').toLowerCase().trim())),
    correct: (q.options?.[q.correct] ?? '').toLowerCase().trim(),
  }));
  const out: DuplicateCandidate[] = [];
  for (let i = 0; i < prep.length; i++) {
    for (let j = i + 1; j < prep.length; j++) {
      const a = prep[i]!, b = prep[j]!;
      const s = jaccard(a.stem, b.stem);
      const o = jaccard(a.opts, b.opts);
      const sameOptionsAndKey = o >= optionThreshold && a.correct === b.correct;
      if (s >= stemThreshold && sameOptionsAndKey) out.push({ a: a.id, b: b.id, similarity: Math.max(s, o), reason: 'stem+options' });
      else if (s >= stemThreshold) out.push({ a: a.id, b: b.id, similarity: s, reason: 'stem' });
      else if (sameOptionsAndKey && o >= 0.99) out.push({ a: a.id, b: b.id, similarity: o, reason: 'options' });
    }
  }
  return out.sort((x, y) => y.similarity - x.similarity);
}

const NEGATIVE = /\b(not|except|least|false|incorrect)\b/i;
const ALL_NONE = /\b(all|none) of the above\b|\bboth [abcd] and [abcd]\b/i;
const ABSOLUTE = /\b(always|never)\b/i;

export function ambiguityWarnings(q: Question): AmbiguityWarning[] {
  const w: AmbiguityWarning[] = [];
  if (!q.options || typeof q.stem !== 'string') return [{ id: q.id ?? '(no id)', code: 'option-count', detail: 'missing stem or options' }];
  const present = OPTION_KEYS.filter((k) => typeof q.options[k] === 'string' && q.options[k].trim().length > 0);
  if (present.length !== 4) w.push({ id: q.id, code: 'option-count', detail: `${present.length} non-empty options` });
  // Negatively worded QUESTIONS (NCBAHM item writers avoid "not"/"except"). A clinical negative inside the
  // vignette ("does not feel thirsty") is fine; only the interrogative sentence is checked, plus any upper-case NOT/EXCEPT anywhere.
  const stemNoPinyin = q.stem.replace(/\([^)]*\)/g, '');
  const sentences = stemNoPinyin.split(/(?<=[.?!])\s+/);
  const question = sentences.filter((s) => s.includes('?')).join(' ') || sentences[sentences.length - 1] || '';
  const neg = question.match(NEGATIVE) ?? stemNoPinyin.match(/\b(NOT|EXCEPT|LEAST)\b/);
  if (neg) w.push({ id: q.id, code: 'negative-stem', detail: `question is negatively worded ("${neg[0]}")` });
  for (const k of present) {
    if (ALL_NONE.test(q.options[k])) w.push({ id: q.id, code: 'all-none-of-above', detail: `option ${k}` });
    if (ABSOLUTE.test(q.options[k])) w.push({ id: q.id, code: 'absolute-wording', detail: `option ${k} uses always/never` });
  }
  const lens = present.map((k) => q.options[k].length);
  if (lens.length === 4) {
    const correctLen = q.options[q.correct].length;
    const others = present.filter((k) => k !== q.correct).map((k) => q.options[k].length);
    const maxOther = Math.max(...others);
    if (correctLen > maxOther * 1.6 && correctLen - maxOther > 25) {
      w.push({ id: q.id, code: 'option-length-outlier', detail: `correct option is ${correctLen} chars vs longest distractor ${maxOther}` });
    }
  }
  const lower = new Map<string, string[]>();
  for (const k of present) {
    const t = q.options[k].toLowerCase().trim();
    lower.set(t, [...(lower.get(t) ?? []), k]);
  }
  for (const [t, ks] of lower) if (ks.length > 1) w.push({ id: q.id, code: 'duplicate-options', detail: `options ${ks.join(',')} are identical: "${t}"` });
  // Stem leaks: the full correct option text appears verbatim in the stem (short options like "Lung" excluded).
  const corr = q.options[q.correct]?.toLowerCase().trim();
  if (corr && corr.length >= 12 && q.stem.toLowerCase().includes(corr)) {
    w.push({ id: q.id, code: 'stem-leaks-answer', detail: 'correct option text appears verbatim in the stem' });
  }
  return w;
}

export function isExamEligible(q: Question, minStatus: ValidationStatus): boolean {
  const order: ValidationStatus[] = ['rejected', 'draft', 'needs_revision', 'ai_reviewed', 'human_approved'];
  const s = q.validation?.status ?? 'draft';
  if (s === 'rejected' || s === 'needs_revision') return false;
  return order.indexOf(s) >= order.indexOf(minStatus);
}

export function auditBank(questions: Question[], bp: BlueprintSpec, minStatus: ValidationStatus = 'ai_reviewed'): AuditReport {
  const count = (f: (q: Question) => string) => {
    const r: Record<string, number> = {};
    for (const q of questions) {
      const k = f(q);
      r[k] = (r[k] ?? 0) + 1;
    }
    return r;
  };
  const subs = flattenSubdomains(bp);
  const targets = bp.bankTargets ?? {};
  const eligible = questions.filter((q) => isExamEligible(q, minStatus));
  const eligibleBySub: Record<string, number> = {};
  for (const q of eligible) eligibleBySub[q.subdomain] = (eligibleBySub[q.subdomain] ?? 0) + 1;
  const haveBySub = count((q) => q.subdomain);

  const blueprintGaps = subs
    .map((s) => ({ subdomain: s.id, target: targets[s.id] ?? 0, have: haveBySub[s.id] ?? 0, eligible: eligibleBySub[s.id] ?? 0 }))
    .filter((g) => g.have < g.target);

  // For a 100-item form, each subdomain needs ceil(weight) eligible items; use 2× for variety.
  const examPoolGaps = subs
    .map((s) => ({ subdomain: s.id, need: Math.ceil(s.weight), eligible: eligibleBySub[s.id] ?? 0 }))
    .filter((g) => g.eligible < g.need);

  return {
    total: questions.length,
    byStatus: count((q) => q.validation?.status ?? 'draft'),
    byDomain: count((q) => q.domain),
    bySubdomain: haveBySub,
    byDifficulty: count((q) => q.difficulty),
    byCognitiveLevel: count((q) => q.cognitiveLevel),
    answerKeyBalance: count((q) => q.correct),
    unvalidated: questions.filter((q) => !isExamEligible(q, 'ai_reviewed')).map((q) => q.id),
    missingExplanations: questions.filter((q) => !q.explanation || q.explanation.trim().length < 20).map((q) => q.id),
    missingDistractorExplanations: questions
      .filter((q) => OPTION_KEYS.filter((k) => k !== q.correct).some((k) => !q.distractorExplanations?.[k] || q.distractorExplanations[k]!.trim().length < 10))
      .map((q) => q.id),
    missingReferences: questions.filter((q) => !q.references || q.references.length === 0 || q.references.some((r) => !r.source)).map((q) => q.id),
    missingLearningObjective: questions.filter((q) => !q.learningObjective || q.learningObjective.trim().length < 10).map((q) => q.id),
    duplicateCandidates: findDuplicates(questions),
    ambiguityWarnings: questions.flatMap(ambiguityWarnings),
    blueprintGaps,
    examPoolSize: eligible.length,
    examPoolGaps,
  };
}
