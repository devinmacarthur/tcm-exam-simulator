/**
 * Application service: every business operation over the database.
 * Runs unchanged on node:sqlite (server, tools, tests) and sql.js (browser), through DbLike.
 */
import type {
  AttemptItem, AttemptMode, AttemptResponse, BlueprintSpec, Difficulty, OptionKey, Question, ScoreReport, ValidationStatus,
} from './types.ts';
import { OPTION_KEYS } from './types.ts';
import { assembleExam, toOriginalKey } from './assemble.ts';
import { scoreAttempt } from './scoring.ts';
import { createRng, randomSeed } from './rng.ts';
import { auditBank, isExamEligible } from './audit.ts';
import { analyzeWeakness, selectTargeted, type GradedResponse, type WeaknessReport } from './weakness.ts';
import { assessReadiness, DEFAULT_THRESHOLDS, type ReadinessThresholds } from './readiness.ts';
import { gradeFromResponse, isDue, newCard, reviewCard, summarize, type SrsCard } from './srs.ts';
import { transaction, type DbLike } from './db/dblike.ts';

export interface AttemptConfig {
  count: number;
  /** null = untimed */
  minutes: number | null;
  subdomains?: string[];
  difficulties?: Difficulty[];
  /** Fidelity mode: forward-only, answers lock on advance, no review (matches the official CAT rules). */
  fidelity: boolean;
  preferUnseen: boolean;
  targeted?: boolean;
  srsDue?: boolean;
  bookmarked?: boolean;
  minStatus?: ValidationStatus;
  /** Study mode reveals explanations immediately after each answer. */
  immediateFeedback: boolean;
  seed?: number;
  /** Explicit question ids (retry missed from a specific attempt). */
  questionIds?: string[];
}

export interface AttemptRecord {
  id: string;
  mode: AttemptMode;
  blueprintId: string;
  config: AttemptConfig;
  seed: number;
  status: 'in_progress' | 'submitted' | 'abandoned';
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  timeLimitS: number | null;
  deadlineAt: string | null;
  timedOut: boolean;
  score: ScoreReport | null;
}

export interface Settings {
  examPoolMinStatus: ValidationStatus;
  readiness: ReadinessThresholds;
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: Settings = {
  examPoolMinStatus: 'ai_reviewed',
  readiness: DEFAULT_THRESHOLDS,
  theme: 'system',
};

export interface PresentedItem {
  position: number;
  questionId: string;
  domain: Question['domain'];
  subdomain: string;
  difficulty: Difficulty;
  cognitiveLevel: Question['cognitiveLevel'];
  stem: string;
  /** Options relabeled A–D in presented order. */
  options: Record<OptionKey, string>;
  reveal?: Reveal;
}

export interface Reveal {
  /** Presented letter that is correct. */
  correct: OptionKey;
  explanation: string;
  /** Keyed by PRESENTED letter. */
  distractorExplanations: Partial<Record<OptionKey, string>>;
  learningObjective: string;
  references: Question['references'];
  concepts: string[];
  distinction: Question['distinction'] | null;
}

export interface AggRow { attempts: number; correct: number; accuracy: number | null }

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

export class Service {
  db: DbLike;
  questions: Map<string, Question>;
  bp: BlueprintSpec;
  blueprintId: string;
  constructor(db: DbLike, questions: Map<string, Question>, bp: BlueprintSpec, blueprintId: string) {
    this.db = db;
    this.questions = questions;
    this.bp = bp;
    this.blueprintId = blueprintId;
  }

  // ---------- settings ----------
  getSettings(): Settings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = 'app'").get();
    if (!row) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(row.value as string) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, readiness: { ...DEFAULT_THRESHOLDS, ...(parsed.readiness ?? {}) } };
  }
  saveSettings(patch: Partial<Settings>): Settings {
    const cur = this.getSettings();
    const next: Settings = { ...cur, ...patch, readiness: { ...cur.readiness, ...(patch.readiness ?? {}) } };
    this.db.prepare("INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
    return next;
  }

  // ---------- bank ----------
  pool(minStatus: ValidationStatus): Question[] {
    return [...this.questions.values()].filter((q) => isExamEligible(q, minStatus));
  }
  seenIds(): Set<string> {
    return new Set(this.db.prepare('SELECT DISTINCT question_id FROM responses WHERE chosen IS NOT NULL').all().map((r) => r.question_id as string));
  }
  audit(minStatus?: ValidationStatus) {
    return auditBank([...this.questions.values()], this.bp, minStatus ?? this.getSettings().examPoolMinStatus);
  }
  conceptIndex(): { concept: string; count: number }[] {
    return this.db.prepare('SELECT concept, COUNT(*) AS n FROM question_concepts GROUP BY concept ORDER BY n DESC, concept').all()
      .map((r) => ({ concept: r.concept as string, count: Number(r.n) }));
  }
  stats(): Map<string, { usageCount: number; correctCount: number; totalResponseMs: number }> {
    const m = new Map<string, { usageCount: number; correctCount: number; totalResponseMs: number }>();
    for (const r of this.db.prepare('SELECT * FROM question_stats').all()) {
      m.set(r.question_id as string, { usageCount: Number(r.usage_count), correctCount: Number(r.correct_count), totalResponseMs: Number(r.total_response_ms) });
    }
    return m;
  }

  /** Present a question with options relabeled in the attempt's shuffled order. */
  present(item: AttemptItem, reveal: boolean): PresentedItem {
    const q = this.questions.get(item.questionId);
    if (!q) throw new Error(`Missing question ${item.questionId}`);
    const options = {} as Record<OptionKey, string>;
    item.presentedOrder.forEach((orig, i) => { options[OPTION_KEYS[i] as OptionKey] = q.options[orig]; });
    const base: PresentedItem = { position: item.position, questionId: q.id, domain: q.domain, subdomain: q.subdomain, difficulty: q.difficulty, cognitiveLevel: q.cognitiveLevel, stem: q.stem, options };
    return reveal ? { ...base, reveal: this.revealFor(q, item) } : base;
  }

  revealFor(q: Question, item: AttemptItem): Reveal {
    const distractorExplanations: Partial<Record<OptionKey, string>> = {};
    item.presentedOrder.forEach((orig, i) => {
      if (orig !== q.correct) distractorExplanations[OPTION_KEYS[i] as OptionKey] = q.distractorExplanations[orig] ?? '';
    });
    return { correct: item.presentedCorrect, explanation: q.explanation, distractorExplanations, learningObjective: q.learningObjective, references: q.references, concepts: q.concepts, distinction: q.distinction ?? null };
  }

  // ---------- attempts ----------
  createAttempt(mode: AttemptMode, cfg: AttemptConfig): { attempt: AttemptRecord; items: AttemptItem[]; coverage: Record<string, { target: number; delivered: number }>; shortfall: number } {
    const settings = this.getSettings();
    const minStatus = cfg.minStatus ?? (mode === 'exam' ? settings.examPoolMinStatus : 'ai_reviewed');
    let pool = this.pool(minStatus);
    if (cfg.difficulties && cfg.difficulties.length) pool = pool.filter((q) => cfg.difficulties!.includes(q.difficulty));
    if (cfg.bookmarked) {
      const ids = new Set(this.listBookmarks().map((b) => b.questionId));
      pool = pool.filter((q) => ids.has(q.id));
    }
    if (cfg.srsDue) {
      const due = new Set(this.dueCards().map((c) => c.questionId));
      pool = pool.filter((q) => due.has(q.id));
    }
    if (cfg.questionIds && cfg.questionIds.length) {
      const ids = new Set(cfg.questionIds);
      pool = pool.filter((q) => ids.has(q.id));
    }
    const seed = cfg.seed ?? randomSeed();
    const avoid = cfg.preferUnseen ? this.seenIds() : undefined;
    const rng = createRng(seed);
    const toItems = (qs: Question[]): AttemptItem[] => qs.map((q, i) => {
      const presentedOrder = rng.shuffle(OPTION_KEYS);
      return { position: i + 1, questionId: q.id, presentedOrder, presentedCorrect: OPTION_KEYS[presentedOrder.indexOf(q.correct)] as OptionKey };
    });

    let items: AttemptItem[];
    let coverage: Record<string, { target: number; delivered: number }> = {};
    let shortfall = 0;
    if (cfg.targeted) {
      const sel = selectTargeted(pool, this.gradedResponses(), this.weakness(), cfg.count, (a) => rng.shuffle(a));
      items = toItems(sel.questions);
      shortfall = Math.max(0, cfg.count - items.length);
    } else if ((cfg.questionIds && cfg.questionIds.length) || cfg.srsDue || cfg.bookmarked) {
      const unseenFirst = avoid ? [...rng.shuffle(pool.filter((q) => !avoid.has(q.id))), ...rng.shuffle(pool.filter((q) => avoid.has(q.id)))] : rng.shuffle(pool);
      items = toItems(unseenFirst.slice(0, cfg.count));
      shortfall = Math.max(0, cfg.count - items.length);
    } else {
      const res = assembleExam({
        blueprint: this.bp, pool, count: cfg.count, seed, avoidIds: avoid, subdomains: cfg.subdomains,
        difficultyMix: cfg.difficulties && cfg.difficulties.length ? null : undefined,
      });
      items = res.items;
      coverage = res.coverage;
      shortfall = res.shortfall;
    }
    if (items.length === 0) throw new Error('No eligible questions match this configuration.');

    const now = new Date();
    const id = uuid();
    const timeLimitS = cfg.minutes ? Math.round(cfg.minutes * 60) : null;
    const deadline = timeLimitS ? new Date(now.getTime() + timeLimitS * 1000).toISOString() : null;
    transaction(this.db, () => {
      this.db.prepare(`INSERT INTO attempts (id, mode, blueprint_id, config, seed, status, created_at, started_at, time_limit_s, deadline_at)
        VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, ?)`).run(id, mode, this.blueprintId, JSON.stringify(cfg), seed, now.toISOString(), now.toISOString(), timeLimitS, deadline);
      const ins = this.db.prepare('INSERT INTO attempt_items (attempt_id, position, question_id, presented_order, presented_correct) VALUES (?, ?, ?, ?, ?)');
      for (const it of items) ins.run(id, it.position, it.questionId, it.presentedOrder.join(','), it.presentedCorrect);
    });
    return { attempt: this.getAttempt(id)!, items, coverage, shortfall };
  }

  getAttempt(id: string): AttemptRecord | null {
    const r = this.db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id as string,
      mode: r.mode as AttemptMode,
      blueprintId: r.blueprint_id as string,
      config: JSON.parse(r.config as string) as AttemptConfig,
      seed: Number(r.seed),
      status: r.status as AttemptRecord['status'],
      createdAt: r.created_at as string,
      startedAt: (r.started_at as string | null) ?? null,
      submittedAt: (r.submitted_at as string | null) ?? null,
      timeLimitS: r.time_limit_s === null || r.time_limit_s === undefined ? null : Number(r.time_limit_s),
      deadlineAt: (r.deadline_at as string | null) ?? null,
      timedOut: !!Number(r.timed_out),
      score: r.score ? (JSON.parse(r.score as string) as ScoreReport) : null,
    };
  }

  listAttempts(opts: { mode?: AttemptMode; status?: AttemptRecord['status']; limit?: number } = {}): AttemptRecord[] {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.mode) { where.push('mode = ?'); args.push(opts.mode); }
    if (opts.status) { where.push('status = ?'); args.push(opts.status); }
    args.push(opts.limit ?? 50);
    const rows = this.db.prepare(`SELECT id FROM attempts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`).all(...args);
    return rows.map((r) => this.getAttempt(r.id as string)!);
  }

  getItems(attemptId: string): AttemptItem[] {
    return this.db.prepare('SELECT * FROM attempt_items WHERE attempt_id = ? ORDER BY position').all(attemptId).map((r) => ({
      position: Number(r.position),
      questionId: r.question_id as string,
      presentedOrder: (r.presented_order as string).split(',') as OptionKey[],
      presentedCorrect: r.presented_correct as OptionKey,
    }));
  }

  getResponses(attemptId: string): AttemptResponse[] {
    return this.db.prepare('SELECT * FROM responses WHERE attempt_id = ? ORDER BY position').all(attemptId).map((r) => ({
      position: Number(r.position),
      questionId: r.question_id as string,
      chosen: (r.chosen as OptionKey | null) ?? null,
      chosenOriginal: (r.chosen_original as OptionKey | null) ?? null,
      correct: r.correct === null || r.correct === undefined ? null : !!Number(r.correct),
      flagged: !!Number(r.flagged),
      responseMs: Number(r.response_ms),
      answeredAt: (r.answered_at as string | null) ?? undefined,
    }));
  }

  /** Full attempt view for the UI: items presented (answers hidden while an exam is in progress). */
  view(attemptId: string) {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    const reveal = attempt.status !== 'in_progress' || (attempt.mode !== 'exam' && attempt.config.immediateFeedback);
    return { attempt, items: this.getItems(attemptId).map((it) => this.present(it, reveal)), responses: this.getResponses(attemptId) };
  }

  /** Record (or update) a response. In fidelity mode a chosen answer cannot change. */
  respond(attemptId: string, position: number, input: { chosen?: OptionKey | null; flagged?: boolean; responseMs?: number }): { response: AttemptResponse; reveal?: Reveal } {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status !== 'in_progress') throw new Error('Attempt is not in progress');
    const item = this.getItems(attemptId).find((i) => i.position === position);
    if (!item) throw new Error('Bad position');
    const existing = this.db.prepare('SELECT * FROM responses WHERE attempt_id = ? AND position = ?').get(attemptId, position);
    const prevChosen = (existing?.chosen as OptionKey | null | undefined) ?? null;
    if (attempt.config.fidelity && prevChosen && input.chosen !== undefined && input.chosen !== prevChosen) {
      throw new Error('Answer is locked (fidelity mode)');
    }
    const chosen = input.chosen === undefined ? prevChosen : input.chosen;
    const chosenOriginal = chosen ? toOriginalKey(item, chosen) : null;
    const correct = chosen ? (chosen === item.presentedCorrect ? 1 : 0) : null;
    const flagged = input.flagged === undefined ? !!Number(existing?.flagged ?? 0) : input.flagged;
    const responseMs = Number(existing?.response_ms ?? 0) + (input.responseMs ?? 0);
    const firstExposure = existing ? !!Number(existing.first_exposure) : !this.seenIds().has(item.questionId);
    const now = new Date().toISOString();
    const answeredAt = chosen ? ((existing?.answered_at as string | null) ?? now) : null;
    this.db.prepare(`INSERT INTO responses (attempt_id, position, question_id, chosen, chosen_original, correct, flagged, response_ms, answered_at, first_exposure)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(attempt_id, position) DO UPDATE SET chosen=excluded.chosen, chosen_original=excluded.chosen_original, correct=excluded.correct,
        flagged=excluded.flagged, response_ms=excluded.response_ms, answered_at=excluded.answered_at`)
      .run(attemptId, position, item.questionId, chosen, chosenOriginal, correct, flagged ? 1 : 0, responseMs, answeredAt, firstExposure ? 1 : 0);
    const response: AttemptResponse = { position, questionId: item.questionId, chosen, chosenOriginal, correct: correct === null ? null : !!correct, flagged, responseMs, answeredAt: answeredAt ?? undefined };
    if (attempt.mode !== 'exam' && attempt.config.immediateFeedback && chosen) {
      return { response, reveal: this.revealFor(this.questions.get(item.questionId)!, item) };
    }
    return { response };
  }

  /** Finalize: score, update stats + SRS. Idempotent. */
  submit(attemptId: string, opts: { timedOut?: boolean } = {}): { attempt: AttemptRecord; score: ScoreReport } {
    const attempt = this.getAttempt(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.status === 'submitted') return { attempt, score: attempt.score! };
    const items = this.getItems(attemptId);
    const responses = this.getResponses(attemptId);
    const score = scoreAttempt(this.bp, this.questions, items, responses);
    const now = new Date();
    const timedOut = !!opts.timedOut || (attempt.deadlineAt !== null && now.getTime() > new Date(attempt.deadlineAt).getTime() + 2000);
    transaction(this.db, () => {
      this.db.prepare("UPDATE attempts SET status='submitted', submitted_at=?, score=?, timed_out=? WHERE id=?").run(now.toISOString(), JSON.stringify(score), timedOut ? 1 : 0, attemptId);
      const upStats = this.db.prepare(`INSERT INTO question_stats (question_id, usage_count, correct_count, total_response_ms) VALUES (?, 1, ?, ?)
        ON CONFLICT(question_id) DO UPDATE SET usage_count = usage_count + 1, correct_count = correct_count + excluded.correct_count, total_response_ms = total_response_ms + excluded.total_response_ms`);
      for (const r of responses) {
        if (r.chosen === null) continue;
        upStats.run(r.questionId, r.correct ? 1 : 0, r.responseMs);
        this.touchSrs(r.questionId, !!r.correct, r.responseMs, now);
      }
    });
    return { attempt: this.getAttempt(attemptId)!, score };
  }

  abandon(attemptId: string): void {
    this.db.prepare("UPDATE attempts SET status='abandoned' WHERE id=? AND status='in_progress'").run(attemptId);
  }

  /** Auto-submit any in-progress timed attempt whose deadline has passed. */
  sweepExpired(): string[] {
    const rows = this.db.prepare("SELECT id FROM attempts WHERE status='in_progress' AND deadline_at IS NOT NULL AND deadline_at < ?").all(new Date().toISOString());
    const ids = rows.map((r) => r.id as string);
    for (const id of ids) this.submit(id, { timedOut: true });
    return ids;
  }

  // ---------- SRS ----------
  getCard(questionId: string): SrsCard | null {
    const r = this.db.prepare('SELECT * FROM srs_cards WHERE question_id = ?').get(questionId);
    if (!r) return null;
    return { questionId, ease: Number(r.ease), intervalDays: Number(r.interval_days), repetitions: Number(r.repetitions), dueAt: r.due_at as string, lastReviewedAt: (r.last_reviewed_at as string | null) ?? undefined, lapses: Number(r.lapses) };
  }
  allCards(): SrsCard[] {
    return this.db.prepare('SELECT * FROM srs_cards').all().map((r) => ({ questionId: r.question_id as string, ease: Number(r.ease), intervalDays: Number(r.interval_days), repetitions: Number(r.repetitions), dueAt: r.due_at as string, lastReviewedAt: (r.last_reviewed_at as string | null) ?? undefined, lapses: Number(r.lapses) }));
  }
  dueCards(now = new Date()): SrsCard[] {
    return this.allCards().filter((c) => isDue(c, now));
  }
  private touchSrs(questionId: string, correct: boolean, responseMs: number, now: Date) {
    const card = this.getCard(questionId) ?? newCard(questionId, now);
    const next = reviewCard(card, gradeFromResponse(correct, responseMs), now);
    this.db.prepare(`INSERT INTO srs_cards (question_id, ease, interval_days, repetitions, due_at, last_reviewed_at, lapses) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(question_id) DO UPDATE SET ease=excluded.ease, interval_days=excluded.interval_days, repetitions=excluded.repetitions, due_at=excluded.due_at, last_reviewed_at=excluded.last_reviewed_at, lapses=excluded.lapses`)
      .run(questionId, next.ease, next.intervalDays, next.repetitions, next.dueAt, next.lastReviewedAt ?? null, next.lapses);
  }

  // ---------- bookmarks ----------
  listBookmarks(): { questionId: string; createdAt: string; note: string | null }[] {
    return this.db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC').all().map((r) => ({ questionId: r.question_id as string, createdAt: r.created_at as string, note: (r.note as string | null) ?? null }));
  }
  isBookmarked(questionId: string): boolean {
    return !!this.db.prepare('SELECT 1 AS x FROM bookmarks WHERE question_id = ?').get(questionId);
  }
  addBookmark(questionId: string, note?: string) {
    if (!this.questions.has(questionId)) throw new Error('Unknown question');
    this.db.prepare('INSERT INTO bookmarks (question_id, created_at, note) VALUES (?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET note = excluded.note').run(questionId, new Date().toISOString(), note ?? null);
  }
  removeBookmark(questionId: string) {
    this.db.prepare('DELETE FROM bookmarks WHERE question_id = ?').run(questionId);
  }

  // ---------- analytics ----------
  gradedResponses(): GradedResponse[] {
    return this.db.prepare(`SELECT r.*, a.mode FROM responses r JOIN attempts a ON a.id = r.attempt_id WHERE r.chosen IS NOT NULL AND a.status = 'submitted' ORDER BY r.answered_at`).all().map((r) => ({
      questionId: r.question_id as string,
      correct: r.correct === null ? null : !!Number(r.correct),
      chosenOriginal: (r.chosen_original as string | null) ?? null,
      responseMs: Number(r.response_ms),
      answeredAt: (r.answered_at as string | null) ?? '',
      attemptId: r.attempt_id as string,
      mode: r.mode as string,
      firstExposure: !!Number(r.first_exposure),
    }));
  }

  weakness(): WeaknessReport {
    return analyzeWeakness(this.questions, this.gradedResponses());
  }

  /** Missed question ids (last response wrong), newest first. */
  missedQuestionIds(): string[] {
    const last = new Map<string, boolean | null>();
    for (const r of this.gradedResponses()) last.set(r.questionId, r.correct);
    return [...last.entries()].filter(([, c]) => c === false).map(([id]) => id).reverse();
  }

  overview() {
    const settings = this.getSettings();
    const graded = this.gradedResponses();
    const eligible = this.pool(settings.examPoolMinStatus);
    const seen = this.seenIds();
    const seenEligible = eligible.filter((q) => seen.has(q.id)).length;
    const acc = (rs: GradedResponse[]) => (rs.length ? rs.filter((r) => r.correct).length / rs.length : null);
    const unseenRs = graded.filter((r) => r.firstExposure);
    const byDomain: Record<string, AggRow> = {};
    const byDifficulty: Record<string, AggRow> = {};
    const byCognitive: Record<string, AggRow> = {};
    const bump = (m: Record<string, AggRow>, k: string, c: boolean | null) => {
      const x = (m[k] ??= { attempts: 0, correct: 0, accuracy: null });
      x.attempts += 1;
      if (c) x.correct += 1;
      x.accuracy = x.correct / x.attempts;
    };
    let totalMs = 0;
    for (const r of graded) {
      const q = this.questions.get(r.questionId);
      if (!q) continue;
      bump(byDomain, q.domain, r.correct);
      bump(byDifficulty, q.difficulty, r.correct);
      bump(byCognitive, q.cognitiveLevel, r.correct);
      totalMs += r.responseMs;
    }
    const exams = this.listAttempts({ mode: 'exam', status: 'submitted', limit: 100 }).reverse();
    const fullExams = exams.filter((a) => a.config.count >= this.bp.exam.questions);
    const timeline = this.listAttempts({ status: 'submitted', limit: 200 }).reverse().map((a) => ({
      id: a.id, mode: a.mode, submittedAt: a.submittedAt, count: a.score?.total ?? 0, accuracy: a.score?.rawAccuracy ?? 0, timedOut: a.timedOut,
    }));
    const flagged = Number(this.db.prepare('SELECT COUNT(*) AS n FROM responses WHERE flagged = 1').get()?.n ?? 0);
    const weakness = this.weakness();
    const higher = graded.filter((r) => { const q = this.questions.get(r.questionId); return q && (q.cognitiveLevel === 'analysis' || q.cognitiveLevel === 'evaluation'); });
    const unseenByDomain: Partial<Record<'I' | 'II' | 'III', number | null>> = {};
    for (const d of ['I', 'II', 'III'] as const) unseenByDomain[d] = acc(unseenRs.filter((r) => this.questions.get(r.questionId)?.domain === d));
    const readiness = assessReadiness({
      unseenAccuracy: acc(unseenRs),
      unseenCount: unseenRs.length,
      domainAccuracy: unseenByDomain,
      fullExamScores: fullExams.map((a) => a.score?.rawAccuracy ?? 0),
      fullExamCompletedInTime: fullExams.map((a) => !a.timedOut),
      higherOrderAccuracy: acc(higher),
      coverage: eligible.length ? seenEligible / eligible.length : 0,
    }, settings.readiness);
    return {
      totals: { responses: graded.length, accuracy: acc(graded), unseenAccuracy: acc(unseenRs), unseenResponses: unseenRs.length, seenAccuracy: acc(graded.filter((r) => !r.firstExposure)), avgResponseMs: graded.length ? Math.round(totalMs / graded.length) : 0, flagged },
      byDomain, byDifficulty, byCognitive,
      coverage: { eligible: eligible.length, seen: seenEligible, unseen: eligible.length - seenEligible, bankTotal: this.questions.size },
      recentExams: exams.slice(-10).map((a) => ({ id: a.id, submittedAt: a.submittedAt, count: a.score?.total ?? 0, accuracy: a.score?.rawAccuracy ?? 0, timedOut: a.timedOut, byDomain: a.score?.byDomain ?? [] })),
      timeline,
      weakConcepts: weakness.concepts.slice(0, 15),
      confusions: weakness.confusions.slice(0, 10),
      bySubdomain: weakness.bySubdomain,
      srs: summarize(this.allCards()),
      readiness,
      settings,
    };
  }

  /** Items whose `distinction` covers the given concepts, for Explain the Distinction. */
  distinctions(a?: string, b?: string) {
    const out: { questionId: string; between: string[]; key: string; explanation: string; stem: string }[] = [];
    for (const q of this.questions.values()) {
      if (!q.distinction) continue;
      const set = q.distinction.between;
      if (a && !set.includes(a)) continue;
      if (b && !set.includes(b)) continue;
      out.push({ questionId: q.id, between: set, key: q.distinction.key, explanation: q.explanation, stem: q.stem });
    }
    return out;
  }
}

export type Overview = ReturnType<Service['overview']>;
