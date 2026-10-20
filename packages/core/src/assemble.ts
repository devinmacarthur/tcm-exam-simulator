import type { AttemptItem, BlueprintSpec, Difficulty, OptionKey, Question } from './types.ts';
import { OPTION_KEYS } from './types.ts';
import { apportion, difficultyTargets, flattenSubdomains, subdomainTargets } from './blueprint.ts';
import { createRng, type Rng } from './rng.ts';

export interface AssembleOptions {
  blueprint: BlueprintSpec;
  pool: Question[];
  count: number;
  seed: number;
  /** Prefer questions not in this set (previously seen). Falls back to seen ones when the unseen pool is short. */
  avoidIds?: Set<string>;
  /** Override difficulty mix; defaults to blueprint mix. Null = ignore difficulty entirely. */
  difficultyMix?: Partial<Record<Difficulty, number>> | null;
  /** Restrict to these subdomains (study mode); weights are renormalized among them. */
  subdomains?: string[];
  /** Shuffle final order (default true). */
  shuffleOrder?: boolean;
  /** Shuffle options within each question (default true). */
  shuffleOptions?: boolean;
}

export interface AssembleResult {
  items: AttemptItem[];
  /** Subdomain → requested vs delivered. */
  coverage: Record<string, { target: number; delivered: number }>;
  shortfall: number;
  seed: number;
}

/** Pick from `candidates` up to `n` items, preferring unseen ones, removing picked from both pools. */
function take(candidates: Question[], n: number, picked: Set<string>, avoid: Set<string> | undefined, rng: Rng): Question[] {
  const unseen = candidates.filter((q) => !picked.has(q.id) && !(avoid?.has(q.id)));
  const seen = candidates.filter((q) => !picked.has(q.id) && avoid?.has(q.id));
  const out: Question[] = [];
  for (const q of rng.shuffle(unseen)) {
    if (out.length >= n) break;
    out.push(q);
    picked.add(q.id);
  }
  if (out.length < n) {
    for (const q of rng.shuffle(seen)) {
      if (out.length >= n) break;
      out.push(q);
      picked.add(q.id);
    }
  }
  return out;
}

/**
 * Tier-balanced pick that never sacrifices "unseen" for tier balance:
 * 1) unseen items by tier, 2) unseen items of any tier, 3) seen items by tier, 4) seen items of any tier.
 */
function takeTiered(cands: Question[], target: number, tiers: Record<Difficulty, number> | null, picked: Set<string>, avoid: Set<string> | undefined, rng: Rng): Question[] {
  const unseen = avoid ? cands.filter((q) => !avoid.has(q.id)) : cands;
  const seen = avoid ? cands.filter((q) => avoid.has(q.id)) : [];
  let got: Question[] = [];
  const byTier = (pool: Question[]) => {
    if (!tiers) return;
    for (const tier of ['foundational', 'intermediate', 'advanced'] as Difficulty[]) {
      const want = tiers[tier] - got.filter((q) => q.difficulty === tier).length;
      if (want > 0) got = got.concat(take(pool.filter((q) => q.difficulty === tier), want, picked, undefined, rng));
    }
  };
  byTier(unseen);
  if (got.length < target) got = got.concat(take(unseen, target - got.length, picked, undefined, rng));
  if (got.length < target) byTier(seen);
  if (got.length < target) got = got.concat(take(seen, target - got.length, picked, undefined, rng));
  return got.slice(0, target);
}

/**
 * Build a fixed form from the pool according to the blueprint.
 * Guarantees: no duplicate question ids; subdomain targets met when the pool allows;
 * difficulty tiers approximated within each subdomain; deterministic for a seed.
 */
export function assembleExam(opts: AssembleOptions): AssembleResult {
  const { blueprint, count, seed } = opts;
  const rng = createRng(seed);
  const picked = new Set<string>();
  const all = flattenSubdomains(blueprint);
  const subIds = opts.subdomains && opts.subdomains.length > 0 ? opts.subdomains : all.map((s) => s.id);

  // Targets per subdomain (renormalized if a subset is requested).
  let targets: Record<string, number>;
  if (opts.subdomains && opts.subdomains.length > 0) {
    const weights: Record<string, number> = {};
    for (const s of all) if (subIds.includes(s.id)) weights[s.id] = s.weight;
    targets = apportion(weights, count);
  } else {
    targets = subdomainTargets(blueprint, count);
  }

  const mix = opts.difficultyMix === undefined ? (blueprint.difficultyMix ?? null) : opts.difficultyMix;
  const bySub = new Map<string, Question[]>();
  for (const q of opts.pool) {
    if (!subIds.includes(q.subdomain)) continue;
    const arr = bySub.get(q.subdomain) ?? [];
    arr.push(q);
    bySub.set(q.subdomain, arr);
  }

  const chosen: Question[] = [];
  const coverage: Record<string, { target: number; delivered: number }> = {};

  for (const subId of subIds) {
    const target = targets[subId] ?? 0;
    coverage[subId] = { target, delivered: 0 };
    if (target === 0) continue;
    const cands = bySub.get(subId) ?? [];
    const tiers = mix
      ? apportion({ foundational: mix.foundational ?? 0, intermediate: mix.intermediate ?? 0, advanced: mix.advanced ?? 0 }, target)
      : null;
    const got = takeTiered(cands, target, tiers, picked, opts.avoidIds, rng);
    coverage[subId].delivered = got.length;
    chosen.push(...got);
  }

  // Fill each domain's own shortfall from the same domain (keeps official domain weights), then anything from anywhere.
  if (chosen.length < count) {
    const domainShort = new Map<string, number>();
    for (const subId of subIds) {
      const c = coverage[subId];
      const d = all.find((s) => s.id === subId)?.domain;
      if (c && d && c.delivered < c.target) domainShort.set(d, (domainShort.get(d) ?? 0) + (c.target - c.delivered));
    }
    for (const [d, need] of domainShort) {
      const sameDomain = opts.pool.filter((q) => q.domain === d && subIds.includes(q.subdomain));
      chosen.push(...take(sameDomain, Math.min(need, count - chosen.length), picked, opts.avoidIds, rng));
    }
    if (chosen.length < count) {
      const any = opts.pool.filter((q) => subIds.includes(q.subdomain));
      chosen.push(...take(any, count - chosen.length, picked, opts.avoidIds, rng));
    }
  }

  const ordered = opts.shuffleOrder === false ? chosen : rng.shuffle(chosen);
  const items: AttemptItem[] = ordered.map((q, i) => {
    const presentedOrder = opts.shuffleOptions === false ? OPTION_KEYS.slice() : rng.shuffle(OPTION_KEYS);
    const idx = presentedOrder.indexOf(q.correct);
    const presentedCorrect = OPTION_KEYS[idx] as OptionKey;
    return { position: i + 1, questionId: q.id, presentedOrder, presentedCorrect };
  });

  // Hard guarantee: no duplicates.
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.questionId)) throw new Error(`Duplicate question in form: ${it.questionId}`);
    ids.add(it.questionId);
  }

  return { items, coverage, shortfall: Math.max(0, count - items.length), seed };
}

/** Map a presented letter back to the original option key. */
export function toOriginalKey(item: AttemptItem, presented: OptionKey): OptionKey {
  const idx = OPTION_KEYS.indexOf(presented);
  const k = item.presentedOrder[idx];
  if (!k) throw new Error(`Bad presented key ${presented}`);
  return k;
}

/** Map an original key to the presented letter. */
export function toPresentedKey(item: AttemptItem, original: OptionKey): OptionKey {
  const idx = item.presentedOrder.indexOf(original);
  const k = OPTION_KEYS[idx];
  if (!k) throw new Error(`Bad original key ${original}`);
  return k;
}
