import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { OptionKey } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import { StatTile, BarList, Banner } from '../components/ui.tsx';
import QuestionView, { RevealPanel } from '../components/QuestionView.tsx';
import { fmtDate, formatDuration, pct } from '../lib/time.ts';

type Filter = 'all' | 'incorrect' | 'flagged' | 'unanswered';

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { svc, mutate, version } = useStore();
  const view = useMemo(() => { try { return svc.view(id!); } catch { return null; } }, [svc, id, version]);
  const [filter, setFilter] = useState<Filter>('incorrect');
  const [open, setOpen] = useState<number | null>(null);
  if (!view) return <div>Attempt not found. <Link to="/" className="underline">Dashboard</Link></div>;
  const { attempt, items, responses } = view;
  if (attempt.status === 'in_progress') { nav(`/attempt/${attempt.id}`, { replace: true }); return null; }
  const score = attempt.score;
  const byPos = new Map(responses.map((r) => [r.position, r]));
  const rows = items.filter((it) => {
    const r = byPos.get(it.position);
    if (filter === 'incorrect') return !r?.chosen || r.correct === false;
    if (filter === 'flagged') return !!r?.flagged;
    if (filter === 'unanswered') return !r?.chosen;
    return true;
  });
  const missedIds = items.filter((it) => { const r = byPos.get(it.position); return !r?.chosen || r.correct === false; }).map((it) => it.questionId);
  const retryMissed = () => {
    const { attempt: a } = mutate((s) => s.createAttempt('study', { count: missedIds.length, minutes: null, fidelity: false, preferUnseen: false, immediateFeedback: true, questionIds: missedIds }));
    nav(`/attempt/${a.id}`);
  };
  const isBookmarked = (qid: string) => svc.isBookmarked(qid);
  const toggleBookmark = (qid: string) => mutate((s) => (s.isBookmarked(qid) ? s.removeBookmark(qid) : s.addBookmark(qid)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{attempt.mode === 'exam' ? 'Examination results' : 'Session results'}</h1>
        <p className="muted text-sm">{fmtDate(attempt.submittedAt)} · {attempt.mode}{attempt.mode === 'exam' ? (attempt.config.fidelity ? ' · fidelity mode' : ' · linear-review mode') : ''}{attempt.timedOut ? ' · time expired' : ''}</p>
      </div>
      {score && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatTile label="Raw score" value={pct(score.rawAccuracy, 1)} sub={`${score.correct} of ${score.total} correct`} />
            <StatTile label="Unanswered" value={score.unanswered} sub="scored as incorrect" />
            <StatTile label="Average time / question" value={formatDuration(score.avgResponseMs)} sub={`total ${formatDuration(score.totalResponseMs)}`} />
            <StatTile label="Flagged" value={score.flagged} />
          </div>
          <Banner kind="info">Raw percentage only. The official exam reports a scaled score (1–99, pass = 70) derived from item difficulty; that conversion is not published and is not simulated here.</Banner>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card"><BarList title="By domain" rows={score.byDomain.map((r) => ({ label: r.label, value: r.accuracy, note: `${r.correct}/${r.total}` }))} /></div>
            <div className="card"><BarList title="By difficulty" rows={score.byDifficulty.map((r) => ({ label: r.label, value: r.total ? r.accuracy : null, note: `${r.correct}/${r.total}` }))} /></div>
            <div className="card"><BarList title="By cognitive level" rows={score.byCognitiveLevel.filter((r) => r.total > 0).map((r) => ({ label: r.label, value: r.accuracy, note: `${r.correct}/${r.total}` }))} /></div>
            <div className="card"><BarList title="By subdomain" rows={score.bySubdomain.map((r) => ({ label: r.label, value: r.accuracy, note: `${r.correct}/${r.total}` }))} /></div>
          </div>
        </>
      )}

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Review</h2>
          <div className="ml-auto flex gap-1">
            {(['incorrect', 'flagged', 'unanswered', 'all'] as Filter[]).map((f) => <button key={f} className={`btn btn-sm ${filter === f ? 'border-accent' : ''}`} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
          {missedIds.length > 0 && <button className="btn btn-sm btn-primary" onClick={retryMissed}>Retry {missedIds.length} missed</button>}
        </div>
        {rows.length === 0 && <p className="text-sm muted">Nothing to show for this filter.</p>}
        <ul className="divide-y divide-line">
          {rows.map((it) => {
            const r = byPos.get(it.position);
            const chosen = (r?.chosen ?? null) as OptionKey | null;
            const state = !chosen ? 'unanswered' : r!.correct ? 'correct' : 'incorrect';
            const isOpen = open === it.position;
            return (
              <li key={it.position} className="py-3">
                <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(isOpen ? null : it.position)} aria-expanded={isOpen}>
                  <span className={`mt-0.5 w-6 text-sm font-semibold ${state === 'correct' ? 'text-good' : state === 'incorrect' ? 'text-critical' : 'text-ink-2'}`}>{state === 'correct' ? '✓' : state === 'incorrect' ? '✗' : '–'}</span>
                  <span className="flex-1 text-sm"><span className="muted mr-2">{it.position}.</span>{it.stem}</span>
                  <span className="text-xs muted whitespace-nowrap">{it.subdomain}{r?.flagged ? ' ⚑' : ''}</span>
                </button>
                {isOpen && it.reveal && (
                  <div className="mt-3 pl-9">
                    <QuestionView item={it} chosen={chosen} locked reveal={it.reveal} onChoose={() => undefined} showMeta />
                    <RevealPanel reveal={it.reveal} chosen={chosen} />
                    <div className="mt-2 flex gap-2">
                      <button className="btn btn-sm" onClick={() => toggleBookmark(it.questionId)}>{isBookmarked(it.questionId) ? '★ Bookmarked' : '☆ Bookmark'}</button>
                      {it.reveal.distinction && <Link className="btn btn-sm" to={`/distinctions?a=${encodeURIComponent(it.reveal.distinction.between[0]!)}&b=${encodeURIComponent(it.reveal.distinction.between[1]!)}`}>Explain the distinction</Link>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex gap-2"><Link to="/" className="btn">Dashboard</Link><Link to="/analytics" className="btn">Analytics</Link></div>
    </div>
  );
}
