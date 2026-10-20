# Architecture

## Overview

```
packages/core      pure TypeScript, no I/O: types, blueprint math, exam assembly, scoring, SRS, weakness
                   detection, readiness model, audit + validation pipeline, CSV codec, DB migrations,
                   and the Service (all business operations over a DbLike SQLite handle)
packages/app       React 18 + Vite + Tailwind. Runs the Service in the browser on sql.js (SQLite→WASM),
                   persisted to IndexedDB. Bundles bank/questions/*.json at build time.
packages/server    node:sqlite adapter (used by tools and tests) and a tiny static host for the built app
tools/             bank pipeline CLIs (validate, blind-review prep/merge, promote, audit, import, export)
bank/              the question bank (see README) — JSON is the source of truth; SQLite is a mirror
docs/              EXAM-SPEC (verified, cited), this file, QUESTION-BANK (expansion guide), archived PDFs
```

The same SQL schema and the same `Service` class run on **node:sqlite** (tests, tools) and on **sql.js**
(browser) through the `DbLike` interface (`exec`, `prepare().run/get/all`). That is what makes the app
deployable as a static site (GitHub Pages) while keeping SQLite as the persistence model.

## Data model (SQLite, `packages/core/src/db/migrations.ts`)

| Table | Purpose |
|---|---|
| `questions` | Mirror of the JSON bank (id, domain, subdomain, task, difficulty, cognitive level, status, version, full JSON). Re-synced on every boot. |
| `question_concepts` | concept tags for lookup |
| `question_stats` | usage count, correct count, total response ms — **performance data kept separate from content** |
| `attempts` | one row per exam/study/targeted/review session: mode, config JSON, seed, status, timing, deadline, timed-out flag, score JSON |
| `attempt_items` | the fixed form: position, question id, presented option order, presented correct letter |
| `responses` | chosen letter (presented + original), correctness, flag, cumulative response ms, first-exposure flag |
| `srs_cards` | SM-2 state per question |
| `bookmarks`, `settings`, `schema_migrations` | |

Question JSON fields (see `bank/STYLE-GUIDE.md` §6): id, stem, options A–D, correct, explanation,
distractorExplanations, learningObjective, domain/subdomain/task/theory, difficulty, cognitiveLevel,
vignette, concepts, distinction, references, validation {status, passes, reviewer}, version, history,
createdAt, lastReviewedAt.

## Exam assembly (`core/src/assemble.ts`)

1. Largest-remainder apportionment of the form size across subdomains by blueprint weight (official for
   Domain I subdomains; simulator sub-weights inside II and III, labeled as such).
2. Within each subdomain, difficulty tiers are apportioned (30/45/25 default) and filled **unseen-first**:
   unseen by tier → unseen any tier → seen by tier → seen any tier.
3. Shortfalls are filled from the same domain first (preserving official domain weights), then anywhere.
4. Question order and option order are shuffled with a seeded PRNG; the key is remapped per item and
   stored on the attempt item. Duplicate ids are impossible by construction (asserted).

CAT (adaptive) selection is **not** simulated — it needs calibrated item parameters an original bank
does not have. The UI states this.

## Modes

- **Fidelity**: `config.fidelity = true`. `Service.respond` rejects changing a chosen answer; the UI
  hides the navigator, flags and review. Advancing requires an answer (official: all items answered).
- **Linear-review**: navigator, flags, revisable answers, unanswered list at submission.
- **Study / targeted / review**: `immediateFeedback` returns the reveal (explanations keyed by the
  *presented* letters) from `respond`.

In-progress exams never expose `correct`/explanations: `Service.view` only attaches `reveal` after
submission (or in immediate-feedback modes).

## Timer and persistence

`attempts.deadline_at` is set at creation. The client counts down from it and auto-submits with
`timedOut=true` at zero; `Service.sweepExpired()` also finalizes any expired attempt on the next boot or
dashboard load, so a closed tab cannot produce an un-scored timed exam. Every response is written to
SQLite immediately and the database bytes are flushed to IndexedDB (debounced 250 ms, plus on
`visibilitychange`/`beforeunload`), so a refresh resumes at the same question.

## Analytics and adaptivity

- `weakness.ts`: per-concept accuracy, confusion pairs (from items' `distinction.between` when missed),
  per-subdomain/difficulty/cognitive accuracy. `selectTargeted` orders missed → unseen weak-concept →
  unseen weak-subdomain → unseen → any.
- `srs.ts`: SM-2 variant; grade from correctness and speed.
- `readiness.ts`: transparent rule set over unseen accuracy, per-domain floors, full-exam consistency
  (stdev), on-time completion, higher-order accuracy, coverage. Thresholds are user-configurable and
  the output is explicitly a study classification.

## Validation pipeline (`core/src/validate.ts`, `tools/`)

| Pass | Name | How |
|---|---|---|
| 0 | schema | structural completeness, enum validity, domain/subdomain consistency |
| 1 | factual | asserted by the independent reviewer (agreement + no concern) or a human |
| 2 | uniqueness | negative-question wording, "all/none of the above", duplicate options, stem leaking the key |
| 3 | distractors | every distractor explained; correct option not a length outlier; no always/never |
| 4 | coherence | independent reviewer's concern field (vignette coherence) |
| 5 | relevance | subdomain and task map to the blueprint |
| 6 | difficulty | enum + calibration sanity (recall≠advanced, evaluation≠foundational) |
| 7 | duplication | 2-gram Jaccard on stems + identical option sets |
| 8 | blindSolve | separate model session solves the packet without keys; disagreement fails |

Status: any failed pass → `needs_revision`; all automated passes + blindSolve ok → `ai_reviewed`;
`human_approved` only via `tools/promote.ts --approve`. The exam pool's floor is a user setting
(default `ai_reviewed`).
