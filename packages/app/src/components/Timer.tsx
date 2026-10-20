import { useEffect, useRef, useState } from 'react';
import { formatClock, msRemaining } from '../lib/time.ts';

export default function Timer({ deadlineAt, onExpire }: { deadlineAt: string | null; onExpire: () => void }) {
  const [ms, setMs] = useState(() => msRemaining(deadlineAt));
  const fired = useRef(false);
  useEffect(() => {
    if (!deadlineAt) return;
    const tick = () => {
      const r = msRemaining(deadlineAt);
      setMs(r);
      if (r !== null && r <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadlineAt, onExpire]);
  if (ms === null) return <span className="text-sm muted">Untimed</span>;
  const low = ms < 5 * 60_000;
  return (
    <span role="timer" aria-live={low ? 'polite' : 'off'} className={`font-mono text-base tabular-nums ${low ? 'font-semibold text-critical' : ''}`} title="Time remaining">
      ⏱ {formatClock(ms)}
    </span>
  );
}
