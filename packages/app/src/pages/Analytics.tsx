import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { flattenSubdomains } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import { StatTile, BarList, LineChart } from '../components/ui.tsx';
import ReadinessCard from '../components/ReadinessCard.tsx';
import { fmtDate, formatDuration, pct } from '../lib/time.ts';

export default function Analytics() {
  const { svc, version } = useStore();
  const ov = useMemo(() => svc.overview(), [svc, version]);
  const subs = useMemo(() => flattenSubdomains(svc.bp), [svc]);
  const subName = (id: string) => subs.find((s) => s.id === id)?.name ?? id;
  const examPoints = ov.recentExams.map((e) => ({ x: e.submittedAt ? new Date(e.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '', y: e.accuracy, label: `${fmtDate(e.submittedAt)} · ${e.count} items${e.timedOut ? ' · timed out' : ''}` }));
  const allPoints = ov.timeline.slice(-30).map((e) => ({ x: e.submittedAt ? new Date(e.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '', y: e.accuracy, label: `${fmtDate(e.submittedAt)} · ${e.mode} · ${e.count} items` }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Performance analytics</h1>
      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Overall accuracy" value={pct(ov.totals.accuracy)} sub={`${ov.totals.responses} graded responses`} />
        <StatTile label="Unseen vs seen" value={`${pct(ov.totals.unseenAccuracy)} / ${pct(ov.totals.seenAccuracy)}`} sub="first exposure vs repeats — a gap suggests memorization" />
        <StatTile label="Average time" value={formatDuration(ov.totals.avgResponseMs)} sub="per answered question (official pace 1m 30s)" />
        <StatTile label="Flagged" value={ov.totals.flagged} sub="across all linear-mode sessions" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold">Full-length examination history</h2>
          <LineChart points={examPoints} title="Raw score per completed exam, oldest to newest" target={ov.settings.readiness.practiceTarget} />
          {ov.recentExams.length > 0 && (
            <table className="data mt-4">
              <thead><tr><th>When</th><th>Items</th><th>Raw</th>{svc.bp.domains.map((d) => <th key={d.id}>{d.id}</th>)}<th>In time</th><th></th></tr></thead>
              <tbody>
                {[...ov.recentExams].reverse().map((e) => (
                  <tr key={e.id}>
                    <td>{fmtDate(e.submittedAt)}</td><td>{e.count}</td><td className="tabular-nums">{pct(e.accuracy)}</td>
                    {svc.bp.domains.map((d) => { const r = e.byDomain.find((x) => x.key === d.id); return <td key={d.id} className="tabular-nums">{r ? pct(r.accuracy) : '—'}</td>; })}
                    <td>{e.timedOut ? '✗' : '✓'}</td><td><Link className="underline" to={`/results/${e.id}`}>Review</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <ReadinessCard readiness={ov.readiness} detailed />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card"><BarList title="Accuracy by domain" rows={svc.bp.domains.map((d) => ({ label: `${d.id}. ${d.name}`, value: ov.byDomain[d.id]?.accuracy ?? null, note: ov.byDomain[d.id] ? `${ov.byDomain[d.id]!.correct}/${ov.byDomain[d.id]!.attempts}` : 'no data' }))} /></div>
        <div className="card"><BarList title="Accuracy by difficulty" rows={['foundational', 'intermediate', 'advanced'].map((d) => ({ label: d, value: ov.byDifficulty[d]?.accuracy ?? null, note: ov.byDifficulty[d] ? `${ov.byDifficulty[d]!.correct}/${ov.byDifficulty[d]!.attempts}` : 'no data' }))} /></div>
        <div className="card"><BarList title="Accuracy by cognitive level" rows={['recall', 'comprehension', 'application', 'analysis', 'evaluation'].map((d) => ({ label: d, value: ov.byCognitive[d]?.accuracy ?? null, note: ov.byCognitive[d] ? `${ov.byCognitive[d]!.correct}/${ov.byCognitive[d]!.attempts}` : 'no data' }))} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Frequently missed concepts</h2>
          {ov.weakConcepts.length === 0 ? <p className="text-sm muted">No weak concepts detected yet (needs at least 2 attempts per concept with accuracy ≤ 70%).</p> : (
            <table className="data"><thead><tr><th>Concept</th><th>Misses</th><th>Accuracy</th><th></th></tr></thead>
              <tbody>{ov.weakConcepts.map((c) => <tr key={c.concept}><td>{c.concept}</td><td>{c.misses}/{c.attempts}</td><td className="tabular-nums">{pct(c.accuracy)}</td><td><Link className="underline" to={`/bank?concept=${encodeURIComponent(c.concept)}`}>items</Link></td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">Confusion pairs</h2>
          {ov.confusions.length === 0 ? <p className="text-sm muted">No confusion patterns yet. These appear when you miss items that test a specific distinction.</p> : (
            <table className="data"><thead><tr><th>Pair</th><th>Misses</th><th></th></tr></thead>
              <tbody>{ov.confusions.map((c) => <tr key={c.pair.join('|')}><td>{c.pair[0]} <span className="muted">vs</span> {c.pair[1]}</td><td>{c.misses}/{c.attempts}</td><td><Link className="underline" to={`/distinctions?a=${encodeURIComponent(c.pair[0])}&b=${encodeURIComponent(c.pair[1])}`}>Explain</Link></td></tr>)}</tbody></table>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-lg font-semibold">By subdomain</h2>
          <BarList rows={ov.bySubdomain.map((s) => ({ label: `${s.concept} ${subName(s.concept)}`, value: s.attempts ? s.accuracy : null, note: `${s.attempts - s.misses}/${s.attempts}` }))} />
        </div>
        <div className="card space-y-4">
          <div>
            <h2 className="mb-2 text-lg font-semibold">Coverage and spaced repetition</h2>
            <table className="data"><tbody>
              <tr><td>Eligible questions seen</td><td className="tabular-nums">{ov.coverage.seen} / {ov.coverage.eligible} ({pct(ov.coverage.eligible ? ov.coverage.seen / ov.coverage.eligible : 0)})</td></tr>
              <tr><td>Never seen</td><td className="tabular-nums">{ov.coverage.unseen}</td></tr>
              <tr><td>SRS cards (due / learning / young / mature)</td><td className="tabular-nums">{ov.srs.due} / {ov.srs.learning} / {ov.srs.young} / {ov.srs.mature}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">All sessions (last 30)</h3>
            <LineChart points={allPoints} title="Raw accuracy per session, all modes" />
          </div>
        </div>
      </div>
    </div>
  );
}
