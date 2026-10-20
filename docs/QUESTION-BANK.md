# Expanding the question bank

The bank scales by **slices**: a slice is one JSON array of items for one or more subdomains, written
against the blueprint and the style guide, then pushed through the same pipeline as the initial bank.
Nothing enters `bank/questions/` without passing it.

## 1. Pick targets

`npm run bank:audit` prints `Blueprint gaps vs bank targets` (current count per subdomain vs
`bank/blueprint.json → bankTargets`) and `Exam-pool gaps`. Raise `bankTargets` proportionally when you
want a bigger bank (e.g. ×4 for 2,000 items); the weights already encode the official distribution.

## 2. Write a slice

- Read `bank/STYLE-GUIDE.md` and `docs/EXAM-SPEC.md` §2 first. Every item maps to a task statement.
- Use the next free id range for the subdomain (`FOM-<code>-NNNN`; check the existing files).
- Save to `bank/drafts/slice-<name>.json`. A model-written slice should follow
  `bank/WRITER-BRIEF.md`; a human-written slice can be authored in CSV and imported with
  `npm run bank:import -- --from file.csv` (columns as in `bank:export -- --format csv`).

## 3. Automated passes

```bash
npm run bank:validate -- --source drafts
```

Fix everything it lists (it names the pass and the problem). Typical hits: negatively worded question,
correct option much longer than the distractors, missing distractor explanation, near-duplicate of an
existing item, domain/subdomain mismatch.

## 4. Independent blind review (Pass 8)

```bash
npm run bank:blind-prep        # writes bank/reviews/blind-packets/blind-NN.json without keys
```

Give each packet to a reviewer who has **not** seen the keys — a separate model session following
`bank/REVIEWER-BRIEF.md`, or a practitioner — and collect `bank/reviews/blind-NN.json`
(`[{id, answer, confidence, concern}]`). Then:

```bash
npm run bank:blind-merge                            # lists disagreements and concerns
npm run bank:validate -- --source drafts --write    # records passes + status on every item
```

Items where the reviewer disagreed with the key or raised a concern become `needs_revision`. Decide each
one on the merits: fix the item (and re-review it), re-key it only when the reviewer is right, or
reject it. Do not "fix" an item by making the reviewer's answer the key without checking the sources.

## 5. Promote

```bash
npm run bank:promote            # moves ai_reviewed / human_approved drafts into bank/questions/<subdomain>.json
npm run bank:audit
npm run bank:import             # refresh the local SQLite mirror (the app re-syncs on boot anyway)
```

Promotion bumps `version` and appends to `history` when an existing item's content changed.

## 6. Human sign-off

```bash
npm run bank:promote -- --approve FOM-IIf-0012 --reviewer "A. Example, L.Ac." --note "checked vs Maciocia ch. 25"
```

This is the only way an item becomes `human_approved`. Setting the exam-pool floor to `human_approved`
in the app's Settings restricts exams to those items.

## Quality rules that are easy to forget

- One defensible answer under Maciocia / Cheng Xinnong / Deng. If two schools disagree, drop the item.
- Vignette findings must cohere: tongue, pulse, and symptoms belong to the keyed pattern.
- Distractors are *named* misconceptions, explained in `distractorExplanations`.
- Scope is FOM only — no point locations, needling, herbs, or biomedical diagnoses as keys.
- References name real books and, when confident, a chapter/topic. Never a page number from memory.
- Keep the answer-key balance near 25% per letter per slice (the audit prints it).
