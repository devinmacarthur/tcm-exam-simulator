import { describe, it, expect } from 'vitest';
import { assembleExam, toOriginalKey, toPresentedKey, subdomainTargets, OPTION_KEYS } from '../src/index.ts';
import { BP, syntheticBank } from './fixtures.ts';

describe('assembleExam', () => {
  const pool = syntheticBank(20); // III-1 alone needs 19 of a 100-item form

  it('produces exactly 100 unique questions distributed per the blueprint', () => {
    const r = assembleExam({ blueprint: BP, pool, count: 100, seed: 42 });
    expect(r.items).toHaveLength(100);
    expect(r.shortfall).toBe(0);
    expect(new Set(r.items.map((i) => i.questionId)).size).toBe(100);
    const byQ = new Map(pool.map((q) => [q.id, q]));
    const counts: Record<string, number> = {};
    for (const it of r.items) {
      const q = byQ.get(it.questionId)!;
      counts[q.subdomain] = (counts[q.subdomain] ?? 0) + 1;
    }
    expect(counts).toEqual(subdomainTargets(BP, 100));
    const domains: Record<string, number> = {};
    for (const it of r.items) { const q = byQ.get(it.questionId)!; domains[q.domain] = (domains[q.domain] ?? 0) + 1; }
    expect(domains).toEqual({ I: 28, II: 38, III: 34 });
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = assembleExam({ blueprint: BP, pool, count: 50, seed: 7 });
    const b = assembleExam({ blueprint: BP, pool, count: 50, seed: 7 });
    const c = assembleExam({ blueprint: BP, pool, count: 50, seed: 8 });
    expect(a.items).toEqual(b.items);
    expect(a.items.map((i) => i.questionId)).not.toEqual(c.items.map((i) => i.questionId));
  });

  it('shuffles options without breaking the key mapping', () => {
    const r = assembleExam({ blueprint: BP, pool, count: 100, seed: 3 });
    const byQ = new Map(pool.map((q) => [q.id, q]));
    let moved = 0;
    for (const it of r.items) {
      const q = byQ.get(it.questionId)!;
      expect([...it.presentedOrder].sort()).toEqual([...OPTION_KEYS].sort());
      expect(toOriginalKey(it, it.presentedCorrect)).toBe(q.correct);
      expect(toPresentedKey(it, q.correct)).toBe(it.presentedCorrect);
      if (it.presentedOrder.join('') !== 'ABCD') moved += 1;
    }
    expect(moved).toBeGreaterThan(50);
    // Presented correct letters should be spread, not all 'A'.
    const letters = new Set(r.items.map((i) => i.presentedCorrect));
    expect(letters.size).toBe(4);
  });

  it('prefers unseen questions and falls back to seen ones when short', () => {
    const seen = new Set(pool.filter((q) => q.subdomain === 'I-A').slice(0, 16).map((q) => q.id));
    const r = assembleExam({ blueprint: BP, pool, count: 100, seed: 1, avoidIds: seen });
    const byQ = new Map(pool.map((q) => [q.id, q]));
    const ia = r.items.filter((i) => byQ.get(i.questionId)!.subdomain === 'I-A');
    expect(ia).toHaveLength(6);
    // 20 in pool, 16 seen → only 4 unseen; must use all 4 unseen + 2 seen, regardless of difficulty tier.
    expect(ia.filter((i) => !seen.has(i.questionId))).toHaveLength(4);
  });

  it('reports shortfall and fills from the same domain when a subdomain is thin', () => {
    const thin = pool.filter((q) => !(q.subdomain === 'I-C' && Number(q.id.slice(-4)) > 2)); // only 2 I-C items
    const r = assembleExam({ blueprint: BP, pool: thin, count: 100, seed: 5 });
    expect(r.coverage['I-C']!.delivered).toBe(2);
    expect(r.items).toHaveLength(100); // filled from elsewhere in Domain I
    const byQ = new Map(thin.map((q) => [q.id, q]));
    const d1 = r.items.filter((i) => byQ.get(i.questionId)!.domain === 'I').length;
    expect(d1).toBe(28); // domain weight preserved
    const d3 = r.items.filter((i) => byQ.get(i.questionId)!.domain === 'III').length;
    expect(d3).toBe(34);
  });

  it('restricts to requested subdomains in study mode', () => {
    const r = assembleExam({ blueprint: BP, pool, count: 20, seed: 9, subdomains: ['II-f', 'I-D'] });
    const byQ = new Map(pool.map((q) => [q.id, q]));
    expect(r.items.every((i) => ['II-f', 'I-D'].includes(byQ.get(i.questionId)!.subdomain))).toBe(true);
    expect(r.items).toHaveLength(20);
  });

  it('respects the difficulty mix when the pool allows', () => {
    const big = syntheticBank(60);
    const r = assembleExam({ blueprint: BP, pool: big, count: 100, seed: 11 });
    const byQ = new Map(big.map((q) => [q.id, q]));
    const d: Record<string, number> = {};
    for (const it of r.items) { const q = byQ.get(it.questionId)!; d[q.difficulty] = (d[q.difficulty] ?? 0) + 1; }
    // Per-subdomain apportionment rounds, so allow small drift from 30/45/25.
    expect(d.foundational).toBeGreaterThanOrEqual(24);
    expect(d.foundational).toBeLessThanOrEqual(36);
    expect(d.intermediate).toBeGreaterThanOrEqual(39);
    expect(d.advanced).toBeGreaterThanOrEqual(19);
  });
});
