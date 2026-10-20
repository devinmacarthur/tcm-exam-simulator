import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BlueprintFile, BlueprintSpec, Question } from '@fom/core';
import { activeBlueprint } from '@fom/core';

export function loadBlueprint(bankDir: string): { file: BlueprintFile; bp: BlueprintSpec } {
  const file = JSON.parse(readFileSync(join(bankDir, 'blueprint.json'), 'utf8')) as BlueprintFile;
  return { file, bp: activeBlueprint(file) };
}

/** Load all question JSON files from a directory (arrays or single objects). */
export function loadQuestionsFromDir(dir: string): Question[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const out: Question[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Question | Question[];
    for (const q of Array.isArray(raw) ? raw : [raw]) out.push(q);
  }
  return out;
}
