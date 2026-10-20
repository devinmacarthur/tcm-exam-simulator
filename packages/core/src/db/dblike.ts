/**
 * Minimal synchronous SQLite interface shared by node:sqlite (server/tools/tests) and sql.js (browser).
 * Both engines run the same SQL and the same Service code.
 */
export type SqlValue = string | number | bigint | null | Uint8Array;

export interface StatementLike {
  run(...params: SqlValue[]): unknown;
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  all(...params: SqlValue[]): Record<string, unknown>[];
}

export interface DbLike {
  exec(sql: string): void;
  prepare(sql: string): StatementLike;
}

export function transaction<T>(db: DbLike, fn: () => T): T {
  db.exec('BEGIN;');
  try {
    const out = fn();
    db.exec('COMMIT;');
    return out;
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }
}
