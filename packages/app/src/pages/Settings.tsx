import { useState } from 'react';
import type { ReadinessThresholds, ValidationStatus } from '@fom/core';
import { DEFAULT_THRESHOLDS } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import { importDatabase, resetDatabase } from '../lib/store.ts';
import { Banner } from '../components/ui.tsx';

const FIELDS: { key: keyof ReadinessThresholds; label: string; pct?: boolean }[] = [
  { key: 'practiceTarget', label: 'Practice target (unseen accuracy)', pct: true },
  { key: 'foundationalFloor', label: 'Foundational floor', pct: true },
  { key: 'domainFloor', label: 'Per-domain floor', pct: true },
  { key: 'higherOrderMin', label: 'Higher-order (analysis/evaluation) minimum', pct: true },
  { key: 'minCoverage', label: 'Minimum bank coverage', pct: true },
  { key: 'maxStdev', label: 'Max stdev across recent exams (points)', pct: true },
  { key: 'minFullExams', label: 'Minimum full-length exams' },
  { key: 'recentExams', label: 'Recent exams considered' },
  { key: 'minUnseenResponses', label: 'Minimum unseen responses before assessing' },
];

export default function Settings() {
  const { svc, store, mutate, version } = useStore();
  const settings = svc.getSettings();
  const [r, setR] = useState<ReadinessThresholds>(settings.readiness);
  const [saved, setSaved] = useState(false);
  void version;
  const save = () => { mutate((s) => s.saveSettings({ readiness: r })); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const exportBackup = () => {
    const bytes = store.exportBytes();
    const blob = new Blob([bytes as BlobPart], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `fom-simulator-${new Date().toISOString().slice(0, 10)}.db`; a.click();
    URL.revokeObjectURL(url);
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    if (!confirm('Replace all local progress with this backup?')) return;
    await importDatabase(new Uint8Array(await f.arrayBuffer()));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Examination pool</h2>
        <label className="label">Minimum validation status for exam questions
          <select className="input mt-1" value={settings.examPoolMinStatus} onChange={(e) => mutate((s) => s.saveSettings({ examPoolMinStatus: e.target.value as ValidationStatus }))}>
            <option value="ai_reviewed">ai_reviewed — automated pipeline + independent blind solve (default)</option>
            <option value="human_approved">human_approved — only items signed off by a human reviewer</option>
            <option value="draft">draft — include unvalidated items (not recommended)</option>
          </select>
        </label>
        <p className="text-xs muted">Items marked needs_revision or rejected are never used.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Readiness thresholds</h2>
        <p className="text-sm muted">The readiness label is an internal study classification. Defaults are simulator design choices, not official cut scores.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="label">{f.label}
              <input className="input mt-1" type="number" step={f.pct ? 1 : 1} min={0} max={f.pct ? 100 : 1000}
                value={f.pct ? Math.round(r[f.key] * 100) : r[f.key]}
                onChange={(e) => setR({ ...r, [f.key]: f.pct ? Number(e.target.value) / 100 : Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save}>Save thresholds</button>
          <button className="btn" onClick={() => setR(DEFAULT_THRESHOLDS)}>Reset to defaults</button>
          {saved && <span className="self-center text-sm text-good">Saved</span>}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Data</h2>
        <p className="text-sm muted">All performance data lives in this browser (IndexedDB). It is not synced anywhere. Export a backup to move between devices.</p>
        {!store.persistent && <Banner kind="warn">IndexedDB is unavailable in this session; data will not survive closing the tab.</Banner>}
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportBackup}>Export backup (.db)</button>
          <label className="btn cursor-pointer">Import backup<input type="file" accept=".db,application/x-sqlite3,application/octet-stream" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} /></label>
          <button className="btn btn-danger" onClick={() => { if (confirm('Delete ALL local progress? This cannot be undone.')) void resetDatabase(); }}>Reset all progress</button>
        </div>
      </div>
    </div>
  );
}
