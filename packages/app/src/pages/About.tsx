import { useStore } from '../lib/useStore.tsx';

export default function About() {
  const { svc } = useStore();
  const bp = svc.bp;
  return (
    <div className="mx-auto max-w-3xl space-y-6 text-sm">
      <h1 className="text-2xl font-semibold">About this simulator</h1>
      <div className="card space-y-2">
        <h2 className="font-semibold">Target examination</h2>
        <p>NCBAHM™ (formerly NCCAOM®) <strong>Foundations of Oriental Medicine</strong> module, {bp.name}. Source: <a className="underline" href={bp.source} target="_blank" rel="noreferrer">official content outline PDF</a>.</p>
        <p>This is not the NCBTMB massage-therapy board exam, which has no TCM foundations module. The brief's "NCBTMB" reference was a mix-up between two boards; see <code>docs/EXAM-SPEC.md</code> in the repository for the full verification with citations.</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">What is official vs. simulator design</h2>
        <table className="data">
          <thead><tr><th>Feature</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>100 questions, 150 minutes, four-option multiple choice</td><td>Official (2026 Candidate Preparation Handbook)</td></tr>
            <tr><td>Domain weights {bp.domains.map((d) => `${d.id} ${d.weight}%`).join(', ')}; I-A 6%, I-B 3%, I-C 10%, I-D 9%</td><td>Official (2026 content outline, effective 2026-09-01)</td></tr>
            <tr><td>Sub-weights inside Domains II and III</td><td>Simulator design choice (none published)</td></tr>
            <tr><td>Fidelity mode: forward-only, no answer changes, all items must be answered</td><td>Official rule of the computer-adaptive format</td></tr>
            <tr><td>Linear-review mode with navigator, flags, revisable answers</td><td>Simulator convenience; not how the real exam works</td></tr>
            <tr><td>Adaptive item selection (CAT)</td><td>Not simulated; fixed randomized forms balanced by difficulty tier</td></tr>
            <tr><td>Scaled score 1–99, passing 70</td><td>Official, but the conversion is unpublished; only raw percentages are shown here</td></tr>
            <tr><td>Pretest (unscored) items</td><td>Official feature, count unpublished; not simulated</td></tr>
            <tr><td>Readiness labels</td><td>Internal study classification with configurable thresholds; not a pass prediction</td></tr>
          </tbody>
        </table>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">Question bank</h2>
        <p>All items are original and were written against the task statements of the 2026 outline using the official bibliography's terminology (Maciocia, Cheng Xinnong, Deng Tietao, Kastner, Wiseman & Ellis). No official sample items or third-party practice questions are reproduced.</p>
        <p>Every item carries a validation record. <strong>ai_reviewed</strong> means it passed automated structural checks and an independent blind solve by a separate model session that agreed with the key and raised no coherence concern. <strong>human_approved</strong> is set only when a named human reviewer signs off. Items are not represented as professionally validated unless a reviewer is recorded.</p>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold">Privacy</h2>
        <p>Everything runs in your browser. Performance data is stored locally (IndexedDB) and never transmitted. Use Settings to export or import a backup.</p>
      </div>
    </div>
  );
}
