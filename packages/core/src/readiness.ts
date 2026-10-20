import type { DomainId } from './types.ts';

/**
 * Transparent readiness model. Labels are INTERNAL STUDY CLASSIFICATIONS, not a prediction of the
 * official pass/fail outcome; the official exam reports a scaled score whose conversion is unpublished.
 */
export type ReadinessLabel =
  | 'Needs foundational review'
  | 'Developing competency'
  | 'Approaching practice target'
  | 'Consistently meeting practice target';

export interface ReadinessThresholds {
  /** Raw practice target on unseen questions (0..1). Default 0.75 — a SIMULATOR DESIGN CHOICE, not an official cut score. */
  practiceTarget: number;
  /** Below this unseen accuracy the label is "Needs foundational review". */
  foundationalFloor: number;
  /** Minimum full-length exams required for the top label. */
  minFullExams: number;
  /** Maximum stdev across recent full exams for "consistent". */
  maxStdev: number;
  /** Minimum accuracy on analysis/evaluation items for the top label. */
  higherOrderMin: number;
  /** Minimum fraction of the eligible bank seen at least once for the top label. */
  minCoverage: number;
  /** Minimum unseen responses before the model reports anything beyond "insufficient data". */
  minUnseenResponses: number;
  /** Every domain must reach this for the top label. */
  domainFloor: number;
  /** How many recent full exams to consider. */
  recentExams: number;
}

export const DEFAULT_THRESHOLDS: ReadinessThresholds = {
  practiceTarget: 0.75,
  foundationalFloor: 0.55,
  minFullExams: 3,
  maxStdev: 0.06,
  higherOrderMin: 0.7,
  minCoverage: 0.6,
  minUnseenResponses: 50,
  domainFloor: 0.65,
  recentExams: 5,
};

export interface ReadinessInput {
  unseenAccuracy: number | null;       // accuracy on first exposures
  unseenCount: number;
  domainAccuracy: Partial<Record<DomainId, number | null>>;
  fullExamScores: number[];            // raw accuracy per completed full exam, oldest→newest
  fullExamCompletedInTime: boolean[];  // same length
  higherOrderAccuracy: number | null;  // analysis + evaluation
  coverage: number;                    // 0..1 of eligible bank seen
}

export interface ReadinessResult {
  label: ReadinessLabel | 'Insufficient data';
  reasons: string[];
  metrics: {
    unseenAccuracy: number | null;
    recentMean: number | null;
    recentStdev: number | null;
    domainMin: number | null;
    higherOrderAccuracy: number | null;
    coverage: number;
    fullExams: number;
    completedInTime: number;
  };
  thresholds: ReadinessThresholds;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function stdev(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function assessReadiness(input: ReadinessInput, t: ReadinessThresholds = DEFAULT_THRESHOLDS): ReadinessResult {
  const recent = input.fullExamScores.slice(-t.recentExams);
  const recentTime = input.fullExamCompletedInTime.slice(-t.recentExams);
  const recentMean = mean(recent);
  const recentStdev = stdev(recent);
  const domainVals = Object.values(input.domainAccuracy).filter((v): v is number => typeof v === 'number');
  const domainMin = domainVals.length ? Math.min(...domainVals) : null;
  const metrics = {
    unseenAccuracy: input.unseenAccuracy,
    recentMean,
    recentStdev,
    domainMin,
    higherOrderAccuracy: input.higherOrderAccuracy,
    coverage: input.coverage,
    fullExams: input.fullExamScores.length,
    completedInTime: recentTime.filter(Boolean).length,
  };
  const reasons: string[] = [];

  if (input.unseenAccuracy === null || input.unseenCount < t.minUnseenResponses) {
    reasons.push(`Need at least ${t.minUnseenResponses} responses on unseen questions (have ${input.unseenCount}).`);
    return { label: 'Insufficient data', reasons, metrics, thresholds: t };
  }

  const u = input.unseenAccuracy;
  if (u < t.foundationalFloor) {
    reasons.push(`Unseen-question accuracy ${(u * 100).toFixed(0)}% is below the foundational floor of ${(t.foundationalFloor * 100).toFixed(0)}%.`);
    return { label: 'Needs foundational review', reasons, metrics, thresholds: t };
  }

  const meetsTarget = u >= t.practiceTarget;
  const enoughExams = recent.length >= t.minFullExams;
  const consistent = enoughExams && recentStdev !== null && recentStdev <= t.maxStdev && recent.every((s) => s >= t.practiceTarget);
  const inTime = enoughExams && recentTime.every(Boolean);
  const higher = input.higherOrderAccuracy !== null && input.higherOrderAccuracy >= t.higherOrderMin;
  const domainsOk = domainMin !== null && domainMin >= t.domainFloor;
  const covered = input.coverage >= t.minCoverage;

  if (!meetsTarget) {
    reasons.push(`Unseen-question accuracy ${(u * 100).toFixed(0)}% is below the practice target of ${(t.practiceTarget * 100).toFixed(0)}%.`);
    if (domainMin !== null && !domainsOk) reasons.push(`Weakest domain is at ${(domainMin * 100).toFixed(0)}% (floor ${(t.domainFloor * 100).toFixed(0)}%).`);
    return { label: 'Developing competency', reasons, metrics, thresholds: t };
  }

  const blockers: string[] = [];
  if (!enoughExams) blockers.push(`Only ${recent.length} full-length exam(s) completed; need ${t.minFullExams}.`);
  else {
    if (!consistent) blockers.push(`Recent full exams are not consistently at or above ${(t.practiceTarget * 100).toFixed(0)}% (stdev ${recentStdev === null ? 'n/a' : (recentStdev * 100).toFixed(1) + ' pts'}).`);
    if (!inTime) blockers.push('At least one recent full exam was not completed within the official 150-minute limit.');
  }
  if (!higher) blockers.push(`Higher-order (analysis/evaluation) accuracy ${input.higherOrderAccuracy === null ? 'unknown' : (input.higherOrderAccuracy * 100).toFixed(0) + '%'} is below ${(t.higherOrderMin * 100).toFixed(0)}%.`);
  if (!domainsOk) blockers.push(`Weakest domain is at ${domainMin === null ? 'n/a' : (domainMin * 100).toFixed(0) + '%'} (floor ${(t.domainFloor * 100).toFixed(0)}%).`);
  if (!covered) blockers.push(`Only ${(input.coverage * 100).toFixed(0)}% of the bank has been seen; need ${(t.minCoverage * 100).toFixed(0)}%.`);

  if (blockers.length === 0) {
    reasons.push('Unseen accuracy, full-exam consistency, timing, higher-order reasoning, domain floors, and coverage all meet the configured thresholds.');
    return { label: 'Consistently meeting practice target', reasons, metrics, thresholds: t };
  }
  reasons.push(`Unseen-question accuracy ${(u * 100).toFixed(0)}% meets the practice target.`);
  reasons.push(...blockers);
  return { label: 'Approaching practice target', reasons, metrics, thresholds: t };
}
