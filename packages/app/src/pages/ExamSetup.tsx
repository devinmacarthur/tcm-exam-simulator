import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/useStore.tsx';
import { Banner } from '../components/ui.tsx';
import { proportionalMinutes } from '../lib/time.ts';

export default function ExamSetup() {
  const { svc, mutate, version } = useStore();
  const nav = useNavigate();
  const bp = svc.bp;
  const audit = useMemo(() => svc.audit(), [svc, version]);
  const settings = svc.getSettings();
  const [count, setCount] = useState(bp.exam.questions);
  const [minutes, setMinutes] = useState<number>(bp.exam.minutes);
  const [timed, setTimed] = useState(true);
  const [fidelity, setFidelity] = useState(true);
  const [preferUnseen, setPreferUnseen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setCountAndTime = (n: number) => { setCount(n); setMinutes(proportionalMinutes(n, bp.exam.questions, bp.exam.minutes)); };
  const start = () => {
    try {
      const { attempt, shortfall } = mutate((s) => s.createAttempt('exam', { count, minutes: timed ? minutes : null, fidelity, preferUnseen, immediateFeedback: false }));
      if (shortfall > 0 && !confirm(`Only ${count - shortfall} eligible questions could be assembled. Start anyway?`)) { mutate((s) => s.abandon(attempt.id)); return; }
      nav(`/attempt/${attempt.id}`);
    } catch (e) { setError((e as Error).message); }
  };

  const official = count === bp.exam.questions && timed && minutes === bp.exam.minutes && fidelity;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configure examination</h1>
        <p className="muted text-sm">Official form: {bp.exam.questions} questions, {bp.exam.minutes} minutes, domain weights {bp.domains.map((d) => `${d.id} ${d.weight}%`).join(' · ')}.</p>
      </div>
      <Banner kind="info">
        Eligible exam pool: <strong>{audit.examPoolSize}</strong> questions at status “{settings.examPoolMinStatus}” or better.
        {settings.examPoolMinStatus !== 'human_approved' && ' These items passed the automated pipeline and an independent AI blind-solve; they have not been reviewed by a licensed practitioner. Change the floor in Settings.'}
      </Banner>
      {error && <Banner kind="critical">{error}</Banner>}

      <div className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Number of questions
            <input className="input mt-1" type="number" min={5} max={Math.max(5, audit.examPoolSize)} value={count} onChange={(e) => setCountAndTime(Math.max(5, Number(e.target.value) || 5))} />
            <span className="text-xs muted">Distribution follows the blueprint at any length.</span>
          </label>
          <label className="label">Time limit (minutes)
            <input className="input mt-1" type="number" min={1} value={minutes} disabled={!timed} onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))} />
            <span className="text-xs muted">Official pace is 1.5 minutes per question.</span>
          </label>
        </div>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={timed} onChange={(e) => setTimed(e.target.checked)} /><span><span className="font-medium">Timed</span><br /><span className="text-sm muted">Auto-submits when time expires.</span></span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={fidelity} onChange={(e) => setFidelity(e.target.checked)} />
          <span><span className="font-medium">Fidelity mode (official rules)</span><br />
            <span className="text-sm muted">Forward-only. Each answer locks when you continue; no navigator, no flags, no end-of-exam review. This matches NCBAHM's computer-adaptive format, where candidates cannot return to or change previous answers. Unchecking enables a conventional linear-review interface, which is a simulator convenience and not how the real exam behaves.</span></span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={preferUnseen} onChange={(e) => setPreferUnseen(e.target.checked)} /><span><span className="font-medium">Prefer unseen questions</span><br /><span className="text-sm muted">Falls back to seen questions only when a subdomain runs short.</span></span></label>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm">{official ? <span className="text-good">✓ Official length, time, and rules</span> : <span className="muted">Custom configuration (not the official form)</span>}</span>
          <button className="btn btn-primary" onClick={start} disabled={audit.examPoolSize === 0}>Start examination</button>
        </div>
      </div>

      <div className="card text-sm">
        <h2 className="mb-2 font-semibold">During the examination</h2>
        <ul className="list-disc space-y-1 pl-5 muted">
          <li>No answers, hints, explanations, statistics, or references are shown until you submit.</li>
          <li>Progress is saved locally after every answer; refreshing the page resumes where you left off.</li>
          <li>Unanswered questions score as incorrect. Results report raw percentages only; NCBAHM's scaled-score conversion is not public and is not simulated.</li>
          <li>Adaptive item selection (CAT) is not simulated. Each form is a fixed, randomized set balanced by domain and difficulty.</li>
        </ul>
      </div>
    </div>
  );
}
