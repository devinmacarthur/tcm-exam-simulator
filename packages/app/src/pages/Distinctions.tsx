import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/useStore.tsx';

/** Explain the Distinction: the bank's own discriminating findings for a confused pair, plus practice on exactly those items. */
export default function Distinctions() {
  const { svc, mutate, version } = useStore();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const [query, setQuery] = useState('');
  const pairs = useMemo(() => {
    const m = new Map<string, { pair: [string, string]; count: number }>();
    for (const d of svc.distinctions()) {
      const [x, y] = [...d.between].sort() as [string, string];
      const k = `${x}|${y}`;
      m.set(k, { pair: [x, y], count: (m.get(k)?.count ?? 0) + 1 });
    }
    return [...m.values()].sort((p, q) => q.count - p.count || p.pair[0].localeCompare(q.pair[0]));
  }, [svc]);
  const confusions = useMemo(() => svc.weakness().confusions, [svc, version]);
  const items = useMemo(() => (a && b ? svc.distinctions(a, b) : []), [svc, a, b]);
  const practice = () => {
    const { attempt } = mutate((s) => s.createAttempt('study', { count: items.length, minutes: null, fidelity: false, preferUnseen: false, immediateFeedback: true, questionIds: items.map((i) => i.questionId) }));
    nav(`/attempt/${attempt.id}`);
  };
  const filtered = pairs.filter((p) => !query || p.pair.join(' ').includes(query.toLowerCase()));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-1">
        <h1 className="text-xl font-semibold">Explain the distinction</h1>
        <p className="mb-3 text-sm muted">Pick a pair of commonly confused patterns or findings. Pairs you have actually confused are listed first.</p>
        <input className="input mb-3" placeholder="Filter, e.g. spleen" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter pairs" />
        {confusions.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-2">Your confusions</div>
            <ul className="mt-1 space-y-1">
              {confusions.map((c) => <li key={c.pair.join('|')}><button className="text-left text-sm underline-offset-2 hover:underline" onClick={() => setParams({ a: c.pair[0], b: c.pair[1] })}>{c.pair[0]} vs {c.pair[1]} <span className="muted">({c.misses} missed)</span></button></li>)}
            </ul>
          </div>
        )}
        <div className="text-xs font-medium uppercase tracking-wide text-ink-2">All pairs in the bank ({pairs.length})</div>
        <ul className="mt-1 max-h-[60vh] space-y-1 overflow-y-auto">
          {filtered.map((p) => <li key={p.pair.join('|')}><button className={`text-left text-sm underline-offset-2 hover:underline ${a === p.pair[0] && b === p.pair[1] ? 'font-semibold' : ''}`} onClick={() => setParams({ a: p.pair[0], b: p.pair[1] })}>{p.pair[0]} vs {p.pair[1]} <span className="muted">({p.count})</span></button></li>)}
        </ul>
      </div>
      <div className="lg:col-span-2 space-y-4">
        {!a || !b ? <div className="card text-sm muted">Select a pair.</div> : (
          <>
            <div className="card">
              <h2 className="text-lg font-semibold">{a} <span className="muted">vs</span> {b}</h2>
              <h3 className="mt-3 text-sm font-medium">Discriminating findings</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {[...new Set(items.map((i) => i.key))].map((k) => <li key={k}>{k}</li>)}
              </ul>
              {items.length > 0 && <button className="btn btn-primary mt-4" onClick={practice}>Practice these {items.length} items</button>}
            </div>
            <div className="card">
              <h3 className="mb-2 text-sm font-medium">Worked reasoning from each item</h3>
              <ul className="divide-y divide-line">
                {items.map((i) => <li key={i.questionId} className="py-3 text-sm"><div className="muted mb-1">{i.questionId} · {i.stem}</div><div>{i.explanation}</div></li>)}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
