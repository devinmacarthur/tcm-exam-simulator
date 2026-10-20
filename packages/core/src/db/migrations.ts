import type { DbLike } from './dblike.ts';

/**
 * Schema migrations, applied in order and recorded in schema_migrations.
 * The JSON files in bank/questions/ are the source of truth for questions; the `questions` table is a mirror.
 * User performance lives in separate tables and is never written into the bank.
 */
export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_init',
    sql: `
CREATE TABLE IF NOT EXISTS questions (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  subdomain       TEXT NOT NULL,
  task            TEXT NOT NULL,
  theory          TEXT,
  difficulty      TEXT NOT NULL,
  cognitive_level TEXT NOT NULL,
  vignette        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft',
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT,
  last_reviewed_at TEXT,
  json            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_sub ON questions(subdomain);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);

CREATE TABLE IF NOT EXISTS question_concepts (
  question_id TEXT NOT NULL,
  concept     TEXT NOT NULL,
  PRIMARY KEY (question_id, concept)
);
CREATE INDEX IF NOT EXISTS idx_qc_concept ON question_concepts(concept);

CREATE TABLE IF NOT EXISTS question_stats (
  question_id       TEXT PRIMARY KEY,
  usage_count       INTEGER NOT NULL DEFAULT 0,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  total_response_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attempts (
  id            TEXT PRIMARY KEY,
  mode          TEXT NOT NULL,
  blueprint_id  TEXT NOT NULL,
  config        TEXT NOT NULL,
  seed          INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'in_progress',
  created_at    TEXT NOT NULL,
  started_at    TEXT,
  submitted_at  TEXT,
  time_limit_s  INTEGER,
  deadline_at   TEXT,
  timed_out     INTEGER NOT NULL DEFAULT 0,
  score         TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_mode ON attempts(mode, status);

CREATE TABLE IF NOT EXISTS attempt_items (
  attempt_id        TEXT NOT NULL,
  position          INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  presented_order   TEXT NOT NULL,
  presented_correct TEXT NOT NULL,
  PRIMARY KEY (attempt_id, position)
);

CREATE TABLE IF NOT EXISTS responses (
  attempt_id      TEXT NOT NULL,
  position        INTEGER NOT NULL,
  question_id     TEXT NOT NULL,
  chosen          TEXT,
  chosen_original TEXT,
  correct         INTEGER,
  flagged         INTEGER NOT NULL DEFAULT 0,
  response_ms     INTEGER NOT NULL DEFAULT 0,
  answered_at     TEXT,
  first_exposure  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (attempt_id, position)
);
CREATE INDEX IF NOT EXISTS idx_responses_q ON responses(question_id);

CREATE TABLE IF NOT EXISTS srs_cards (
  question_id      TEXT PRIMARY KEY,
  ease             REAL NOT NULL,
  interval_days    INTEGER NOT NULL,
  repetitions      INTEGER NOT NULL,
  due_at           TEXT NOT NULL,
  last_reviewed_at TEXT,
  lapses           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookmarks (
  question_id TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  note        TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`,
  },
];

export function migrate(db: DbLike): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name as string));
  const ran: string[] = [];
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    db.exec('BEGIN;');
    try {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(m.name, new Date().toISOString());
      db.exec('COMMIT;');
      ran.push(m.name);
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }
  }
  return ran;
}
