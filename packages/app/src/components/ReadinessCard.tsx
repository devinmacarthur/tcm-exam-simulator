import type { ReadinessResult } from '@fom/core';
import { pct } from '../lib/time.ts';

const COLOR: Record<string, string> = {
  'Insufficient data': 'text-ink-2',
  'Needs foundational review': 'text-critical',
  'Developing competency': 'text-serious',
  'Approaching practice target': 'text-warn',
  'Consistently meeting practice target': 'text-good',
};
const ICON: Record<string, string> = {
  'Insufficient data': '◌',
  'Needs foundational review': '▲',
  'Developing competency': '◆',
  'Approaching practice target': '●',
  'Consistently meeting practice target': '✓',
};

export default function ReadinessCard({ readiness, detailed }: { readiness: ReadinessResult; detailed?: boolean }) {
  const m = readiness.metrics;
  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Readiness (study classification)</h2>
      <div className={`mt-2 text-xl font-semibold ${COLOR[readiness.label]}`}><span aria-hidden="true" className="mr-2">{ICON[readiness.label]}</span>{readiness.label}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {readiness.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      {detailed && (
        <table className="data mt-3">
          <tbody>
            <tr><td>Unseen accuracy</td><td className="tabular-nums">{pct(m.unseenAccuracy)}</td><td className="muted">target {pct(readiness.thresholds.practiceTarget)}</td></tr>
            <tr><td>Recent full exams</td><td className="tabular-nums">{m.fullExams}</td><td className="muted">need {readiness.thresholds.minFullExams}</td></tr>
            <tr><td>Recent mean / stdev</td><td className="tabular-nums">{pct(m.recentMean)} / {m.recentStdev === null ? '—' : (m.recentStdev * 100).toFixed(1) + ' pts'}</td><td className="muted">stdev ≤ {(readiness.thresholds.maxStdev * 100).toFixed(0)} pts</td></tr>
            <tr><td>Completed in time</td><td className="tabular-nums">{m.completedInTime} / {Math.min(m.fullExams, readiness.thresholds.recentExams)}</td><td className="muted">all recent</td></tr>
            <tr><td>Higher-order accuracy</td><td className="tabular-nums">{pct(m.higherOrderAccuracy)}</td><td className="muted">≥ {pct(readiness.thresholds.higherOrderMin)}</td></tr>
            <tr><td>Weakest domain (unseen)</td><td className="tabular-nums">{pct(m.domainMin)}</td><td className="muted">≥ {pct(readiness.thresholds.domainFloor)}</td></tr>
            <tr><td>Bank coverage</td><td className="tabular-nums">{pct(m.coverage)}</td><td className="muted">≥ {pct(readiness.thresholds.minCoverage)}</td></tr>
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs muted">Internal classification from raw practice data with configurable thresholds. Not a prediction of the official scaled score or pass/fail outcome.</p>
    </div>
  );
}
