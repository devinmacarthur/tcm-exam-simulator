/**
 * Mirror bank/questions/*.json into a SQLite database (creating it and running migrations if needed), or
 * import external questions into the bank.
 *   node tools/import-bank.ts [--db data/simulator.db] [--from path/to/file.json|csv]
 * With --from, the file's items are copied into bank/questions/imported-<name>.json after a structural
 * check (failing items are reported and skipped). They enter as `draft` unless the file carries a status;
 * run bank:validate to re-check them.
 */
import { join, basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { checkSchema, csvToQuestions, syncBankToDb, type Question } from '@fom/core';
import { openDatabase } from '../packages/server/src/db.ts';
import { loadQuestionsFromDir } from '../packages/server/src/bank.ts';
import { QUESTIONS, ROOT, arg, loadBlueprint, writeJson } from './lib/paths.ts';

const dbPath = arg('db', process.env.FOM_DB ?? join(ROOT, 'data', 'simulator.db'))!;
const from = arg('from');
if (from) {
  const { bp } = loadBlueprint();
  const text = readFileSync(from, 'utf8');
  const items: Question[] = from.endsWith('.csv') ? csvToQuestions(text) : (JSON.parse(text) as Question[]);
  const ok: Question[] = [];
  for (const q of items) {
    const issues = checkSchema(q, bp);
    if (issues.length) console.log(`skip ${q.id ?? '(no id)'}: ${issues.map((i) => i.field + ' ' + i.message).join('; ')}`);
    else ok.push({ ...q, validation: q.validation ?? { status: 'draft', passes: {} } });
  }
  const out = join(QUESTIONS, `imported-${basename(from).replace(/\.(json|csv)$/i, '')}.json`);
  writeJson(out, ok);
  console.log(`Imported ${ok.length}/${items.length} items into ${out}.`);
}
const db = openDatabase(dbPath);
const qs = loadQuestionsFromDir(QUESTIONS);
const r = syncBankToDb(db, qs);
console.log(`DB ${dbPath}: ${qs.length} questions mirrored (inserted ${r.inserted}, updated ${r.updated}, removed ${r.removed})`);
db.close();
