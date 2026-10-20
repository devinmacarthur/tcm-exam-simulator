/**
 * Validation pipeline runner.
 *   node tools/validate.ts [--source drafts|questions] [--write] [--reviews bank/reviews]
 *
 * Runs the automated passes (schema, uniqueness, distractors, relevance, difficulty, duplication) and,
 * when blind-solve review files exist, Pass 8 (independent answer review). With --write it updates the
 * validation block in place. Status is never promoted to human_approved here.
 */
import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { runPipeline, type Question } from '@fom/core';
import { DRAFTS, QUESTIONS, REVIEWS, arg, flag, loadBlueprint, loadDir, writeJson } from './lib/paths.ts';

export interface BlindSolveRecord { id: string; answer: string; confidence?: string; concern?: string; by?: string }

export function loadBlindSolves(dir = REVIEWS): Map<string, BlindSolveRecord> {
  const m = new Map<string, BlindSolveRecord>();
  if (!existsSync(dir)) return m;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const arr = JSON.parse(readFileSync(join(dir, f), 'utf8')) as BlindSolveRecord[];
    for (const r of arr) if (r && r.id && r.answer) m.set(r.id, r);
  }
  return m;
}

export function validateAll(questions: Question[], blind: Map<string, BlindSolveRecord>) {
  const { bp } = loadBlueprint();
  return runPipeline(questions, { bp, blindSolves: blind });
}

if (process.argv[1] && process.argv[1].endsWith('validate.ts')) {
  const source = arg('source', 'drafts') === 'questions' ? QUESTIONS : DRAFTS;
  const write = flag('write');
  const blind = loadBlindSolves(arg('reviews', REVIEWS));
  const files = loadDir(source);
  const all = files.flatMap((f) => f.questions);
  const outcomes = validateAll(all, blind);
  const byId = new Map(outcomes.map((o) => [o.question.id, o]));
  const counts: Record<string, number> = {};
  let failing = 0;
  for (const o of outcomes) {
    const s = o.question.validation!.status;
    counts[s] = (counts[s] ?? 0) + 1;
    if (o.issues.length) {
      failing += 1;
      console.log(`✗ ${o.question.id} [${s}]`);
      for (const i of o.issues) console.log(`    - ${i}`);
    }
  }
  console.log(`\n${all.length} items checked; ${failing} with issues; blind-solve records: ${blind.size}`);
  console.log('Status counts:', counts);
  if (write) {
    for (const f of files) {
      const updated = f.questions.map((q) => byId.get(q.id)!.question);
      writeJson(f.file, updated);
    }
    console.log(`Wrote validation blocks back to ${files.length} file(s) in ${source}`);
  }
}
