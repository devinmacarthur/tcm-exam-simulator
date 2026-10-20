/**
 * Promote validated drafts into the bank, or record a human approval.
 *   node tools/promote.ts                      → copies drafts with status ai_reviewed/human_approved into bank/questions/<subdomain>.json
 *   node tools/promote.ts --all                → copies every draft regardless of status (status preserved)
 *   node tools/promote.ts --approve FOM-IIf-0001 --reviewer "Name" [--note "..."]   → marks a bank item human_approved
 */
import { join } from 'node:path';
import type { Question } from '@fom/core';
import { DRAFTS, QUESTIONS, arg, flag, loadDir, writeJson } from './lib/paths.ts';

const approve = arg('approve');
if (approve) {
  const reviewer = arg('reviewer');
  if (!reviewer) { console.error('--reviewer is required'); process.exit(1); }
  const files = loadDir(QUESTIONS);
  let done = false;
  for (const f of files) {
    const i = f.questions.findIndex((q) => q.id === approve);
    if (i < 0) continue;
    const q = f.questions[i]!;
    const now = new Date().toISOString();
    q.validation = { status: 'human_approved', passes: { ...(q.validation?.passes ?? {}), factual: { ok: true, by: 'human', date: now }, coherence: { ok: true, by: 'human', date: now } }, reviewer: { name: reviewer, date: now, note: arg('note') } };
    q.lastReviewedAt = now;
    q.history = [...(q.history ?? []), { version: q.version ?? 1, date: now, note: `human_approved by ${reviewer}` }];
    writeJson(f.file, f.questions);
    console.log(`${approve} marked human_approved by ${reviewer}`);
    done = true;
  }
  if (!done) console.error(`${approve} not found in bank/questions`);
  process.exit(done ? 0 : 1);
}

const all = loadDir(DRAFTS).flatMap((f) => f.questions);
const take = flag('all') ? all : all.filter((q) => q.validation && (q.validation.status === 'ai_reviewed' || q.validation.status === 'human_approved'));
const existing = new Map<string, Question>();
for (const f of loadDir(QUESTIONS)) for (const q of f.questions) existing.set(q.id, q);
for (const q of take) {
  const prev = existing.get(q.id);
  if (prev && JSON.stringify({ ...prev, validation: undefined, lastReviewedAt: undefined }) !== JSON.stringify({ ...q, validation: undefined, lastReviewedAt: undefined })) {
    q.version = (prev.version ?? 1) + 1;
    q.history = [...(prev.history ?? []), { version: q.version, date: new Date().toISOString(), note: 'content revised from drafts' }];
  }
  existing.set(q.id, q);
}
const bySub = new Map<string, Question[]>();
for (const q of existing.values()) bySub.set(q.subdomain, [...(bySub.get(q.subdomain) ?? []), q]);
for (const [sub, qs] of bySub) writeJson(join(QUESTIONS, `${sub}.json`), qs.sort((a, b) => a.id.localeCompare(b.id)));
console.log(`Promoted ${take.length} draft(s); bank now has ${existing.size} items across ${bySub.size} subdomain files.`);
