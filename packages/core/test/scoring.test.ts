import { describe, it, expect } from 'vitest';
import { assembleExam, scoreAttempt, toPresentedKey, type AttemptResponse } from '../src/index.ts';
import { BP, syntheticBank } from './fixtures.ts';

describe('scoreAttempt', () => {
  const pool = syntheticBank(14);
  const byQ = new Map(pool.map((q) => [q.id, q]));
  const form = assembleExam({ blueprint: BP, pool, count: 100, seed: 2 });

  it('computes raw accuracy with unanswered counting as incorrect', () => {
    const responses: AttemptResponse[] = form.items.map((it, i) => {
      const q = byQ.get(it.questionId)!;
      if (i < 60) return { position: it.position, questionId: it.questionId, chosen: toPresentedKey(it, q.correct), chosenOriginal: q.correct, correct: true, flagged: i % 10 === 0, responseMs: 30_000 };
      if (i < 90) {
        const wrong = (['A', 'B', 'C', 'D'] as const).find((k) => k !== it.presentedCorrect)!;
        return { position: it.position, questionId: it.questionId, chosen: wrong, chosenOriginal: null, correct: false, flagged: false, responseMs: 45_000 };
      }
      return { position: it.position, questionId: it.questionId, chosen: null, chosenOriginal: null, correct: null, flagged: true, responseMs: 5_000 };
    });
    const s = scoreAttempt(BP, byQ, form.items, responses);
    expect(s.total).toBe(100);
    expect(s.answered).toBe(90);
    expect(s.unanswered).toBe(10);
    expect(s.correct).toBe(60);
    expect(s.rawAccuracy).toBeCloseTo(0.6, 10);
    expect(s.flagged).toBe(6 + 10);
    expect(s.byDomain.map((r) => r.total)).toEqual([28, 38, 34]);
    expect(s.byDomain.reduce((a, r) => a + r.correct, 0)).toBe(60);
    expect(s.bySubdomain.reduce((a, r) => a + r.total, 0)).toBe(100);
    expect(s.byDifficulty.reduce((a, r) => a + r.total, 0)).toBe(100);
    expect(s.byCognitiveLevel.reduce((a, r) => a + r.total, 0)).toBe(100);
    expect(s.totalResponseMs).toBe(60 * 30_000 + 30 * 45_000 + 10 * 5_000);
    for (const r of s.byDomain) expect(r.accuracy).toBeCloseTo(r.correct / r.total, 10);
  });

  it('a blank attempt scores zero, never NaN', () => {
    const s = scoreAttempt(BP, byQ, form.items, []);
    expect(s.rawAccuracy).toBe(0);
    expect(s.answered).toBe(0);
    expect(s.avgResponseMs).toBe(0);
    expect(s.byDomain.every((r) => r.accuracy === 0)).toBe(true);
  });

  it('a perfect attempt scores 1.0', () => {
    const responses: AttemptResponse[] = form.items.map((it) => ({ position: it.position, questionId: it.questionId, chosen: it.presentedCorrect, chosenOriginal: null, correct: true, flagged: false, responseMs: 1000 }));
    const s = scoreAttempt(BP, byQ, form.items, responses);
    expect(s.rawAccuracy).toBe(1);
    expect(s.byDomain.every((r) => r.accuracy === 1)).toBe(true);
  });

  it('never emits a scaled score field', () => {
    const s = scoreAttempt(BP, byQ, form.items, []) as unknown as Record<string, unknown>;
    expect(Object.keys(s).some((k) => /scaled|pass/i.test(k))).toBe(false);
  });
});
