import { describe, it, expect, beforeEach } from 'vitest';
import { Service, syncBankToDb, readAllQuestions, migrate, MIGRATIONS, type OptionKey } from '@fom/core';
import { openDatabase, NodeDb } from '../src/db.ts';
import { BP, syntheticBank } from '../../core/test/fixtures.ts';
import { DatabaseSync } from 'node:sqlite';

function makeService(perSub = 14) {
  const db = openDatabase(':memory:');
  const bank = syntheticBank(perSub);
  syncBankToDb(db, bank);
  return new Service(db, readAllQuestions(db), BP, 'fom-2026');
}

describe('migrations', () => {
  it('apply once and are idempotent', () => {
    const db = new NodeDb(new DatabaseSync(':memory:'));
    expect(migrate(db)).toEqual(MIGRATIONS.map((m) => m.name));
    expect(migrate(db)).toEqual([]);
  });
});

describe('bank sync', () => {
  it('mirrors, updates and removes', () => {
    const db = openDatabase(':memory:');
    const bank = syntheticBank(2);
    expect(syncBankToDb(db, bank)).toEqual({ inserted: bank.length, updated: 0, removed: 0 });
    const again = syncBankToDb(db, bank.slice(1));
    expect(again).toEqual({ inserted: 0, updated: bank.length - 1, removed: 1 });
    expect(readAllQuestions(db).size).toBe(bank.length - 1);
  });
});

describe('Service attempts', () => {
  let svc: Service;
  beforeEach(() => { svc = makeService(); });

  it('creates a full exam with hidden answers and 150-minute deadline', () => {
    const { attempt, items } = svc.createAttempt('exam', { count: 100, minutes: 150, fidelity: true, preferUnseen: true, immediateFeedback: false });
    expect(items).toHaveLength(100);
    expect(attempt.timeLimitS).toBe(9000);
    expect(attempt.deadlineAt).not.toBeNull();
    const v = svc.view(attempt.id);
    expect(v.items.every((i) => i.reveal === undefined)).toBe(true);
    expect(Object.keys(v.items[0]!.options)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('scores correctly and reveals after submit; persistence survives re-read', () => {
    const { attempt, items } = svc.createAttempt('exam', { count: 20, minutes: 30, fidelity: false, preferUnseen: true, immediateFeedback: false });
    items.slice(0, 15).forEach((it) => svc.respond(attempt.id, it.position, { chosen: it.presentedCorrect, responseMs: 1000 }));
    items.slice(15, 18).forEach((it) => svc.respond(attempt.id, it.position, { chosen: (['A', 'B', 'C', 'D'] as OptionKey[]).find((k) => k !== it.presentedCorrect)!, responseMs: 1000, flagged: true }));
    const { score } = svc.submit(attempt.id);
    expect(score.correct).toBe(15);
    expect(score.answered).toBe(18);
    expect(score.unanswered).toBe(2);
    expect(score.rawAccuracy).toBeCloseTo(0.75, 10);
    expect(score.flagged).toBe(3);
    const v = svc.view(attempt.id);
    expect(v.attempt.status).toBe('submitted');
    expect(v.items.every((i) => i.reveal !== undefined)).toBe(true);
    expect(svc.submit(attempt.id).score).toEqual(score); // idempotent
    expect(svc.stats().get(items[0]!.questionId)!.usageCount).toBe(1);
    expect(svc.allCards()).toHaveLength(18);
  });

  it('fidelity mode locks answers; linear mode allows changes', () => {
    const f = svc.createAttempt('exam', { count: 5, minutes: null, fidelity: true, preferUnseen: true, immediateFeedback: false });
    svc.respond(f.attempt.id, 1, { chosen: 'A' });
    expect(() => svc.respond(f.attempt.id, 1, { chosen: 'B' })).toThrow(/locked/);
    const l = svc.createAttempt('exam', { count: 5, minutes: null, fidelity: false, preferUnseen: true, immediateFeedback: false });
    svc.respond(l.attempt.id, 1, { chosen: 'A' });
    const r = svc.respond(l.attempt.id, 1, { chosen: 'B' });
    expect(r.response.chosen).toBe('B');
    expect(r.reveal).toBeUndefined();
  });

  it('study mode reveals explanations immediately, keyed by presented letters', () => {
    const s = svc.createAttempt('study', { count: 5, minutes: null, fidelity: false, preferUnseen: true, immediateFeedback: true, subdomains: ['II-f'] });
    const it = s.items[0]!;
    // Nothing is revealed before the learner answers.
    expect(svc.view(s.attempt.id).items.every((i) => i.reveal === undefined)).toBe(true);
    const r = svc.respond(s.attempt.id, 1, { chosen: 'A' });
    expect(r.reveal).toBeDefined();
    expect(r.reveal!.correct).toBe(it.presentedCorrect);
    expect(Object.keys(r.reveal!.distractorExplanations).sort()).toEqual((['A', 'B', 'C', 'D'] as OptionKey[]).filter((k) => k !== it.presentedCorrect));
    const v = svc.view(s.attempt.id);
    expect(v.items.every((i) => i.subdomain === 'II-f')).toBe(true);
    // Only the answered item is revealed on reload.
    expect(v.items[0]!.reveal).toBeDefined();
    expect(v.items.slice(1).every((i) => i.reveal === undefined)).toBe(true);
  });

  it('auto-submits expired timed attempts and marks them timed out', () => {
    const { attempt } = svc.createAttempt('exam', { count: 5, minutes: 0.0001, fidelity: true, preferUnseen: true, immediateFeedback: false });
    svc.db.prepare("UPDATE attempts SET deadline_at = ? WHERE id = ?").run('2000-01-01T00:00:00.000Z', attempt.id);
    expect(svc.sweepExpired()).toEqual([attempt.id]);
    const a = svc.getAttempt(attempt.id)!;
    expect(a.status).toBe('submitted');
    expect(a.timedOut).toBe(true);
    expect(a.score!.unanswered).toBe(5);
  });

  it('prefers unseen questions on a second exam and tracks first exposure', () => {
    svc = makeService(40); // every subdomain can supply two disjoint forms
    const a = svc.createAttempt('exam', { count: 100, minutes: null, fidelity: false, preferUnseen: true, immediateFeedback: false });
    a.items.forEach((it) => svc.respond(a.attempt.id, it.position, { chosen: 'A' }));
    svc.submit(a.attempt.id);
    const seen = new Set(a.items.map((i) => i.questionId));
    const b = svc.createAttempt('exam', { count: 100, minutes: null, fidelity: false, preferUnseen: true, immediateFeedback: false });
    const overlap = b.items.filter((i) => seen.has(i.questionId)).length;
    expect(overlap).toBe(0);
    const ov = svc.overview();
    expect(ov.totals.unseenResponses).toBe(100);
    expect(ov.coverage.seen).toBe(100);
  });

  it('targeted sessions draw from missed questions first', () => {
    const a = svc.createAttempt('study', { count: 10, minutes: null, fidelity: false, preferUnseen: true, immediateFeedback: true });
    a.items.forEach((it) => svc.respond(a.attempt.id, it.position, { chosen: (['A', 'B', 'C', 'D'] as OptionKey[]).find((k) => k !== it.presentedCorrect)! }));
    svc.submit(a.attempt.id);
    expect(svc.missedQuestionIds()).toHaveLength(10);
    const t = svc.createAttempt('targeted', { count: 10, minutes: null, fidelity: false, preferUnseen: false, immediateFeedback: true, targeted: true });
    const missed = new Set(a.items.map((i) => i.questionId));
    expect(t.items.every((i) => missed.has(i.questionId))).toBe(true);
  });

  it('exam pool respects the configured minimum status', () => {
    const db = openDatabase(':memory:');
    syncBankToDb(db, syntheticBank(14, 'draft'));
    const s = new Service(db, readAllQuestions(db), BP, 'fom-2026');
    expect(() => s.createAttempt('exam', { count: 10, minutes: null, fidelity: true, preferUnseen: true, immediateFeedback: false })).toThrow(/No eligible/);
    expect(s.audit().examPoolSize).toBe(0);
  });

  it('bookmarks and settings round-trip', () => {
    const id = [...svc.questions.keys()][0]!;
    svc.addBookmark(id, 'revisit');
    expect(svc.isBookmarked(id)).toBe(true);
    expect(svc.listBookmarks()[0]!.note).toBe('revisit');
    svc.removeBookmark(id);
    expect(svc.isBookmarked(id)).toBe(false);
    const s = svc.saveSettings({ theme: 'dark', readiness: { ...svc.getSettings().readiness, practiceTarget: 0.8 } });
    expect(s.theme).toBe('dark');
    expect(svc.getSettings().readiness.practiceTarget).toBe(0.8);
    expect(svc.getSettings().readiness.minFullExams).toBe(3);
  });
});
