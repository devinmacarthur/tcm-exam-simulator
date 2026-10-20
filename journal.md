# FOM Exam Simulator — Journal

Continuous log. Newest entries at top.

---

## 2026-10-19 — Project created: spec verified, app built, 500-item bank drafted, 393 validated

**Exam identification (Phase 1).** The brief said "NCBTMB Foundations of TCM". NCBTMB has no such exam (its only exam is the BCETMB massage board, 140 q / 140 min, no TCM domains). The intended exam is NCBAHM's (formerly NCCAOM) **Foundations of Oriental Medicine (FOM)** module. Official sources archived in `docs/`: the 2026 FOM content outline (effective 2026-09-01: Domains 28 / 38 / 34, I-A..I-D 6 / 3 / 10 / 9) and the May 2026 Candidate Preparation Handbook (CAT, 100 MCQ, 150 min, no going back, scaled 1–99 pass 70, conversion unpublished). Full citations in `docs/EXAM-SPEC.md`. The 2020 outline (35/35/30) that most prep sites still quote is superseded.

**Architecture pivot mid-build.** Operator asked to host on GitHub and drop Anthropic integration. Rebuilt the data layer so the whole app runs client-side: `@fom/core` Service over a `DbLike` SQLite interface, node:sqlite for tools/tests and sql.js + IndexedDB in the browser. Static build deploys to GitHub Pages via `.github/workflows/deploy.yml` (HashRouter, `BASE_PATH`). No API keys anywhere.

**Bank.** 14 writer slices (Fable first; a Fable session rate limit cut 7 writers off mid-slice, so the gaps were re-commissioned to Opus). 500 drafts on disk. Blind review (Pass 8) by separate Opus sessions: first 393 items → 380/380 key agreement, 9 concerns → revised → re-reviewed → 2 further revisions → all clear → promoted as `ai_reviewed`. The last 107 (I-C, II-f) are structurally validated and awaiting blind review. Zero `human_approved` — the app says so wherever it matters.

**Tests:** 49 passing (vitest). Browser smoke test via Playwright MCP found one real bug (study mode revealed explanations before answering) — fixed with a regression test.

**Blocked:** `git push` — the `gh` token is invalid and Git Credential Manager fails in this shell ("Unable to persist credentials with the 'wincredman' credential store"). Repo `devinmacarthur/tcm-exam-simulator` not created yet. Operator needs to run `gh auth login`, then `gh repo create devinmacarthur/tcm-exam-simulator --public --source . --push`, then enable Pages → Source: GitHub Actions.

**Next:** blind-review the 107 → promote → push → enable Pages → a human (Yarree or a licensed practitioner) starts signing items `human_approved` with `npm run bank:promote -- --approve <id> --reviewer "<name>"`.
