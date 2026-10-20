import type { BlueprintFile, BlueprintSpec, Question, Difficulty, CognitiveLevel } from '../src/index.ts';
import { activeBlueprint, flattenSubdomains } from '../src/index.ts';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const BLUEPRINT_FILE = JSON.parse(readFileSync(join(here, '..', '..', '..', 'bank', 'blueprint.json'), 'utf8')) as BlueprintFile;
export const BP: BlueprintSpec = activeBlueprint(BLUEPRINT_FILE);

const DIFFS: Difficulty[] = ['foundational', 'intermediate', 'advanced'];
const COGS: CognitiveLevel[] = ['recall', 'comprehension', 'application', 'analysis', 'evaluation'];

/** Build a synthetic but schema-valid bank with n items per subdomain. */
export function syntheticBank(perSub = 12, status: 'ai_reviewed' | 'draft' = 'ai_reviewed'): Question[] {
  const out: Question[] = [];
  for (const s of flattenSubdomains(BP)) {
    for (let i = 0; i < perSub; i++) {
      const code = s.id.replace('-', '');
      const correct = (['A', 'B', 'C', 'D'] as const)[i % 4]!;
      out.push({
        id: `FOM-${code}-${String(i + 1).padStart(4, '0')}`,
        domain: s.domain,
        subdomain: s.id,
        task: s.domain === 'I' ? `${s.id}-1` : s.domain === 'II' ? `II-1-${s.id.split('-')[1]}` : s.id,
        stem: `Synthetic stem number ${i} for subdomain ${s.id} asking which pattern is most consistent with the findings described here.`,
        options: { A: `option alpha ${s.id} ${i}`, B: `option beta ${s.id} ${i}`, C: `option gamma ${s.id} ${i}`, D: `option delta ${s.id} ${i}` },
        correct,
        explanation: `The correct answer is ${correct} because the synthetic findings match that synthetic pattern precisely.`,
        distractorExplanations: Object.fromEntries((['A', 'B', 'C', 'D'] as const).filter((k) => k !== correct).map((k) => [k, `Option ${k} is wrong because of a nameable misconception.`])),
        learningObjective: `Differentiate synthetic pattern ${i} in ${s.id}.`,
        difficulty: DIFFS[i % 3]!,
        cognitiveLevel: COGS[(i % 3) + 1]!,
        vignette: i % 2 === 0,
        concepts: [`concept-${s.id.toLowerCase()}-${i % 4}`],
        distinction: i % 3 === 0 ? { between: [`concept-${s.id.toLowerCase()}-0`, `concept-${s.id.toLowerCase()}-1`], key: 'the discriminating finding' } : undefined,
        references: [{ source: 'Maciocia, The Foundations of Chinese Medicine, 3rd ed.' }],
        validation: { status, passes: {} },
      });
    }
  }
  return out;
}
