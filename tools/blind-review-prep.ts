/**
 * Pass 8 preparation: strip answer keys and explanations from draft items so an independent reviewer
 * (a separate model session or a human) can solve them blind.
 *   node tools/blind-review-prep.ts [--source drafts] [--out bank/reviews/blind-packets] [--batch 50]
 * Produces blind-<n>.json packets: [{ id, stem, options }]. The reviewer returns
 * [{ id, answer, confidence, concern }] which blind-review-merge.ts / validate.ts consume.
 */
import { join } from 'node:path';
import { DRAFTS, QUESTIONS, REVIEWS, arg, loadDir, writeJson } from './lib/paths.ts';

const source = arg('source', 'drafts') === 'questions' ? QUESTIONS : DRAFTS;
const outDir = arg('out', join(REVIEWS, 'blind-packets'))!;
const batch = Number(arg('batch', '50'));
const all = loadDir(source).flatMap((f) => f.questions);
let n = 0;
for (let i = 0; i < all.length; i += batch) {
  const packet = all.slice(i, i + batch).map((q) => ({ id: q.id, subdomain: q.subdomain, stem: q.stem, options: q.options }));
  n += 1;
  writeJson(join(outDir, `blind-${String(n).padStart(2, '0')}.json`), packet);
}
console.log(`Wrote ${n} blind packet(s) for ${all.length} items to ${outDir}`);
