import { Link, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useStore } from '../lib/useStore.tsx';
import { StatTile, Banner } from '../components/ui.tsx';
import { fmtDate, pct, proportionalMinutes } from '../lib/time.ts';
import ReadinessCard from '../components/ReadinessCard.tsx';

export default function Dashboard() {
  const { svc, mutate, version } = useStore();
  const nav = useNavigate();
  const ov = useMemo(() => svc.overview(), [svc, version]);
  const inProgress = useMemo(() => svc.listAttempts({ status: 'in_progress', limit: 5 }), [svc, version]);
  const recent = useMemo(() => svc.listAttempts({ status: 'submitted', limit: 6 }), [svc, version]);
  const bank = useMemo(() => svc.audit(), [svc, version]);
  const due = ov.srs.due;

  const startFull = () => {
    const { attempt } = mutate((s) => s.createAttempt('exam', { count: s.bp.exam.questions, minutes: s.bp.exam.minutes, fidelity: true, preferUnseen: true, immediateFeedback: false }));
    nav(`/attempt/${attempt.id}`);
  };
  const startQuick = (count: number) => {
    const { attempt } = mutate((s) => s.createAttempt('study', { count, minutes: proportionalMinutes(count, s.bp.exam.questions, s.bp.exam.minutes), fidelity: false, preferUnseen: true, immediateFeedback: true }));
    nav(`/attempt/${attempt.id}`);
  };
  const startTargeted = () => {
    const { attempt } = mutate((s) => s.createAttempt('targeted', { count: 20, minutes: null, fidelity: false, preferUnseen: false, immediateFeedback: true, targeted: true }));
    nav(`/attempt/${attempt.id}`);
  };
  const startReview = () => {
    const { attempt } = mutate((s) => s.createAttempt('review', { count: Math.min(30, due), minutes: null, fidelity: false, preferUnseen: false, immediateFeedback: true, srsDue: true }));
    nav(`/attempt/${attempt.id}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="muted text-sm">NCBAHM Foundations of Oriental Medicine · 2026 content outline (effective 2026-09-01) · 100 questions / 150 minutes</p>
      </div>

      {bank.examPoolSize === 0 && <Banner kind="warn">The exam pool is empty: no questions meet the minimum validation status ({ov.settings.examPoolMinStatus}). Lower it in Settings or validate the bank.</Banner>}
      {bank.examPoolGaps.length > 0 && bank.examPoolSize > 0 && <Banner kind="warn">Some subdomains cannot fill their share of a 100-question form from the eligible pool ({bank.examPoolGaps.map((g) => `${g.subdomain}: ${g.eligible}/${g.need}`).join(', ')}). Forms are filled from the same domain instead.</Banner>}

      {inProgress.length > 0 && (
        <Banner kind="info">
          You have {inProgress.length} session{inProgress.length > 1 ? 's' : ''} in progress.{' '}
          {inProgress.map((a) => <Link key={a.id} to={`/attempt/${a.id}`} className="ml-2 underline">Resume {a.mode} from {fmtDate(a.createdAt)}</Link>)}
        </Banner>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Unseen-question accuracy" value={pct(ov.totals.unseenAccuracy)} sub={`${ov.totals.unseenResponses} first exposures`} />
        <StatTile label="Overall practice accuracy" value={pct(ov.totals.accuracy)} sub={`${ov.totals.responses} responses`} />
        <StatTile label="Bank coverage" value={`${ov.coverage.seen} / ${ov.coverage.eligible}`} sub={`${ov.coverage.unseen} eligible questions never seen`} />
        <StatTile label="Spaced review due" value={due} sub={`${ov.srs.total} cards · ${ov.srs.mature} mature`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Start</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="card text-left hover:border-accent" onClick={startFull} disabled={bank.examPoolSize === 0}>
              <div className="font-semibold">Full-length examination</div>
              <div className="text-sm muted">100 questions · 150 minutes · official domain weights · fidelity mode (no going back)</div>
            </button>
            <Link to="/exam" className="card text-left hover:border-accent">
              <div className="font-semibold">Configure an exam</div>
              <div className="text-sm muted">Linear-review mode, shorter forms, custom timing</div>
            </Link>
            <button className="card text-left hover:border-accent" onClick={() => startQuick(20)}>
              <div className="font-semibold">Quick 20 (study mode)</div>
              <div className="text-sm muted">Blueprint-balanced, unseen first, immediate feedback</div>
            </button>
            <Link to="/study" className="card text-left hover:border-accent">
              <div className="font-semibold">Study session</div>
              <div className="text-sm muted">Pick topics, difficulty, count; untimed by default</div>
            </Link>
            <button className="card text-left hover:border-accent" onClick={startTargeted} disabled={ov.totals.responses === 0}>
              <div className="font-semibold">Targeted practice</div>
              <div className="text-sm muted">Previously missed items and weak concepts first</div>
            </button>
            <button className="card text-left hover:border-accent" onClick={startReview} disabled={due === 0}>
              <div className="font-semibold">Spaced review ({due} due)</div>
              <div className="text-sm muted">SM-2 schedule from your answer history</div>
            </button>
          </div>
        </div>
        <ReadinessCard readiness={ov.readiness} />
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <Link to="/history" className="text-sm underline">All history</Link>
        </div>
        {recent.length === 0 ? <p className="text-sm muted">No completed sessions yet.</p> : (
          <table className="data">
            <thead><tr><th>When</th><th>Mode</th><th>Items</th><th>Raw score</th><th>Timed out</th><th></th></tr></thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.submittedAt)}</td>
                  <td>{a.mode}{a.mode === 'exam' ? (a.config.fidelity ? ' (fidelity)' : ' (linear)') : ''}</td>
                  <td>{a.score?.total}</td>
                  <td className="tabular-nums">{pct(a.score?.rawAccuracy)}</td>
                  <td>{a.timedOut ? 'yes' : 'no'}</td>
                  <td><Link to={`/results/${a.id}`} className="underline">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
