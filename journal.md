# FOM Exam Simulator — Journal

Continuous log. Newest entries at top.

---

## 2026-10-19 — Project created: spec verified, app built, 500-item bank drafted, 393 validated

**Exam identification (Phase 1).** The brief said "NCBTMB Foundations of TCM". NCBTMB has no such exam (its only exam is the BCETMB massage board, 140 q / 140 min, no TCM domains). The intended exam is NCBAHM's (formerly NCCAOM) **Foundations of Oriental Medicine (FOM)** module. Official sources archived in `docs/`: the 2026 FOM content outline (effective 2026-09-01: Domains 28 / 38 / 34, I-A..I-D 6 / 3 / 10 / 9) and the May 2026 Candidate Preparation Handbook (CAT, 100 MCQ, 150 min, no going back, scaled 1–99 pass 70, conversion unpublished). Full citations in `docs/EXAM-SPEC.md`. The 2020 outline (35/35/30) that most prep sites still quote is superseded.

**Architecture pivot mid-build.** Operator asked to host on GitHub and drop Anthropic integration. Rebuilt the data layer so the whole app runs client-side: `@fom/core` Service over a `DbLike` SQLite interface, node:sqlite for tools/tests and sql.js + IndexedDB in the browser. Static build deploys to GitHub Pages via `.github/workflows/deploy.yml` (HashRouter, `BASE_PATH`). No API keys anywhere.

**Bank.** 14 writer slices (Fable first; a Fable session rate limit cut 7 writers off mid-slice, so the gaps were re-commissioned to Opus). 500 drafts. Blind review (Pass 8) by separate Opus sessions in six rounds: 500/500 key agreement; 14 "second option arguable" concerns, each revised and re-reviewed until clear (two Zang Fu items needed the parent-pattern distractor replaced with a clearly wrong sibling). Final audit: 500 `ai_reviewed`, 0 duplicates, 0 ambiguity warnings, 0 blueprint gaps, exam pool fills a 100-item form in every subdomain. Zero `human_approved` — the app says so wherever it matters.

**Tests:** 49 passing (vitest). Browser smoke test via Playwright MCP found one real bug (study mode revealed explanations before answering) — fixed with a regression test.

**Hosting.** First push attempt failed (fine-grained PAT without repo-create rights, no SSH key); operator re-logged `gh` via the browser flow and pushed as `master`. Then from Claude: enabled Pages (build_type=workflow), created `main` from `master` through the Git Data API (GCM cannot prompt in this shell), set it default, deleted `master`, added `main` to the `github-pages` environment branch policy (first deploy was rejected for that reason), reran the workflow. **Live: https://devinmacarthur.github.io/tcm-exam-simulator/** — tests, audit and build run in CI on every push to `main`. Repo-local `credential.helper = !gh auth git-credential` set for future pushes from this shell.

**Next:** a human (Yarree or a licensed practitioner) starts signing items `human_approved` with `npm run bank:promote -- --approve <id> --reviewer "<name>"`; push → auto-deploy.
