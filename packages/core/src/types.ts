/** Core domain types for the FOM exam simulator. No runtime dependencies. */

export type DomainId = 'I' | 'II' | 'III';
export type OptionKey = 'A' | 'B' | 'C' | 'D';
export const OPTION_KEYS: readonly OptionKey[] = ['A', 'B', 'C', 'D'] as const;

export type Difficulty = 'foundational' | 'intermediate' | 'advanced';
export const DIFFICULTIES: readonly Difficulty[] = ['foundational', 'intermediate', 'advanced'] as const;

export type CognitiveLevel = 'recall' | 'comprehension' | 'application' | 'analysis' | 'evaluation';
export const COGNITIVE_LEVELS: readonly CognitiveLevel[] = ['recall', 'comprehension', 'application', 'analysis', 'evaluation'] as const;

/**
 * Validation lifecycle.
 *  draft           — written, not yet run through the pipeline
 *  needs_revision  — failed at least one pass
 *  ai_reviewed     — passed all automated passes AND an independent blind solve agreed with the key
 *  human_approved  — a qualified human reviewer signed off (never set automatically)
 *  rejected        — withdrawn from the bank
 */
export type ValidationStatus = 'draft' | 'needs_revision' | 'ai_reviewed' | 'human_approved' | 'rejected';
export const VALIDATION_STATUSES: readonly ValidationStatus[] = ['draft', 'needs_revision', 'ai_reviewed', 'human_approved', 'rejected'] as const;

export type PassName =
  | 'schema'          // Pass 0: structural completeness
  | 'factual'         // Pass 1: factual verification (reviewer-asserted)
  | 'uniqueness'      // Pass 2: exactly one defensible answer
  | 'distractors'     // Pass 3: distractor quality
  | 'coherence'       // Pass 4: clinical coherence
  | 'relevance'       // Pass 5: maps to blueprint task
  | 'difficulty'      // Pass 6: difficulty calibration
  | 'duplication'     // Pass 7: duplicate detection
  | 'blindSolve';     // Pass 8: independent answer review

export interface PassResult {
  ok: boolean;
  /** 'auto' = computed by tools; 'ai' = produced by a model reviewer; 'human' = a person */
  by: 'auto' | 'ai' | 'human';
  date: string;
  note?: string;
}

export interface Validation {
  status: ValidationStatus;
  passes: Partial<Record<PassName, PassResult>>;
  reviewer?: { name: string; date: string; note?: string };
}

export interface Reference {
  source: string;
  locator?: string;
}

export interface Distinction {
  between: string[];
  key: string;
}

export interface VersionEntry {
  version: number;
  date: string;
  note: string;
}

export interface Question {
  id: string;
  domain: DomainId;
  subdomain: string;
  task: string;
  theory?: string;
  stem: string;
  options: Record<OptionKey, string>;
  correct: OptionKey;
  explanation: string;
  distractorExplanations: Partial<Record<OptionKey, string>>;
  learningObjective: string;
  difficulty: Difficulty;
  cognitiveLevel: CognitiveLevel;
  vignette?: boolean;
  concepts: string[];
  distinction?: Distinction;
  references: Reference[];
  validation?: Validation;
  version?: number;
  history?: VersionEntry[];
  createdAt?: string;
  lastReviewedAt?: string;
}

/** Per-question aggregate performance; stored separately from the bank. */
export interface QuestionStats {
  questionId: string;
  usageCount: number;
  correctCount: number;
  totalResponseMs: number;
}

export interface SubdomainSpec {
  id: string;
  name: string;
  /** Absolute percent of the exam. */
  weight: number;
  weightOfficial: boolean;
  shareOfDomain?: number;
  tasks?: string[];
}

export interface DomainSpec {
  id: DomainId;
  name: string;
  weight: number;
  weightOfficial: boolean;
  subdomains: SubdomainSpec[];
}

export interface BlueprintSpec {
  name: string;
  effective: string;
  supersededOn?: string;
  source: string;
  exam: { questions: number; minutes: number; options: number; format?: string };
  domains: DomainSpec[];
  difficultyMix?: Partial<Record<Difficulty, number>> & { $comment?: string };
  bankTargets?: Record<string, number>;
}

export interface BlueprintFile {
  active: string;
  blueprints: Record<string, BlueprintSpec>;
}

/** One question as presented inside an attempt: options are shuffled, key remapped. */
export interface AttemptItem {
  position: number;
  questionId: string;
  /** Presented order: presentedOrder[i] = original key shown at position i (A,B,C,D). */
  presentedOrder: OptionKey[];
  /** The presented letter that is correct, derived from presentedOrder. */
  presentedCorrect: OptionKey;
}

export type AttemptMode = 'exam' | 'study' | 'targeted' | 'review';

export interface AttemptResponse {
  position: number;
  questionId: string;
  /** Presented letter chosen, or null if unanswered. */
  chosen: OptionKey | null;
  /** Original key chosen (mapped back), or null. */
  chosenOriginal: OptionKey | null;
  correct: boolean | null;
  flagged: boolean;
  responseMs: number;
  answeredAt?: string;
}

export interface ScoreBreakdownRow {
  key: string;
  label: string;
  total: number;
  answered: number;
  correct: number;
  /** correct / total (unanswered count as wrong), 0..1 */
  accuracy: number;
}

export interface ScoreReport {
  total: number;
  answered: number;
  unanswered: number;
  correct: number;
  /** correct / total, 0..1 — the raw percentage. Unanswered counts as incorrect. */
  rawAccuracy: number;
  byDomain: ScoreBreakdownRow[];
  bySubdomain: ScoreBreakdownRow[];
  byDifficulty: ScoreBreakdownRow[];
  byCognitiveLevel: ScoreBreakdownRow[];
  totalResponseMs: number;
  avgResponseMs: number;
  flagged: number;
}
