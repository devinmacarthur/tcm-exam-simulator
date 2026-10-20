/**
 * Export the validated bank.
 *   node tools/export.ts --format json|csv [--out path] [--status ai_reviewed]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { questionsToCsv } from '@fom/core';
import { QUESTIONS, ROOT, arg, loadDir } from './lib/paths.ts';

const format = arg('format', 'json');
const status = arg('status');
let all = loadDir(QUESTIONS).flatMap((f) => f.questions);
if (status) all = all.filter((q) => (q.validation?.status ?? 'draft') === status);
const out = arg('out', join(ROOT, 'data', `fom-questions.${format}`))!;
writeFileSync(out, format === 'csv' ? questionsToCsv(all) : JSON.stringify(all, null, 2), 'utf8');
console.log(`Wrote ${all.length} questions to ${out}`);
