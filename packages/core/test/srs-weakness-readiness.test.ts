import { describe, it, expect } from 'vitest';
import { newCard, reviewCard, gradeFromResponse, isDue, summarize, analyzeWeakness, selectTargeted, assessReadiness, DEFAULT_THRESHOLDS, createRng, type GradedResponse } from '../src/index.ts';
import { syntheticBank } from './fixtures.ts';

describe('srs', () => {
  it('grades from correctness and speed', () => {
    expect(gradeFromResponse(false, 1000)).toBe(0);
    expect(gradeFromResponse(true, 200_000)).toBe(3);
    expect(gradeFromResponse(true, 60_000)).toBe(4);
    expect(gradeFromResponse(true, 10_000)).toBe(5);
  });
  it('grows intervals on success and resets on failure', () => {
    const t0 = new Date('2026-10-01T00:00:00Z');
    let c = newCard('Q', t0);
    expect(isDue(c, t0)).toBe(true);
    c = reviewCard(c, 4, t0);
    expect(c.intervalDays).toBe(1);
    expect(isDue(c, t0)).toBe(false);
    c = reviewCard(c, 4, new Date('2026-10-02T00:00:00Z'));
    expect(c.intervalDays).toBe(3);
    c = reviewCard(c, 5, new Date('2026-10-05T00:00:00Z'));
    expect(c.intervalDays).toBeGreaterThan(3);
    const before = c.ease;
    c = reviewCard(c, 0, new Date('2026-10-20T00:00:00Z'));
    expect(c.repetitions).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.ease).toBeLessThan(before);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
    expect(isDue(c, new Date('2026-10-21T00:00:01Z'))).toBe(true);
  });
  it('summarizes buckets', () => {
    const t = new Date('2026-10-01T00:00:00Z');
    const cards = [newCard('a', t), reviewCard(newCard('b', t), 4, t), { ...reviewCard(newCard('c', t), 4, t), repetitions: 5, intervalDays: 40 }];
    const s = summarize(cards, t);
    expect(s.total).toBe(3);
    expect(s.due).toBe(1);
    expect(s.learning).toBe(2);
    expect(s.mature).toBe(1);
  });
});

describe('weakness detection', () => {
  const pool = syntheticBank(6);
  const byQ = new Map(pool.map((q) => [q.id, q]));
  const r = (q: typeof pool[number], correct: boolean, i: number): GradedResponse => ({ questionId: q.id, correct, chosenOriginal: 'A', responseMs: 1000, answeredAt: `2026-10-0${(i % 9) + 1}T00:00:00Z`, attemptId: 'a', mode: 'study', firstExposure: true });

  it('flags concepts and confusion pairs with repeated misses', () => {
    const iif = pool.filter((q) => q.subdomain === 'II-f');
    const responses = iif.map((q, i) => r(q, false, i)).concat(pool.filter((q) => q.subdomain === 'I-A').map((q, i) => r(q, true, i)));
    const rep = analyzeWeakness(byQ, responses);
    expect(rep.concepts.length).toBeGreaterThan(0);
    expect(rep.concepts.every((c) => c.accuracy <= 0.7)).toBe(true);
    expect(rep.confusions[0]!.pair).toEqual(['concept-ii-f-0', 'concept-ii-f-1']);
    expect(rep.confusions[0]!.misses).toBe(2);
    expect(rep.bySubdomain.find((s) => s.concept === 'I-A')!.accuracy).toBe(1);
  });

  it('targeted selection prioritizes missed, then unseen weak-concept items', () => {
    const iif = pool.filter((q) => q.subdomain === 'II-f');
    const responses = iif.slice(0, 2).map((q, i) => r(q, false, i));
    const rep = analyzeWeakness(byQ, responses, { minAttempts: 1 });
    const rng = createRng(1);
    const sel = selectTargeted(pool, responses, rep, 4, (a) => rng.shuffle(a));
    expect(sel.questions).toHaveLength(4);
    expect(sel.questions.slice(0, 2).map((q) => q.id).sort()).toEqual(iif.slice(0, 2).map((q) => q.id).sort());
    expect(sel.reasons[sel.questions[0]!.id]).toBe('Previously missed');
    expect(sel.reasons[sel.questions[2]!.id]).toMatch(/Unseen/);
  });
});

describe('readiness', () => {
  const base = { unseenAccuracy: 0.8, unseenCount: 120, domainAccuracy: { I: 0.8, II: 0.78, III: 0.82 }, fullExamScores: [0.78, 0.8, 0.82], fullExamCompletedInTime: [true, true, true], higherOrderAccuracy: 0.75, coverage: 0.7 };
  it('reports insufficient data below the response floor', () => {
    expect(assessReadiness({ ...base, unseenCount: 10 }).label).toBe('Insufficient data');
  });
  it('labels in order of thresholds', () => {
    expect(assessReadiness({ ...base, unseenAccuracy: 0.4 }).label).toBe('Needs foundational review');
    expect(assessReadiness({ ...base, unseenAccuracy: 0.65 }).label).toBe('Developing competency');
    expect(assessReadiness({ ...base, fullExamScores: [0.8], fullExamCompletedInTime: [true] }).label).toBe('Approaching practice target');
    expect(assessReadiness({ ...base, fullExamScores: [0.9, 0.6, 0.8], fullExamCompletedInTime: [true, true, true] }).label).toBe('Approaching practice target');
    expect(assessReadiness({ ...base, fullExamCompletedInTime: [true, false, true] }).label).toBe('Approaching practice target');
    expect(assessReadiness({ ...base, domainAccuracy: { I: 0.5, II: 0.8, III: 0.8 } }).label).toBe('Approaching practice target');
    expect(assessReadiness(base).label).toBe('Consistently meeting practice target');
  });
  it('thresholds are configurable', () => {
    const strict = { ...DEFAULT_THRESHOLDS, practiceTarget: 0.9 };
    expect(assessReadiness(base, strict).label).toBe('Developing competency');
  });
  it('never claims an official pass probability', () => {
    const r = assessReadiness(base);
    expect(JSON.stringify(r)).not.toMatch(/probab|scaled score/i);
  });
});
