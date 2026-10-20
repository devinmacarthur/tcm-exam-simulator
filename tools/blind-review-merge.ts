/**
 * Pass 8 merge: compare blind-solve answers with the keys and print disagreements.
 *   node tools/blind-review-merge.ts [--source drafts] [--reviews bank/reviews]
 */
import { DRAFTS, QUESTIONS, REVIEWS, arg, loadDir } from './lib/paths.ts';
import { loadBlindSolves } from './validate.ts';

const source = arg('source', 'drafts') === 'questions' ? QUESTIONS : DRAFTS;
const blind = loadBlindSolves(arg('reviews', REVIEWS));
const all = loadDir(source).flatMap((f) => f.questions);
let agree = 0, disagree = 0, missing = 0, concerns = 0;
for (const q of all) {
  const r = blind.get(q.id);
  if (!r) { missing += 1; continue; }
  if (r.answer.toUpperCase() === q.correct) agree += 1;
  else { disagree += 1; console.log(`DISAGREE ${q.id}: key ${q.correct}, solver ${r.answer}${r.confidence ? ` (${r.confidence})` : ''}${r.concern ? ` — ${r.concern}` : ''}`); }
  if (r.concern && r.concern.trim()) { concerns += 1; if (r.answer.toUpperCase() === q.correct) console.log(`CONCERN  ${q.id}: ${r.concern}`); }
}
console.log(`\nagree ${agree}  disagree ${disagree}  concerns ${concerns}  no-review ${missing}  (of ${all.length})`);
