import { describe, it, expect } from 'vitest';
import { apportion, checkBlueprint, domainTargets, subdomainTargets, difficultyTargets, flattenSubdomains } from '../src/index.ts';
import { BP, BLUEPRINT_FILE } from './fixtures.ts';

describe('blueprint', () => {
  it('active blueprint is the 2026 FOM outline with official domain weights', () => {
    expect(BLUEPRINT_FILE.active).toBe('fom-2026');
    expect(BP.domains.map((d) => d.weight)).toEqual([28, 38, 34]);
    expect(BP.exam.questions).toBe(100);
    expect(BP.exam.minutes).toBe(150);
    const d1 = BP.domains[0]!;
    expect(d1.subdomains.map((s) => [s.id, s.weight])).toEqual([['I-A', 6], ['I-B', 3], ['I-C', 10], ['I-D', 9]]);
    expect(d1.subdomains.every((s) => s.weightOfficial)).toBe(true);
    // Sub-weights in II and III are design choices and must be labeled so.
    expect(BP.domains[1]!.subdomains.every((s) => s.weightOfficial === false)).toBe(true);
    expect(BP.domains[2]!.subdomains.every((s) => s.weightOfficial === false)).toBe(true);
  });

  it('weights are internally consistent', () => {
    expect(checkBlueprint(BP)).toEqual([]);
  });

  it('apportion sums exactly to total and respects proportions', () => {
    const r = apportion({ a: 28, b: 38, c: 34 }, 100);
    expect(r).toEqual({ a: 28, b: 38, c: 34 });
    const r2 = apportion({ a: 1, b: 1, c: 1 }, 10);
    expect(r2.a + r2.b + r2.c).toBe(10);
    expect(Object.values(r2).every((v) => v >= 3 && v <= 4)).toBe(true);
    expect(apportion({ a: 0, b: 0 }, 5)).toEqual({ a: 0, b: 0 });
  });

  it('100-question form has official domain and I-A..I-D counts', () => {
    expect(domainTargets(BP, 100)).toEqual({ I: 28, II: 38, III: 34 });
    const s = subdomainTargets(BP, 100);
    expect(s['I-A']).toBe(6);
    expect(s['I-B']).toBe(3);
    expect(s['I-C']).toBe(10);
    expect(s['I-D']).toBe(9);
    const total = Object.values(s).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    const d2 = flattenSubdomains(BP).filter((x) => x.domain === 'II').reduce((a, x) => a + (s[x.id] ?? 0), 0);
    expect(d2).toBe(38);
  });

  it('difficulty targets follow the configured mix', () => {
    expect(difficultyTargets(BP, 100)).toEqual({ foundational: 30, intermediate: 45, advanced: 25 });
  });

  it('bank targets sum to 500 and follow the weights', () => {
    const t = BP.bankTargets!;
    const sum = Object.entries(t).filter(([k]) => !k.startsWith('$')).reduce((a, [, v]) => a + (v as number), 0);
    expect(sum).toBe(500);
    expect(t['I-A']! + t['I-B']! + t['I-C']! + t['I-D']!).toBe(140);
  });
});
