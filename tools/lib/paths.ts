import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BlueprintFile, Question } from '@fom/core';
import { activeBlueprint } from '@fom/core';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BANK = join(ROOT, 'bank');
export const DRAFTS = join(BANK, 'drafts');
export const QUESTIONS = join(BANK, 'questions');
export const REVIEWS = join(BANK, 'reviews');

export function loadBlueprint() {
  const file = JSON.parse(readFileSync(join(BANK, 'blueprint.json'), 'utf8')) as BlueprintFile;
  return { file, bp: activeBlueprint(file) };
}

export function readJsonArray(path: string): Question[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Question | Question[];
  return Array.isArray(raw) ? raw : [raw];
}

export function loadDir(dir: string): { file: string; questions: Question[] }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: join(dir, f), questions: readJsonArray(join(dir, f)) }));
}

export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1] ?? def;
  return def;
}
export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
