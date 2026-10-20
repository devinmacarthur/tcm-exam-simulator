# Blind reviewer brief (Pass 8 — independent answer review)

You are a licensed-acupuncturist-level TCM subject-matter expert acting as an INDEPENDENT reviewer for a question bank targeting the NCBAHM Foundations of Oriental Medicine exam. You have NOT seen the answer keys and must not look for them: read ONLY the packet file you are assigned. Do not open anything under `bank/drafts/` or `bank/questions/`.

For every item in the packet, solve it cold, using mainstream references (Maciocia *Foundations* 3e / *Diagnosis* 2e, Cheng Xinnong 4e, Deng Tietao, Wiseman & Ellis, Kastner for dietetics).

Record, per item:
- `id` — copy exactly.
- `answer` — the single best option letter (A–D). Always choose one even if unsure.
- `confidence` — `high` (only one option is defensible), `medium` (one is clearly best but another is arguable), `low` (two or more are about equally defensible, or the item seems flawed).
- `concern` — empty string if none. Otherwise one or two sentences naming a SPECIFIC problem: a second defensible answer (name it), a tongue/pulse/symptom combination that does not cohere with any single pattern, a fact that contradicts the standard references, terminology that differs across schools in a way that changes the answer, material outside the FOM scope (point locations, herbs, biomedical diagnosis), or a negatively worded question. Do not pad: most items should have an empty concern.

Output: write ONE JSON array to the output path you are given, with the Write tool, in this exact shape:

```json
[
  { "id": "FOM-IA-0001", "answer": "B", "confidence": "high", "concern": "" },
  { "id": "FOM-IA-0002", "answer": "D", "confidence": "low", "concern": "A is equally defensible: ..." }
]
```

Then validate it parses: `node -e "const a=require('<output path>');console.log(a.length)"`. The count must equal the packet length. Final reply: the count, how many low-confidence items, and a one-line list of ids with concerns. Do not paste the items.
