import { describe, it, expect } from 'vitest';
import { auditBank, ambiguityWarnings, findDuplicates, checkSchema, runPipeline, isExamEligible, type Question } from '../src/index.ts';
import { BP, syntheticBank } from './fixtures.ts';

describe('audit', () => {
  it('counts, balances and finds gaps', () => {
    const bank = syntheticBank(4);
    const rep = auditBank(bank, BP);
    expect(rep.total).toBe(bank.length);
    expect(rep.byDomain.I).toBe(16);
    expect(rep.answerKeyBalance).toEqual({ A: 23, B: 23, C: 23, D: 23 });
    expect(rep.blueprintGaps.length).toBeGreaterThan(0); // 4 per subdomain < targets
    expect(rep.examPoolGaps.some((g) => g.subdomain === 'III-1')).toBe(true); // needs 19, have 4
    expect(rep.missingExplanations).toEqual([]);
    expect(rep.unvalidated).toEqual([]);
  });

  it('detects near-duplicate stems and identical option sets', () => {
    const bank = syntheticBank(2);
    const a = bank[0]!;
    const dup: Question = { ...a, id: 'FOM-IA-0099', stem: a.stem + ' Also noting one extra detail.' };
    const d = findDuplicates([...bank, dup]);
    expect(d.some((x) => x.a === a.id && x.b === dup.id && x.reason === 'stem+options')).toBe(true);
  });

  it('flags ambiguity patterns', () => {
    const q = syntheticBank(1)[0]!;
    const bad: Question = { ...q, stem: 'Which of the following is NOT a sign of Spleen Qi deficiency?', options: { ...q.options, B: 'all of the above' } };
    const codes = ambiguityWarnings(bad).map((w) => w.code);
    expect(codes).toContain('negative-stem');
    expect(codes).toContain('all-none-of-above');
    const leak: Question = { ...q, options: { ...q.options, [q.correct]: 'Liver Blood deficiency pattern' }, stem: 'A patient with Liver Blood deficiency pattern presents with dizziness. Which pattern is most consistent?' };
    expect(ambiguityWarnings(leak).map((w) => w.code)).toContain('stem-leaks-answer');
    const longest: Question = { ...q, options: { A: 'short', B: 'short two', C: 'short three', D: 'a very very very long correct option that stands out from the rest of the options by far' }, correct: 'D' };
    expect(ambiguityWarnings(longest).map((w) => w.code)).toContain('option-length-outlier');
  });

  it('exam eligibility respects the status floor', () => {
    const q = syntheticBank(1)[0]!;
    expect(isExamEligible({ ...q, validation: { status: 'draft', passes: {} } }, 'ai_reviewed')).toBe(false);
    expect(isExamEligible({ ...q, validation: { status: 'ai_reviewed', passes: {} } }, 'ai_reviewed')).toBe(true);
    expect(isExamEligible({ ...q, validation: { status: 'ai_reviewed', passes: {} } }, 'human_approved')).toBe(false);
    expect(isExamEligible({ ...q, validation: { status: 'human_approved', passes: {} } }, 'ai_reviewed')).toBe(true);
    expect(isExamEligible({ ...q, validation: { status: 'needs_revision', passes: {} } }, 'draft')).toBe(false);
  });
});

describe('validation pipeline', () => {
  it('schema check catches missing fields and domain/subdomain mismatch', () => {
    const q = syntheticBank(1)[0]!;
    expect(checkSchema(q, BP)).toEqual([]);
    const broken = { ...q, domain: 'II' as const, explanation: 'short', concepts: ['Bad Slug'] };
    const issues = checkSchema(broken, BP).map((i) => i.field);
    expect(issues).toContain('domain');
    expect(issues).toContain('explanation');
    expect(issues).toContain('concepts');
  });

  it('assigns statuses: ai_reviewed only with a blind-solve agreement; needs_revision on any failure', () => {
    const bank = syntheticBank(2).slice(0, 4);
    const blind = new Map<string, { answer: string; concern?: string }>();
    blind.set(bank[0]!.id, { answer: bank[0]!.correct });
    blind.set(bank[1]!.id, { answer: bank[1]!.correct === 'A' ? 'B' : 'A' });
    blind.set(bank[2]!.id, { answer: bank[2]!.correct, concern: 'tongue and pulse conflict' });
    const out = runPipeline(bank, { bp: BP, blindSolves: blind, now: '2026-10-19T00:00:00Z' });
    expect(out[0]!.question.validation!.status).toBe('ai_reviewed');
    expect(out[1]!.question.validation!.status).toBe('needs_revision');
    expect(out[1]!.issues[0]).toMatch(/blindSolve/);
    expect(out[2]!.question.validation!.status).toBe('needs_revision');
    expect(out[2]!.question.validation!.passes.coherence!.ok).toBe(false);
    expect(out[3]!.question.validation!.status).toBe('draft'); // no blind solve yet
    expect(out[0]!.question.validation!.passes.schema!.by).toBe('auto');
    expect(out[0]!.question.validation!.passes.blindSolve!.by).toBe('ai');
  });

  it('never auto-promotes to human_approved and preserves an existing human approval', () => {
    const q = { ...syntheticBank(1)[0]!, validation: { status: 'human_approved' as const, passes: {}, reviewer: { name: 'Dr. X', date: '2026-10-01' } } };
    const out = runPipeline([q], { bp: BP, blindSolves: new Map([[q.id, { answer: q.correct }]]) });
    expect(out[0]!.question.validation!.status).toBe('human_approved');
    expect(out[0]!.question.validation!.reviewer?.name).toBe('Dr. X');
    const plain = { ...q, validation: undefined };
    const out2 = runPipeline([plain], { bp: BP, blindSolves: new Map([[q.id, { answer: q.correct }]]) });
    expect(out2[0]!.question.validation!.status).toBe('ai_reviewed');
  });

  it('fails calibration when cognitive level and difficulty conflict', () => {
    const q = { ...syntheticBank(1)[0]!, cognitiveLevel: 'recall' as const, difficulty: 'advanced' as const };
    const out = runPipeline([q], { bp: BP });
    expect(out[0]!.question.validation!.passes.difficulty!.ok).toBe(false);
    expect(out[0]!.question.validation!.status).toBe('needs_revision');
  });
});
