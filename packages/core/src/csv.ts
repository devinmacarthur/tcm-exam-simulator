import type { Question } from '@fom/core';

const COLUMNS = ['id', 'domain', 'subdomain', 'task', 'theory', 'stem', 'optionA', 'optionB', 'optionC', 'optionD', 'correct', 'explanation', 'explainA', 'explainB', 'explainC', 'explainD', 'learningObjective', 'difficulty', 'cognitiveLevel', 'vignette', 'concepts', 'distinctionBetween', 'distinctionKey', 'references', 'status', 'version', 'createdAt', 'lastReviewedAt'] as const;

function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function questionsToCsv(qs: Question[]): string {
  const lines = [COLUMNS.join(',')];
  for (const q of qs) {
    lines.push([
      q.id, q.domain, q.subdomain, q.task, q.theory ?? '', q.stem, q.options.A, q.options.B, q.options.C, q.options.D, q.correct, q.explanation,
      q.distractorExplanations.A ?? '', q.distractorExplanations.B ?? '', q.distractorExplanations.C ?? '', q.distractorExplanations.D ?? '',
      q.learningObjective, q.difficulty, q.cognitiveLevel, q.vignette ? 'true' : 'false', q.concepts.join('|'),
      q.distinction?.between.join('|') ?? '', q.distinction?.key ?? '', q.references.map((r) => (r.locator ? `${r.source} — ${r.locator}` : r.source)).join('|'),
      q.validation?.status ?? 'draft', q.version ?? 1, q.createdAt ?? '', q.lastReviewedAt ?? '',
    ].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

/** Minimal RFC4180 parser. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function csvToQuestions(text: string): Question[] {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) return [];
  const idx = (name: string) => header.indexOf(name);
  const out: Question[] = [];
  for (const r of rows.slice(1)) {
    const g = (name: string) => r[idx(name)] ?? '';
    const split = (s: string) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);
    const q: Question = {
      id: g('id'), domain: g('domain') as Question['domain'], subdomain: g('subdomain'), task: g('task'), theory: g('theory') || undefined,
      stem: g('stem'), options: { A: g('optionA'), B: g('optionB'), C: g('optionC'), D: g('optionD') }, correct: g('correct') as Question['correct'],
      explanation: g('explanation'), distractorExplanations: {}, learningObjective: g('learningObjective'),
      difficulty: g('difficulty') as Question['difficulty'], cognitiveLevel: g('cognitiveLevel') as Question['cognitiveLevel'],
      vignette: g('vignette') === 'true', concepts: split(g('concepts')),
      references: split(g('references')).map((s) => { const [source, locator] = s.split(' — '); return locator ? { source: source!, locator } : { source: s }; }),
      version: Number(g('version') || 1), createdAt: g('createdAt') || undefined, lastReviewedAt: g('lastReviewedAt') || undefined,
    };
    for (const k of ['A', 'B', 'C', 'D'] as const) if (k !== q.correct && g(`explain${k}`)) q.distractorExplanations[k] = g(`explain${k}`);
    const between = split(g('distinctionBetween'));
    if (between.length >= 2) q.distinction = { between, key: g('distinctionKey') };
    const status = g('status');
    if (status) q.validation = { status: status as NonNullable<Question['validation']>['status'], passes: {} };
    out.push(q);
  }
  return out;
}
