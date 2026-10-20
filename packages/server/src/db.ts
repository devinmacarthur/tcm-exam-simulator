import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrate, type DbLike, type SqlValue } from '@fom/core';

/** node:sqlite adapter for the shared DbLike interface. */
export class NodeDb implements DbLike {
  raw: DatabaseSync;
  constructor(raw: DatabaseSync) { this.raw = raw; }
  exec(sql: string) { this.raw.exec(sql); }
  prepare(sql: string) {
    const s = this.raw.prepare(sql);
    return {
      run: (...p: SqlValue[]) => s.run(...(p as never[])),
      get: (...p: SqlValue[]) => s.get(...(p as never[])) as Record<string, unknown> | undefined,
      all: (...p: SqlValue[]) => s.all(...(p as never[])) as Record<string, unknown>[],
    };
  }
  close() { this.raw.close(); }
}

export function openDatabase(path: string): NodeDb {
  if (path !== ':memory:') {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  const raw = new DatabaseSync(path);
  if (path !== ':memory:') raw.exec('PRAGMA journal_mode = WAL;');
  const db = new NodeDb(raw);
  migrate(db);
  return db;
}
