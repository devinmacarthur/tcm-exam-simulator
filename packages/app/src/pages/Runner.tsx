import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import type { AttemptResponse, OptionKey, PresentedItem, Reveal } from '@fom/core';
import { OPTION_KEYS } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import QuestionView, { RevealPanel } from '../components/QuestionView.tsx';
import Timer from '../components/Timer.tsx';
import { Modal } from '../components/ui.tsx';

/**
 * Shared runner for exam / study / targeted / review attempts.
 *  - Fidelity mode (official CAT rules): forward-only, answer locks when you advance, no review panel.
 *  - Linear-review mode (simulator design choice): navigation grid, flags, revisable answers, review before submit.
 *  - Study mode: immediate feedback after each answer.
 */
export default function Runner() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { svc, mutate, version } = useStore();
  const view = useMemo(() => { try { return svc.view(id!); } catch { return null; } }, [svc, id, version]);
  const [pos, setPos] = useState<number>(() => {
    try { return Number(sessionStorage.getItem(`fom-pos-${id}`) ?? 1) || 1; } catch { return 1; }
  });
  const [reveals, setReveals] = useState<Record<number, Reveal>>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef<number>(Date.now());

  useEffect(() => { shownAt.current = Date.now(); try { sessionStorage.setItem(`fom-pos-${id}`, String(pos)); } catch { /* ignore */ } }, [pos, id]);

  const attempt = view?.attempt;
  const items = view?.items ?? [];
  const responses = useMemo(() => { const m = new Map<number, AttemptResponse>(); for (const r of view?.responses ?? []) m.set(r.position, r); return m; }, [view]);
  const isExam = attempt?.mode === 'exam';
  const fidelity = !!attempt?.config.fidelity;
  const immediate = !!attempt?.config.immediateFeedback && !isExam;
  const total = items.length;
  const current = items.find((i) => i.position === pos) ?? items[0];
  const curResp = current ? responses.get(current.position) : undefined;
  const curReveal = current && curResp?.chosen ? (reveals[current.position] ?? current.reveal ?? null) : null;

  const elapsed = () => { const d = Date.now() - shownAt.current; shownAt.current = Date.now(); return d; };

  const finish = useCallback((timedOut: boolean) => {
    if (!attempt) return;
    try {
      mutate((s) => s.submit(attempt.id, { timedOut }));
      nav(`/results/${attempt.id}`, { replace: true });
    } catch (e) { setError((e as Error).message); }
  }, [attempt, mutate, nav]);

  const onExpire = useCallback(() => finish(true), [finish]);

  const choose = (k: OptionKey) => {
    if (!attempt || !current) return;
    if (fidelity && curResp?.chosen) return; // locked
    if (immediate && curReveal) return;     // already revealed
    try {
      const r = mutate((s) => s.respond(attempt.id, current.position, { chosen: k, responseMs: elapsed() }));
      if (r.reveal) setReveals((x) => ({ ...x, [current.position]: r.reveal! }));
      setError(null);
    } catch (e) { setError((e as Error).message); }
  };
  const toggleFlag = () => {
    if (!attempt || !current || fidelity) return;
    mutate((s) => s.respond(attempt.id, current.position, { flagged: !curResp?.flagged, responseMs: 0 }));
  };
  const go = (p: number) => {
    if (!attempt || !current) return;
    if (p < 1 || p > total) return;
    // Credit time spent on the current item even when leaving it unanswered.
    const d = elapsed();
    if (d > 300) mutate((s) => s.respond(attempt.id, current.position, { responseMs: d }));
    setPos(p);
  };
  const next = () => {
    if (!current) return;
    if (fidelity) {
      if (!curResp?.chosen) { setError('Select an answer to continue. The official exam does not allow unanswered or skipped questions.'); return; }
      if (current.position === total) { setConfirmSubmit(true); return; }
      setConfirmLock(false);
      go(current.position + 1);
      return;
    }
    if (current.position === total) setConfirmSubmit(true); else go(current.position + 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (confirmSubmit || confirmLock) return;
      const k = e.key.toUpperCase();
      if (['1', '2', '3', '4'].includes(k)) choose(OPTION_KEYS[Number(k) - 1]!);
      else if (['A', 'B', 'C', 'D'].includes(k)) choose(k as OptionKey);
      else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' && !fidelity) { e.preventDefault(); go((current?.position ?? 1) - 1); }
      else if (k === 'F' && !fidelity) toggleFlag();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!view || !attempt || !current) return <div className="p-8">Attempt not found. <Link to="/" className="underline">Back to dashboard</Link></div>;
  if (attempt.status !== 'in_progress') { nav(`/results/${attempt.id}`, { replace: true }); return null; }

  const answered = [...responses.values()].filter((r) => r.chosen).length;
  const unanswered = total - answered;
  const flaggedCount = [...responses.values()].filter((r) => r.flagged).length;
  const modeLabel = isExam ? (fidelity ? 'Full exam · fidelity mode' : 'Full exam · linear-review mode') : attempt.mode === 'targeted' ? 'Targeted practice' : attempt.mode === 'review' ? 'Spaced review' : 'Study session';

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2 text-sm">
          <span className="font-medium">{modeLabel}</span>
          <span className="muted">Question {current.position} of {total}</span>
          {!fidelity && <span className="muted">{answered} answered · {flaggedCount} flagged</span>}
          <span className="ml-auto"><Timer deadlineAt={attempt.deadlineAt} onExpire={onExpire} /></span>
          {!isExam && <button className="btn btn-sm" onClick={() => { if (confirm('End this session now? Answered items will be scored.')) finish(false); }}>End session</button>}
        </div>
        <div className="h-1 w-full bg-surface-2" aria-hidden="true"><div className="h-full" style={{ width: `${(current.position / total) * 100}%`, background: 'var(--series-1)' }} /></div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-6">
        <section className="min-w-0 flex-1" aria-labelledby="qhead">
          <h1 id="qhead" className="sr-only">Question {current.position}</h1>
          <QuestionView item={current} chosen={curResp?.chosen ?? null} locked={fidelity ? !!curResp?.chosen && false : false} reveal={immediate ? curReveal : null} onChoose={choose} showMeta={!isExam} />
          {immediate && curReveal && <RevealPanel reveal={curReveal} chosen={curResp?.chosen ?? null} />}
          {error && <div role="alert" className="mt-4 rounded border border-critical bg-critical/10 px-3 py-2 text-sm">{error}</div>}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {!fidelity && <button className="btn" onClick={() => go(current.position - 1)} disabled={current.position === 1}>← Previous</button>}
            {!fidelity && <button className={`btn ${curResp?.flagged ? 'border-warn bg-warn/20' : ''}`} onClick={toggleFlag} aria-pressed={!!curResp?.flagged}>⚑ {curResp?.flagged ? 'Flagged' : 'Flag for review'}</button>}
            {fidelity && curResp?.chosen && current.position < total && (
              <span className="text-xs muted">Your answer locks when you continue.</span>
            )}
            <button className="btn btn-primary ml-auto" onClick={next}>
              {current.position === total ? (isExam ? 'Finish exam' : 'Finish') : 'Next →'}
            </button>
          </div>
          <p className="mt-3 text-xs muted">Keys: 1–4 or A–D select · Enter / → next{!fidelity ? ' · ← previous · F flag' : ''}</p>
        </section>

        {!fidelity && (
          <aside className="hidden w-56 flex-shrink-0 md:block" aria-label="Question navigator">
            <div className="sticky top-16 card p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-2">Navigator</div>
              <div className="grid grid-cols-5 gap-1">
                {items.map((it) => {
                  const r = responses.get(it.position);
                  const state = r?.chosen ? 'answered' : 'unanswered';
                  return (
                    <button key={it.position} onClick={() => go(it.position)} aria-label={`Question ${it.position}, ${state}${r?.flagged ? ', flagged' : ''}`} aria-current={it.position === current.position ? 'true' : undefined}
                      className={`h-8 rounded border text-xs tabular-nums ${it.position === current.position ? 'border-accent ring-2 ring-accent' : 'border-line'} ${r?.chosen ? 'bg-surface-2' : 'bg-surface'} ${r?.flagged ? 'border-warn' : ''}`}>
                      {it.position}{r?.flagged ? '⚑' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-xs muted">{unanswered} unanswered</div>
              <button className="btn btn-sm mt-3 w-full" onClick={() => setConfirmSubmit(true)}>Review & submit</button>
            </div>
          </aside>
        )}
      </div>

      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title={isExam ? 'Submit examination?' : 'Finish session?'}>
        <div className="space-y-3 text-sm">
          <p>{answered} of {total} answered{unanswered > 0 ? `, ${unanswered} unanswered` : ''}{flaggedCount ? `, ${flaggedCount} flagged` : ''}.</p>
          {unanswered > 0 && <p className="text-critical">Unanswered questions are scored as incorrect. The official exam requires every question to be answered.</p>}
          {!fidelity && unanswered > 0 && (
            <div className="flex flex-wrap gap-1">
              {items.filter((i) => !responses.get(i.position)?.chosen).map((i) => <button key={i.position} className="btn btn-sm" onClick={() => { setConfirmSubmit(false); go(i.position); }}>Go to {i.position}</button>)}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn" onClick={() => setConfirmSubmit(false)}>Keep working</button>
            <button className="btn btn-primary" onClick={() => finish(false)}>Submit</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export type { PresentedItem };
