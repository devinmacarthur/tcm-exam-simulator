/**
 * Question-bank audit report.
 *   node tools/audit.ts [--source questions|drafts] [--json] [--minStatus ai_reviewed]
 */
import { auditBank, type ValidationStatus } from '@fom/core';
import { DRAFTS, QUESTIONS, arg, flag, loadBlueprint, loadDir } from './lib/paths.ts';

const source = arg('source', 'questions') === 'drafts' ? DRAFTS : QUESTIONS;
const { bp } = loadBlueprint();
const all = loadDir(source).flatMap((f) => f.questions);
const report = auditBank(all, bp, (arg('minStatus', 'ai_reviewed') as ValidationStatus));

if (flag('json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const line = (k: string, v: unknown) => console.log(`${k.padEnd(34)} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  console.log(`=== Question bank audit (${source}) ===`);
  line('Total questions', report.total);
  line('By status', report.byStatus);
  line('By domain', report.byDomain);
  line('By subdomain', report.bySubdomain);
  line('By difficulty', report.byDifficulty);
  line('By cognitive level', report.byCognitiveLevel);
  line('Answer-key balance', report.answerKeyBalance);
  line('Exam pool (eligible)', report.examPoolSize);
  line('Unvalidated (not ai_reviewed+)', `${report.unvalidated.length}${report.unvalidated.length ? ': ' + report.unvalidated.slice(0, 20).join(', ') + (report.unvalidated.length > 20 ? ' …' : '') : ''}`);
  line('Missing explanations', report.missingExplanations.length ? report.missingExplanations.join(', ') : 0);
  line('Missing distractor explanations', report.missingDistractorExplanations.length ? report.missingDistractorExplanations.join(', ') : 0);
  line('Missing references', report.missingReferences.length ? report.missingReferences.join(', ') : 0);
  line('Missing learning objective', report.missingLearningObjective.length ? report.missingLearningObjective.join(', ') : 0);
  console.log(`Duplicate candidates (${report.duplicateCandidates.length}):`);
  for (const d of report.duplicateCandidates.slice(0, 40)) console.log(`  ${d.a} ~ ${d.b}  ${(d.similarity * 100).toFixed(0)}% (${d.reason})`);
  console.log(`Ambiguity warnings (${report.ambiguityWarnings.length}):`);
  for (const w of report.ambiguityWarnings.slice(0, 60)) console.log(`  ${w.id}  ${w.code}: ${w.detail}`);
  console.log(`Blueprint gaps vs bank targets (${report.blueprintGaps.length}):`);
  for (const g of report.blueprintGaps) console.log(`  ${g.subdomain.padEnd(6)} target ${g.target}  have ${g.have}  eligible ${g.eligible}`);
  console.log(`Exam-pool gaps for a 100-item form (${report.examPoolGaps.length}):`);
  for (const g of report.examPoolGaps) console.log(`  ${g.subdomain.padEnd(6)} need ${g.need}  eligible ${g.eligible}`);
}
