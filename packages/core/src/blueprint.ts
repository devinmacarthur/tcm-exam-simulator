import type { BlueprintFile, BlueprintSpec, Difficulty, DomainId, SubdomainSpec } from './types.ts';

export interface FlatSubdomain extends SubdomainSpec {
  domain: DomainId;
  domainName: string;
}

export function activeBlueprint(file: BlueprintFile): BlueprintSpec {
  const bp = file.blueprints[file.active];
  if (!bp) throw new Error(`Blueprint '${file.active}' not found`);
  return bp;
}

export function flattenSubdomains(bp: BlueprintSpec): FlatSubdomain[] {
  const out: FlatSubdomain[] = [];
  for (const d of bp.domains) {
    for (const s of d.subdomains) out.push({ ...s, domain: d.id, domainName: d.name });
  }
  return out;
}

export function subdomainIds(bp: BlueprintSpec): string[] {
  return flattenSubdomains(bp).map((s) => s.id);
}

export function domainOfSubdomain(bp: BlueprintSpec, subdomainId: string): DomainId | undefined {
  return flattenSubdomains(bp).find((s) => s.id === subdomainId)?.domain;
}

/** Check that weights are internally consistent. Returns a list of problems (empty = OK). */
export function checkBlueprint(bp: BlueprintSpec): string[] {
  const problems: string[] = [];
  const domainSum = bp.domains.reduce((a, d) => a + d.weight, 0);
  if (Math.abs(domainSum - 100) > 0.01) problems.push(`Domain weights sum to ${domainSum}, expected 100`);
  for (const d of bp.domains) {
    if (d.subdomains.length === 0) continue;
    const s = d.subdomains.reduce((a, x) => a + x.weight, 0);
    if (Math.abs(s - d.weight) > 0.05) problems.push(`Subdomain weights of ${d.id} sum to ${s.toFixed(2)}, expected ${d.weight}`);
  }
  const ids = new Set<string>();
  for (const s of flattenSubdomains(bp)) {
    if (ids.has(s.id)) problems.push(`Duplicate subdomain id ${s.id}`);
    ids.add(s.id);
  }
  if (bp.difficultyMix) {
    const m = bp.difficultyMix;
    const sum = (m.foundational ?? 0) + (m.intermediate ?? 0) + (m.advanced ?? 0);
    if (Math.abs(sum - 100) > 0.01) problems.push(`difficultyMix sums to ${sum}, expected 100`);
  }
  return problems;
}

/**
 * Largest-remainder (Hamilton) apportionment of `total` seats across weighted buckets.
 * Guarantees the result sums to exactly `total` and each bucket with weight>0 and total large enough is represented proportionally.
 */
export function apportion<K extends string>(weights: Record<K, number>, total: number): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const wsum = keys.reduce((a, k) => a + Math.max(0, weights[k]), 0);
  const result = {} as Record<K, number>;
  if (wsum <= 0 || total <= 0) {
    for (const k of keys) result[k] = 0;
    return result;
  }
  const quotas = keys.map((k) => ({ k, q: (Math.max(0, weights[k]) / wsum) * total }));
  let assigned = 0;
  for (const { k, q } of quotas) {
    result[k] = Math.floor(q);
    assigned += result[k];
  }
  const remainders = quotas
    .map(({ k, q }) => ({ k, r: q - Math.floor(q) }))
    .sort((a, b) => b.r - a.r || String(a.k).localeCompare(String(b.k)));
  let i = 0;
  while (assigned < total && remainders.length > 0) {
    const r = remainders[i % remainders.length]!;
    result[r.k] += 1;
    assigned += 1;
    i += 1;
  }
  return result;
}

/** Target number of items per subdomain for an exam of `n` questions. */
export function subdomainTargets(bp: BlueprintSpec, n: number): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const s of flattenSubdomains(bp)) weights[s.id] = s.weight;
  return apportion(weights, n);
}

export function domainTargets(bp: BlueprintSpec, n: number): Record<DomainId, number> {
  const weights = {} as Record<DomainId, number>;
  for (const d of bp.domains) weights[d.id] = d.weight;
  return apportion(weights, n);
}

export function difficultyTargets(bp: BlueprintSpec, n: number): Record<Difficulty, number> {
  const mix = bp.difficultyMix ?? { foundational: 30, intermediate: 45, advanced: 25 };
  return apportion(
    { foundational: mix.foundational ?? 0, intermediate: mix.intermediate ?? 0, advanced: mix.advanced ?? 0 },
    n,
  );
}
