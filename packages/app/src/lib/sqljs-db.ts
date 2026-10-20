import type { Database } from 'sql.js';
import type { DbLike, SqlValue } from '@fom/core';

/** sql.js adapter for the shared DbLike interface (same SQL as node:sqlite). */
export class SqlJsDb implements DbLike {
  raw: Database;
  constructor(raw: Database) { this.raw = raw; }
  exec(sql: string) { this.raw.exec(sql); }
  prepare(sql: string) {
    const raw = this.raw;
    const norm = (p: SqlValue[]) => p.map((v) => (typeof v === 'bigint' ? Number(v) : v)) as (string | number | null | Uint8Array)[];
    return {
      run: (...p: SqlValue[]) => { raw.run(sql, norm(p)); },
      get: (...p: SqlValue[]) => {
        const st = raw.prepare(sql);
        try {
          st.bind(norm(p));
          return st.step() ? (st.getAsObject() as Record<string, unknown>) : undefined;
        } finally { st.free(); }
      },
      all: (...p: SqlValue[]) => {
        const st = raw.prepare(sql);
        const rows: Record<string, unknown>[] = [];
        try {
          st.bind(norm(p));
          while (st.step()) rows.push(st.getAsObject() as Record<string, unknown>);
          return rows;
        } finally { st.free(); }
      },
    };
  }
}
