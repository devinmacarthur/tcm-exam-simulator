import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Question, ValidationStatus } from '@fom/core';
import { OPTION_KEYS, flattenSubdomains, questionsToCsv } from '@fom/core';
import { useStore } from '../lib/useStore.tsx';
import { Modal, Banner } from '../components/ui.tsx';
import { pct } from '../lib/time.ts';

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Bank() {
  const { svc, mutate, version } = useStore();
  const [params, setParams] = useSearchParams();
  const audit = useMemo(() => svc.audit(), [svc, version]);
  const subs = useMemo(() => flattenSubdomains(svc.bp), [svc]);
  const stats = useMemo(() => svc.stats(), [svc, version]);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [sub, setSub] = useState(params.get('sub') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [diff, setDiff] = useState('');
  const concept = params.get('concept') ?? '';
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const all = useMemo(() => [...svc.questions.values()], [svc]);
  const list = all.filter((x) => (!sub || x.subdomain === sub) && (!status || (x.validation?.status ?? 'draft') === status) && (!diff || x.difficulty === diff) && (!concept || x.concepts.includes(concept)) && (!q || x.stem.toLowerCase().includes(q.toLowerCase()) || x.id.toLowerCase().includes(q.toLowerCase()))).slice(0, 300);
  const openQ = openId ? svc.questions.get(openId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Question bank</h1>
          <p className="muted text-sm">{audit.total} questions · {audit.examPoolSize} in the exam pool · statuses: {Object.entries(audit.byStatus).map(([k, v]) => `${k} ${v}`).join(', ')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => setShowAudit(true)}>Audit report</button>
          <button className="btn btn-sm" onClick={() => download('fom-questions.json', JSON.stringify(all, null, 2), 'application/json')}>Export JSON</button>
          <button className="btn btn-sm" onClick={() => download('fom-questions.csv', questionsToCsv(all), 'text/csv')}>Export CSV</button>
        </div>
      </div>
      <Banner kind="info">Validation statuses: <strong>ai_reviewed</strong> = passed the automated pipeline and an independent blind solve by a separate model session; <strong>human_approved</strong> = signed off by a named human reviewer (set with the promote tool); <strong>draft</strong> / <strong>needs_revision</strong> are excluded from exams. No item is represented as professionally validated unless a human reviewer is recorded on it.</Banner>

      <div className="card grid gap-3 md:grid-cols-5">
        <input className="input md:col-span-2" placeholder="Search stem or id" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input" value={sub} onChange={(e) => setSub(e.target.value)} aria-label="Subdomain"><option value="">All subdomains</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.id} {s.name}</option>)}</select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option>{['draft', 'needs_revision', 'ai_reviewed', 'human_approved', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select className="input" value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty"><option value="">All difficulties</option>{['foundational', 'intermediate', 'advanced'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {concept && <div className="md:col-span-5 text-sm">Concept filter: <span className="tag">{concept}</span> <button className="btn btn-sm ml-2" onClick={() => setParams({})}>clear</button></div>}
      </div>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Id</th><th>Sub</th><th>Stem</th><th>Diff.</th><th>Level</th><th>Status</th><th>Used</th><th>Correct rate</th><th>Avg time</th></tr></thead>
          <tbody>
            {list.map((x) => {
              const st = stats.get(x.id);
              return (
                <tr key={x.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setOpenId(x.id)}>
                  <td className="whitespace-nowrap font-mono text-xs">{x.id}</td><td>{x.subdomain}</td><td className="max-w-md truncate">{x.stem}</td><td>{x.difficulty}</td><td>{x.cognitiveLevel}</td><td><span className="tag">{x.validation?.status ?? 'draft'}</span></td>
                  <td className="tabular-nums">{st?.usageCount ?? 0}</td><td className="tabular-nums">{st && st.usageCount ? pct(st.correctCount / st.usageCount) : '—'}</td><td className="tabular-nums">{st && st.usageCount ? `${Math.round(st.totalResponseMs / st.usageCount / 1000)}s` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 300 && <p className="mt-2 text-xs muted">Showing the first 300 matches.</p>}
      </div>

      <Modal open={!!openQ} onClose={() => setOpenId(null)} title={openQ?.id ?? ''}>
        {openQ && <QuestionDetail q={openQ} bookmarked={svc.isBookmarked(openQ.id)} onBookmark={() => mutate((s) => (s.isBookmarked(openQ.id) ? s.removeBookmark(openQ.id) : s.addBookmark(openQ.id)))} />}
      </Modal>

      <Modal open={showAudit} onClose={() => setShowAudit(false)} title="Question-bank audit">
        <div className="space-y-3 text-sm">
          <Row k="Total" v={audit.total} /><Row k="Exam pool (eligible)" v={audit.examPoolSize} />
          <Row k="By domain" v={JSON.stringify(audit.byDomain)} /><Row k="By difficulty" v={JSON.stringify(audit.byDifficulty)} /><Row k="By cognitive level" v={JSON.stringify(audit.byCognitiveLevel)} /><Row k="Answer-key balance" v={JSON.stringify(audit.answerKeyBalance)} />
          <Row k="Unvalidated" v={audit.unvalidated.length} /><Row k="Missing explanations" v={audit.missingExplanations.length} /><Row k="Missing distractor explanations" v={audit.missingDistractorExplanations.length} /><Row k="Missing references" v={audit.missingReferences.length} />
          <Row k="Duplicate candidates" v={audit.duplicateCandidates.length ? audit.duplicateCandidates.slice(0, 20).map((d) => `${d.a}~${d.b} (${pct(d.similarity)}, ${d.reason})`).join('; ') : 0} />
          <Row k="Ambiguity warnings" v={audit.ambiguityWarnings.length ? audit.ambiguityWarnings.slice(0, 30).map((w) => `${w.id} ${w.code}`).join('; ') : 0} />
          <Row k="Blueprint gaps (bank targets)" v={audit.blueprintGaps.length ? audit.blueprintGaps.map((g) => `${g.subdomain} ${g.have}/${g.target}`).join(', ') : 'none'} />
          <Row k="Exam-pool gaps (100-item form)" v={audit.examPoolGaps.length ? audit.examPoolGaps.map((g) => `${g.subdomain} ${g.eligible}/${g.need}`).join(', ') : 'none'} />
        </div>
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  return <div className="grid grid-cols-[14rem_1fr] gap-2 border-b border-line py-1"><span className="font-medium">{k}</span><span className="break-words">{String(v)}</span></div>;
}

export function QuestionDetail({ q, bookmarked, onBookmark }: { q: Question; bookmarked: boolean; onBookmark: () => void }) {
  const v = q.validation;
  const passes = v?.passes ?? {};
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2 text-xs"><span className="tag">{q.domain} / {q.subdomain} / {q.task}</span>{q.theory && <span className="tag">{q.theory}</span>}<span className="tag">{q.difficulty}</span><span className="tag">{q.cognitiveLevel}</span><span className="tag">{v?.status ?? 'draft'}</span><span className="tag">v{q.version ?? 1}</span></div>
      <p className="stem">{q.stem}</p>
      <ul className="space-y-1">{OPTION_KEYS.map((k) => <li key={k} className={k === q.correct ? 'font-semibold text-good' : ''}><span className="mr-2 inline-block w-5">{k}.</span>{q.options[k]}</li>)}</ul>
      <p><span className="font-medium">Explanation:</span> {q.explanation}</p>
      <ul className="space-y-1">{OPTION_KEYS.filter((k) => k !== q.correct).map((k) => <li key={k}><span className="mr-2 inline-block w-5 font-medium">{k}.</span>{q.distractorExplanations[k]}</li>)}</ul>
      {q.distinction && <p><span className="font-medium">Distinction ({q.distinction.between.join(' vs ')}):</span> {q.distinction.key}</p>}
      <p><span className="font-medium">Objective:</span> {q.learningObjective}</p>
      <p><span className="font-medium">Concepts:</span> {q.concepts.join(', ')}</p>
      <p><span className="font-medium">References:</span> {q.references.map((r) => (r.locator ? `${r.source} — ${r.locator}` : r.source)).join('; ')}</p>
      <div>
        <div className="font-medium">Validation passes</div>
        <table className="data"><tbody>{(Object.keys(passes) as (keyof typeof passes)[]).map((p) => { const r = passes[p]!; return <tr key={p}><td>{p}</td><td>{r.ok ? '✓' : '✗'}</td><td>{r.by}</td><td className="muted">{r.note ?? ''}</td></tr>; })}</tbody></table>
        {v?.reviewer && <p className="mt-1">Human reviewer: {v.reviewer.name} ({v.reviewer.date}){v.reviewer.note ? ` — ${v.reviewer.note}` : ''}</p>}
        {!v?.reviewer && <p className="mt-1 muted">No human reviewer recorded.</p>}
      </div>
      {q.history && q.history.length > 0 && <p className="muted">History: {q.history.map((h) => `v${h.version} ${h.date.slice(0, 10)} ${h.note}`).join(' · ')}</p>}
      <p className="muted text-xs">Created {q.createdAt?.slice(0, 10) ?? '—'} · last reviewed {q.lastReviewedAt?.slice(0, 10) ?? '—'}</p>
      <button className="btn btn-sm" onClick={onBookmark}>{bookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
    </div>
  );
}

export type { ValidationStatus };
