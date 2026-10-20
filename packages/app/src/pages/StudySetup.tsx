import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Difficulty } from '@fom/core';
import { flattenSubdomains } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import { Banner } from '../components/ui.tsx';
import { proportionalMinutes } from '../lib/time.ts';

type Source = 'blueprint' | 'targeted' | 'missed' | 'srs' | 'bookmarked';

export default function StudySetup() {
  const { svc, mutate, version } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const subs = useMemo(() => flattenSubdomains(svc.bp), [svc]);
  const audit = useMemo(() => svc.audit('ai_reviewed'), [svc, version]);
  const missed = useMemo(() => svc.missedQuestionIds(), [svc, version]);
  const due = useMemo(() => svc.dueCards().length, [svc, version]);
  const bookmarks = useMemo(() => svc.listBookmarks().length, [svc, version]);
  const [source, setSource] = useState<Source>((params.get('source') as Source) || 'blueprint');
  const [selected, setSelected] = useState<Set<string>>(new Set(params.get('sub') ? [params.get('sub')!] : []));
  const [diffs, setDiffs] = useState<Set<Difficulty>>(new Set());
  const [count, setCount] = useState(20);
  const [timed, setTimed] = useState(false);
  const [feedback, setFeedback] = useState(true);
  const [preferUnseen, setPreferUnseen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleDomain = (d: string) => {
    const ids = subs.filter((s) => s.domain === d).map((s) => s.id);
    setSelected((s) => { const n = new Set(s); const all = ids.every((i) => n.has(i)); for (const i of ids) { if (all) n.delete(i); else n.add(i); } return n; });
  };
  const toggleDiff = (d: Difficulty) => setDiffs((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });

  const start = () => {
    try {
      const minutes = timed ? proportionalMinutes(count, svc.bp.exam.questions, svc.bp.exam.minutes) : null;
      const base = { count, minutes, fidelity: false, preferUnseen, immediateFeedback: feedback, difficulties: diffs.size ? [...diffs] : undefined };
      const r = mutate((s) => {
        if (source === 'targeted') return s.createAttempt('targeted', { ...base, preferUnseen: false, targeted: true });
        if (source === 'missed') return s.createAttempt('study', { ...base, preferUnseen: false, questionIds: missed });
        if (source === 'srs') return s.createAttempt('review', { ...base, preferUnseen: false, srsDue: true });
        if (source === 'bookmarked') return s.createAttempt('study', { ...base, preferUnseen: false, bookmarked: true });
        return s.createAttempt('study', { ...base, subdomains: selected.size ? [...selected] : undefined });
      });
      nav(`/attempt/${r.attempt.id}`);
    } catch (e) { setError((e as Error).message); }
  };

  const have = (id: string) => audit.bySubdomain[id] ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Study session</h1>
        <p className="muted text-sm">Immediate feedback, explanations for every option, references, and the Explain-the-Distinction panel.</p>
      </div>
      {error && <Banner kind="critical">{error}</Banner>}

      <div className="card space-y-4">
        <div className="label">Question source</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ['blueprint', 'By topic', 'Blueprint-balanced across the topics you select (all topics if none)'],
            ['targeted', 'Targeted (weak areas)', 'Previously missed items, then unseen items on weak concepts'],
            ['missed', `Retry missed (${missed.length})`, 'Every question whose last answer was wrong'],
            ['srs', `Spaced review (${due} due)`, 'Cards due today under the SM-2 schedule'],
            ['bookmarked', `Bookmarked (${bookmarks})`, 'Questions you bookmarked during review'],
          ] as [Source, string, string][]).map(([v, l, d]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${source === v ? 'border-accent bg-accent-soft' : 'border-line'}`}>
              <input type="radio" name="source" className="mt-1" checked={source === v} onChange={() => setSource(v)} />
              <span><span className="font-medium">{l}</span><br /><span className="text-sm muted">{d}</span></span>
            </label>
          ))}
        </div>
      </div>

      {source === 'blueprint' && (
        <div className="card">
          <div className="mb-3 flex items-center justify-between"><div className="label">Topics</div><button className="btn btn-sm" onClick={() => setSelected(new Set())}>Clear</button></div>
          <div className="grid gap-4 md:grid-cols-3">
            {svc.bp.domains.map((d) => (
              <div key={d.id}>
                <button className="mb-1 text-sm font-semibold underline-offset-2 hover:underline" onClick={() => toggleDomain(d.id)}>{d.id}. {d.name} ({d.weight}%)</button>
                <ul className="space-y-1">
                  {d.subdomains.map((s) => (
                    <li key={s.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                        <span className="flex-1">{s.id} {s.name}</span>
                        <span className="text-xs muted tabular-nums">{have(s.id)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="label">Questions<input className="input mt-1" type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} /></label>
          <div className="label">Difficulty<div className="mt-2 flex flex-wrap gap-3 text-sm font-normal">
            {(['foundational', 'intermediate', 'advanced'] as Difficulty[]).map((d) => <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={diffs.has(d)} onChange={() => toggleDiff(d)} />{d}</label>)}
          </div><span className="text-xs muted font-normal">None checked = blueprint mix</span></div>
          <div className="label">Options<div className="mt-2 space-y-1 text-sm font-normal">
            <label className="flex items-center gap-2"><input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} />Immediate feedback</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />Timed at exam pace (1.5 min/question)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={preferUnseen} onChange={(e) => setPreferUnseen(e.target.checked)} disabled={source !== 'blueprint'} />Prefer unseen</label>
          </div></div>
        </div>
        <div className="flex justify-end border-t border-line pt-4"><button className="btn btn-primary" onClick={start}>Start session</button></div>
      </div>
    </div>
  );
}
