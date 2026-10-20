import type { Question } from './types.ts';

/** A single graded response, flattened from attempts — the input to analytics. */
export interface GradedResponse {
  questionId: string;
  correct: boolean | null;
  chosenOriginal: string | null;
  responseMs: number;
  answeredAt: string; // ISO
  attemptId: string;
  mode: string;
  /** Was this the first time the user ever saw this question? */
  firstExposure: boolean;
}

export interface ConceptStat {
  concept: string;
  attempts: number;
  misses: number;
  accuracy: number;
  lastMissAt?: string;
}

export interface ConfusionPair {
  pair: [string, string];
  misses: number;
  attempts: number;
  /** Discriminating finding(s) collected from the items' `distinction.key`. */
  keys: string[];
  questionIds: string[];
}

export interface WeaknessReport {
  concepts: ConceptStat[];       // sorted by misses desc, then accuracy asc
  confusions: ConfusionPair[];   // sorted by misses desc
  bySubdomain: ConceptStat[];
  byDifficulty: ConceptStat[];
  byCognitiveLevel: ConceptStat[];
}

export interface WeaknessOptions {
  /** Minimum attempts before a concept can be flagged. */
  minAttempts?: number;
  /** Maximum accuracy for a concept to count as weak. */
  maxAccuracy?: number;
}

function agg(map: Map<string, ConceptStat>, key: string, correct: boolean | null, at: string) {
  let s = map.get(key);
  if (!s) {
    s = { concept: key, attempts: 0, misses: 0, accuracy: 0 };
    map.set(key, s);
  }
  s.attempts += 1;
  if (correct !== true) {
    s.misses += 1;
    if (!s.lastMissAt || at > s.lastMissAt) s.lastMissAt = at;
  }
}

function fin(map: Map<string, ConceptStat>): ConceptStat[] {
  return [...map.values()].map((s) => ({ ...s, accuracy: s.attempts === 0 ? 0 : (s.attempts - s.misses) / s.attempts }));
}

export function analyzeWeakness(
  questions: Map<string, Question>,
  responses: GradedResponse[],
  opts: WeaknessOptions = {},
): WeaknessReport {
  const minAttempts = opts.minAttempts ?? 2;
  const maxAccuracy = opts.maxAccuracy ?? 0.7;
  const concepts = new Map<string, ConceptStat>();
  const subs = new Map<string, ConceptStat>();
  const diffs = new Map<string, ConceptStat>();
  const cogs = new Map<string, ConceptStat>();
  const pairs = new Map<string, ConfusionPair>();

  for (const r of responses) {
    const q = questions.get(r.questionId);
    if (!q) continue;
    for (const c of q.concepts) agg(concepts, c, r.correct, r.answeredAt);
    agg(subs, q.subdomain, r.correct, r.answeredAt);
    agg(diffs, q.difficulty, r.correct, r.answeredAt);
    agg(cogs, q.cognitiveLevel, r.correct, r.answeredAt);
    if (q.distinction && q.distinction.between.length >= 2) {
      const [a, b] = [...q.distinction.between].sort() as [string, string];
      const key = `${a}|${b}`;
      let p = pairs.get(key);
      if (!p) {
        p = { pair: [a, b], misses: 0, attempts: 0, keys: [], questionIds: [] };
        pairs.set(key, p);
      }
      p.attempts += 1;
      if (r.correct !== true) {
        p.misses += 1;
        if (!p.keys.includes(q.distinction.key)) p.keys.push(q.distinction.key);
        if (!p.questionIds.includes(q.id)) p.questionIds.push(q.id);
      }
    }
  }

  const weakConcepts = fin(concepts)
    .filter((s) => s.attempts >= minAttempts && s.accuracy <= maxAccuracy)
    .sort((a, b) => b.misses - a.misses || a.accuracy - b.accuracy || a.concept.localeCompare(b.concept));
  const confusions = [...pairs.values()].filter((p) => p.misses > 0).sort((a, b) => b.misses - a.misses);

  return {
    concepts: weakConcepts,
    confusions,
    bySubdomain: fin(subs).sort((a, b) => a.concept.localeCompare(b.concept)),
    byDifficulty: fin(diffs),
    byCognitiveLevel: fin(cogs),
  };
}

/**
 * Select questions for a targeted session: prioritize (1) previously missed questions,
 * (2) unseen questions tagged with weak concepts, (3) anything in weak subdomains.
 */
export function selectTargeted(
  pool: Question[],
  responses: GradedResponse[],
  report: WeaknessReport,
  count: number,
  rngShuffle: <T>(a: readonly T[]) => T[],
): { questions: Question[]; reasons: Record<string, string> } {
  const lastResult = new Map<string, boolean | null>();
  for (const r of [...responses].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) lastResult.set(r.questionId, r.correct);
  const seen = new Set(lastResult.keys());
  const weakSet = new Set(report.concepts.map((c) => c.concept));
  const weakSubs = new Set(report.bySubdomain.filter((s) => s.attempts >= 3 && s.accuracy < 0.7).map((s) => s.concept));

  const missed = pool.filter((q) => lastResult.get(q.id) === false);
  const unseenWeak = pool.filter((q) => !seen.has(q.id) && q.concepts.some((c) => weakSet.has(c)));
  const weakSubQs = pool.filter((q) => !seen.has(q.id) && weakSubs.has(q.subdomain) && !q.concepts.some((c) => weakSet.has(c)));

  const out: Question[] = [];
  const reasons: Record<string, string> = {};
  const push = (qs: Question[], reason: string) => {
    for (const q of rngShuffle(qs)) {
      if (out.length >= count) return;
      if (out.find((x) => x.id === q.id)) continue;
      out.push(q);
      reasons[q.id] = reason;
    }
  };
  push(missed, 'Previously missed');
  push(unseenWeak, 'Unseen item on a weak concept');
  push(weakSubQs, 'Unseen item in a weak subdomain');
  if (out.length < count) push(pool.filter((q) => !seen.has(q.id)), 'Unseen item (fill)');
  if (out.length < count) push(pool, 'Fill');
  return { questions: out, reasons };
}
