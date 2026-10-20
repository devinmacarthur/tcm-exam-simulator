# FOM Exam Simulator

A practice-examination platform for the **NCBAHM™ Foundations of Oriental Medicine (FOM)** module
(NCBAHM is the National Certification Board for Acupuncture and Herbal Medicine, formerly NCCAOM®).
Unofficial, not affiliated with NCBAHM. All questions are original.

- **Verified exam specification with citations:** [docs/EXAM-SPEC.md](docs/EXAM-SPEC.md)
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Expanding the question bank:** [docs/QUESTION-BANK.md](docs/QUESTION-BANK.md)
- **Item-writing standards:** [bank/STYLE-GUIDE.md](bank/STYLE-GUIDE.md)

## What it does

| Mode | Behavior |
|---|---|
| **Full exam** | 100 questions / 150 minutes, official 2026 domain weights (28 / 38 / 34, with I-A..I-D at 6 / 3 / 10 / 9). Default *fidelity mode* follows the official computer-adaptive rules: forward-only, answers lock, every item must be answered, nothing is revealed until submission. An optional *linear-review mode* (navigator, flags, revisable answers) is offered as a simulator convenience. Auto-submits when time expires; progress survives refresh. |
| **Study** | Topic / difficulty / count selection, immediate feedback, explanation for every option, references, bookmarks, "Explain the Distinction". |
| **Targeted** | Previously missed items first, then unseen items on weak concepts and weak subdomains. |
| **Spaced review** | SM-2 scheduling from your answer history. |
| **Analytics** | Raw accuracy overall and by domain / subdomain / difficulty / cognitive level, unseen-vs-seen split, time per item, exam history chart, confusion pairs, coverage, SRS progress, and a transparent readiness classification with configurable thresholds. |

Scores are **raw percentages only**. NCBAHM reports a scaled score (1–99, pass = 70) whose conversion is not published; the simulator never invents one or predicts pass/fail.

## Run it

Requirements: Node 22.18+ (uses `node:sqlite` and native TypeScript execution; no build step for tools).

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
# or
npm run build && npm start   # static build served at http://localhost:8787
```

The app is fully client-side: the question bank is bundled at build time and your performance data lives in
your browser (SQLite via sql.js, persisted to IndexedDB). Export/import a backup from **Settings**.

### Deploy to GitHub Pages

Push to `main`. The workflow in `.github/workflows/deploy.yml` runs typecheck, tests and the bank audit, builds
with `BASE_PATH=/<repo>/`, and deploys to Pages. Enable **Settings → Pages → Source: GitHub Actions** once.

## Question bank

```
bank/
  blueprint.json      official domain weights + simulator sub-weights + bank targets
  STYLE-GUIDE.md      item-writing standards and JSON schema
  drafts/             writer output, not yet validated
  reviews/            blind-solve results (Pass 8) and packets
  questions/          validated bank, one file per subdomain — the source of truth the app bundles
```

Pipeline commands (run from the repo root):

```bash
npm run bank:validate -- --source drafts            # Passes 0–7 (+8 if reviews exist); prints issues
npm run bank:blind-prep                             # strip keys → bank/reviews/blind-packets/*.json
npm run bank:blind-merge                            # compare independent answers with keys
npm run bank:validate -- --source drafts --write    # record pass results + status on each item
npm run bank:promote                                # copy ai_reviewed / human_approved drafts into bank/questions
npm run bank:promote -- --approve FOM-IIf-0001 --reviewer "Name, L.Ac."   # record a human sign-off
npm run bank:audit                                  # coverage, duplicates, ambiguity, gaps
npm run bank:export -- --format csv                 # JSON/CSV export; import with bank:import -- --from file
```

Validation statuses: `draft` → `ai_reviewed` (all automated passes + independent blind solve agreed) →
`human_approved` (named reviewer). `needs_revision` and `rejected` never enter an exam. **No item is
represented as professionally validated unless a human reviewer is recorded on it.**

## Tests

```bash
npm test          # vitest: blueprint apportionment, assembly, scoring, SRS, weakness, readiness, audit, pipeline, service/persistence, timer helpers
npm run typecheck
```

## License

Source: MIT. Question content: © the repository owner; original work, not reproduced from any examination.
