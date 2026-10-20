import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../lib/useStore.tsx';
import { fmtDate, pct } from '../lib/time.ts';

export default function History() {
  const { svc, mutate, version } = useStore();
  const attempts = useMemo(() => svc.listAttempts({ limit: 200 }), [svc, version]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Created</th><th>Mode</th><th>Config</th><th>Status</th><th>Raw score</th><th></th></tr></thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.createdAt)}</td>
                <td>{a.mode}</td>
                <td className="text-xs muted">{a.config.count} q · {a.timeLimitS ? `${Math.round(a.timeLimitS / 60)} min` : 'untimed'}{a.mode === 'exam' ? (a.config.fidelity ? ' · fidelity' : ' · linear') : ''}{a.config.subdomains?.length ? ` · ${a.config.subdomains.join(',')}` : ''}{a.config.targeted ? ' · targeted' : ''}{a.config.srsDue ? ' · SRS' : ''}</td>
                <td>{a.status}{a.timedOut ? ' (timed out)' : ''}</td>
                <td className="tabular-nums">{a.score ? pct(a.score.rawAccuracy) : '—'}</td>
                <td className="whitespace-nowrap">
                  {a.status === 'in_progress' ? <><Link className="underline" to={`/attempt/${a.id}`}>Resume</Link> · <button className="underline" onClick={() => mutate((s) => s.abandon(a.id))}>Abandon</button></> : a.status === 'submitted' ? <Link className="underline" to={`/results/${a.id}`}>Review</Link> : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {attempts.length === 0 && <p className="text-sm muted">No sessions yet.</p>}
      </div>
    </div>
  );
}
