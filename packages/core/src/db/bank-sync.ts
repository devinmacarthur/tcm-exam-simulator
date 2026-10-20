import type { Question } from '../types.ts';
import { transaction, type DbLike } from './dblike.ts';

/** Mirror the JSON bank into SQLite (upsert; removes rows no longer present). */
export function syncBankToDb(db: DbLike, questions: Question[]): { inserted: number; updated: number; removed: number } {
  const existing = new Set(db.prepare('SELECT id FROM questions').all().map((r) => r.id as string));
  const upsert = db.prepare(`
    INSERT INTO questions (id, domain, subdomain, task, theory, difficulty, cognitive_level, vignette, status, version, created_at, last_reviewed_at, json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain=excluded.domain, subdomain=excluded.subdomain, task=excluded.task, theory=excluded.theory,
      difficulty=excluded.difficulty, cognitive_level=excluded.cognitive_level, vignette=excluded.vignette,
      status=excluded.status, version=excluded.version, created_at=excluded.created_at,
      last_reviewed_at=excluded.last_reviewed_at, json=excluded.json`);
  const delConcepts = db.prepare('DELETE FROM question_concepts WHERE question_id = ?');
  const insConcept = db.prepare('INSERT OR IGNORE INTO question_concepts (question_id, concept) VALUES (?, ?)');
  const insStats = db.prepare('INSERT OR IGNORE INTO question_stats (question_id) VALUES (?)');
  const del = db.prepare('DELETE FROM questions WHERE id = ?');
  return transaction(db, () => {
    let inserted = 0, updated = 0, removed = 0;
    const seen = new Set<string>();
    for (const q of questions) {
      seen.add(q.id);
      upsert.run(q.id, q.domain, q.subdomain, q.task, q.theory ?? null, q.difficulty, q.cognitiveLevel, q.vignette ? 1 : 0,
        q.validation?.status ?? 'draft', q.version ?? 1, q.createdAt ?? null, q.lastReviewedAt ?? null, JSON.stringify(q));
      delConcepts.run(q.id);
      for (const c of q.concepts ?? []) insConcept.run(q.id, c);
      insStats.run(q.id);
      if (existing.has(q.id)) updated += 1; else inserted += 1;
    }
    for (const id of existing) if (!seen.has(id)) { del.run(id); removed += 1; }
    return { inserted, updated, removed };
  });
}

export function readAllQuestions(db: DbLike): Map<string, Question> {
  const m = new Map<string, Question>();
  for (const r of db.prepare('SELECT json FROM questions').all()) {
    const q = JSON.parse(r.json as string) as Question;
    m.set(q.id, q);
  }
  return m;
}
