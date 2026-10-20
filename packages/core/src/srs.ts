/**
 * Spaced repetition — a conservative SM-2 variant keyed by question id.
 * Grades: 0 = wrong, 3 = correct but slow (> slowMs), 4 = correct, 5 = correct and fast.
 */
export interface SrsCard {
  questionId: string;
  ease: number;        // >= 1.3
  intervalDays: number;
  repetitions: number;
  dueAt: string;       // ISO date-time
  lastReviewedAt?: string;
  lapses: number;
}

export interface SrsConfig {
  slowMs: number;      // threshold for "slow correct"
  fastMs: number;      // threshold for "fast correct"
  initialIntervals: [number, number]; // days after 1st and 2nd success
}

export const DEFAULT_SRS: SrsConfig = { slowMs: 120_000, fastMs: 35_000, initialIntervals: [1, 3] };

export function newCard(questionId: string, now = new Date()): SrsCard {
  return { questionId, ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: now.toISOString(), lapses: 0 };
}

export function gradeFromResponse(correct: boolean, responseMs: number, cfg: SrsConfig = DEFAULT_SRS): 0 | 3 | 4 | 5 {
  if (!correct) return 0;
  if (responseMs > cfg.slowMs) return 3;
  if (responseMs < cfg.fastMs) return 5;
  return 4;
}

export function reviewCard(card: SrsCard, grade: 0 | 3 | 4 | 5, now = new Date(), cfg: SrsConfig = DEFAULT_SRS): SrsCard {
  const next: SrsCard = { ...card, lastReviewedAt: now.toISOString() };
  if (grade < 3) {
    next.repetitions = 0;
    next.intervalDays = 0;
    next.lapses = card.lapses + 1;
    next.ease = Math.max(1.3, card.ease - 0.2);
    // Due again tomorrow-ish; wrong items come back soon.
    next.dueAt = new Date(now.getTime() + 1 * 86_400_000).toISOString();
    return next;
  }
  const reps = card.repetitions + 1;
  let interval: number;
  if (reps === 1) interval = cfg.initialIntervals[0];
  else if (reps === 2) interval = cfg.initialIntervals[1];
  else interval = Math.round(card.intervalDays * card.ease);
  const ease = Math.max(1.3, card.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  next.repetitions = reps;
  next.intervalDays = Math.max(1, interval);
  next.ease = ease;
  next.dueAt = new Date(now.getTime() + next.intervalDays * 86_400_000).toISOString();
  return next;
}

export function isDue(card: SrsCard, now = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= now.getTime();
}

export interface SrsSummary {
  total: number;
  due: number;
  learning: number;   // repetitions < 2
  young: number;      // interval < 21 days
  mature: number;     // interval >= 21 days
}

export function summarize(cards: SrsCard[], now = new Date()): SrsSummary {
  const s: SrsSummary = { total: cards.length, due: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cards) {
    if (isDue(c, now)) s.due += 1;
    if (c.repetitions < 2) s.learning += 1;
    else if (c.intervalDays < 21) s.young += 1;
    else s.mature += 1;
  }
  return s;
}
