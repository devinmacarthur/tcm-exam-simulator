import type { ReactNode } from 'react';
import { pct } from '../lib/time.ts';

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs muted">{sub}</div>}
    </div>
  );
}

/** Horizontal bar list — one hue, thin marks, direct labels (no legend needed for a single series). */
export function BarList({ rows, max = 1, format = (v: number) => pct(v), title }: { rows: { label: string; value: number | null; note?: string }[]; max?: number; format?: (v: number) => string; title?: string }) {
  return (
    <div role="figure" aria-label={title}>
      {title && <div className="mb-2 text-sm font-medium">{title}</div>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3 text-sm" title={r.note}>
            <span className="truncate">{r.label}</span>
            <span className="h-2 overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
              <span className="block h-full rounded-sm" style={{ width: `${r.value === null ? 0 : Math.min(100, (r.value / max) * 100)}%`, background: 'var(--series-1)' }} />
            </span>
            <span className="w-14 text-right tabular-nums text-ink-2">{r.value === null ? '—' : format(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single-series line chart with hover tooltip (SVG). */
export function LineChart({ points, title, yFormat = (v: number) => pct(v), target }: { points: { x: string; y: number; label: string }[]; title: string; yFormat?: (v: number) => string; target?: number }) {
  const W = 640, H = 200, P = { l: 44, r: 16, t: 12, b: 28 };
  const n = points.length;
  if (n === 0) return <div className="text-sm muted">No data yet.</div>;
  const xs = (i: number) => P.l + (n === 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const ys = (v: number) => P.t + (1 - v) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(' ');
  return (
    <figure aria-label={title} className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" role="img">
        <title>{title}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={ys(g)} y2={ys(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={P.l - 6} y={ys(g) + 4} textAnchor="end" fontSize={11} fill="var(--ink-2)">{yFormat(g)}</text>
          </g>
        ))}
        {target !== undefined && <line x1={P.l} x2={W - P.r} y1={ys(target)} y2={ys(target)} stroke="var(--ink-3)" strokeDasharray="4 4" strokeWidth={1} />}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs(i)} cy={ys(p.y)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            <circle cx={xs(i)} cy={ys(p.y)} r={12} fill="transparent"><title>{p.label}: {yFormat(p.y)}</title></circle>
            {(n <= 8 || i === n - 1) && <text x={xs(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-2)">{p.x}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="text-xs muted">{title}{target !== undefined ? ` · dashed line = practice target ${pct(target)}` : ''}</figcaption>
    </figure>
  );
}

export function Banner({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'critical' | 'good'; children: ReactNode }) {
  const cls = { info: 'border-accent bg-accent-soft', warn: 'border-warn bg-warn/15', critical: 'border-critical bg-critical/10', good: 'border-good bg-good/10' }[kind];
  const icon = { info: 'ℹ', warn: '⚠', critical: '⛔', good: '✓' }[kind];
  return <div className={`rounded-md border px-4 py-3 text-sm ${cls}`}><span aria-hidden="true" className="mr-2">{icon}</span>{children}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="card mt-8 w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-sm" onClick={onClose} autoFocus>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
