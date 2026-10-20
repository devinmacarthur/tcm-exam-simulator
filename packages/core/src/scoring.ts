import type { AttemptItem, AttemptResponse, BlueprintSpec, Question, ScoreBreakdownRow, ScoreReport } from './types.ts';
import { COGNITIVE_LEVELS, DIFFICULTIES } from './types.ts';
import { flattenSubdomains } from './blueprint.ts';

function row(key: string, label: string): ScoreBreakdownRow {
  return { key, label, total: 0, answered: 0, correct: 0, accuracy: 0 };
}

function finalize(rows: Map<string, ScoreBreakdownRow>): ScoreBreakdownRow[] {
  return [...rows.values()].map((r) => ({ ...r, accuracy: r.total === 0 ? 0 : r.correct / r.total }));
}

/**
 * Compute a raw score report. Unanswered items count as incorrect (official rule: all items must be answered).
 * Never produces a scaled score — NCBAHM's conversion is unpublished.
 */
export function scoreAttempt(
  blueprint: BlueprintSpec,
  questions: Map<string, Question>,
  items: AttemptItem[],
  responses: AttemptResponse[],
): ScoreReport {
  const byPos = new Map<number, AttemptResponse>();
  for (const r of responses) byPos.set(r.position, r);

  const byDomain = new Map<string, ScoreBreakdownRow>();
  for (const d of blueprint.domains) byDomain.set(d.id, row(d.id, `${d.id}. ${d.name}`));
  const bySub = new Map<string, ScoreBreakdownRow>();
  for (const s of flattenSubdomains(blueprint)) bySub.set(s.id, row(s.id, `${s.id} ${s.name}`));
  const byDiff = new Map<string, ScoreBreakdownRow>();
  for (const d of DIFFICULTIES) byDiff.set(d, row(d, d));
  const byCog = new Map<string, ScoreBreakdownRow>();
  for (const c of COGNITIVE_LEVELS) byCog.set(c, row(c, c));

  let answered = 0;
  let correct = 0;
  let totalMs = 0;
  let flagged = 0;

  for (const it of items) {
    const q = questions.get(it.questionId);
    if (!q) throw new Error(`Missing question ${it.questionId}`);
    const r = byPos.get(it.position);
    const isAnswered = !!r && r.chosen !== null;
    const isCorrect = isAnswered && r!.chosen === it.presentedCorrect;
    if (isAnswered) answered += 1;
    if (isCorrect) correct += 1;
    if (r) {
      totalMs += r.responseMs;
      if (r.flagged) flagged += 1;
    }
    const bump = (m: Map<string, ScoreBreakdownRow>, key: string, label?: string) => {
      let x = m.get(key);
      if (!x) {
        x = row(key, label ?? key);
        m.set(key, x);
      }
      x.total += 1;
      if (isAnswered) x.answered += 1;
      if (isCorrect) x.correct += 1;
    };
    bump(byDomain, q.domain);
    bump(bySub, q.subdomain);
    bump(byDiff, q.difficulty);
    bump(byCog, q.cognitiveLevel);
  }

  const total = items.length;
  return {
    total,
    answered,
    unanswered: total - answered,
    correct,
    rawAccuracy: total === 0 ? 0 : correct / total,
    byDomain: finalize(byDomain),
    bySubdomain: finalize(bySub).filter((r) => r.total > 0),
    byDifficulty: finalize(byDiff),
    byCognitiveLevel: finalize(byCog),
    totalResponseMs: totalMs,
    avgResponseMs: answered === 0 ? 0 : Math.round(totalMs / Math.max(1, responses.length)),
    flagged,
  };
}

/** Evaluate one response against the attempt item. */
export function isCorrectResponse(item: AttemptItem, chosen: AttemptResponse['chosen']): boolean | null {
  if (chosen === null) return null;
  return chosen === item.presentedCorrect;
}

export function percent(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}
