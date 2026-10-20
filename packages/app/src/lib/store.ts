/**
 * Browser-side data layer: sql.js (SQLite compiled to WebAssembly) persisted to IndexedDB.
 * The question bank is bundled at build time from bank/questions/*.json; performance data lives only in
 * this browser (export/import a backup from Settings).
 */
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Service, activeBlueprint, migrate, readAllQuestions, syncBankToDb, type BlueprintFile, type Question } from '@fom/core';
import blueprintJson from '../../../../bank/blueprint.json';
import { SqlJsDb } from './sqljs-db.ts';
import { idbGet, idbSet, idbDelete } from './idb.ts';

const DB_KEY = 'sqlite-db';
const bankModules = import.meta.glob('../../../../bank/questions/*.json', { eager: true, import: 'default' }) as Record<string, Question[] | Question>;

export function bundledQuestions(): Question[] {
  const out: Question[] = [];
  for (const k of Object.keys(bankModules).sort()) {
    const v = bankModules[k]!;
    for (const q of Array.isArray(v) ? v : [v]) out.push(q);
  }
  return out;
}

export interface Store {
  svc: Service;
  db: SqlJsDb;
  /** Persist now (returns false if IndexedDB is unavailable, e.g. private mode). */
  save(): Promise<boolean>;
  scheduleSave(): void;
  exportBytes(): Uint8Array;
  persistent: boolean;
}

let storePromise: Promise<Store> | null = null;

export function getStore(): Promise<Store> {
  if (!storePromise) storePromise = boot();
  return storePromise;
}

async function boot(): Promise<Store> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet<Uint8Array>(DB_KEY);
  const raw = saved ? new SQL.Database(saved) : new SQL.Database();
  const db = new SqlJsDb(raw);
  migrate(db);
  syncBankToDb(db, bundledQuestions());
  const file = blueprintJson as unknown as BlueprintFile;
  const svc = new Service(db, readAllQuestions(db), activeBlueprint(file), file.active);
  let timer: number | null = null;
  let persistent = true;
  const save = async () => {
    if (timer) { window.clearTimeout(timer); timer = null; }
    persistent = await idbSet(DB_KEY, raw.export());
    return persistent;
  };
  const scheduleSave = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => { void save(); }, 250);
  };
  window.addEventListener('beforeunload', () => { void save(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void save(); });
  svc.sweepExpired();
  await save();
  return { svc, db, save, scheduleSave, exportBytes: () => raw.export(), get persistent() { return persistent; } };
}

/** Replace the database with imported bytes (backup restore). Reloads the page. */
export async function importDatabase(bytes: Uint8Array): Promise<void> {
  await idbSet(DB_KEY, bytes);
  window.location.reload();
}

/** Wipe all performance data (the bank is re-mirrored on next boot). */
export async function resetDatabase(): Promise<void> {
  await idbDelete(DB_KEY);
  window.location.reload();
}
