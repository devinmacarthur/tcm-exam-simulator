# Verified Examination Specification

**Target examination:** Foundations of Oriental Medicine (FOM) examination module
**Administering organization:** National Certification Board for Acupuncture and Herbal Medicine (NCBAHM™), formerly the National Certification Commission for Acupuncture and Oriental Medicine (NCCAOM®)
**Research date:** 2026-10-19
**Status:** Positively identified. See §1 for why this is not an NCBTMB exam.

Everything in this document is either (a) quoted or paraphrased from an official NCBAHM/NCCAOM document with a citation, or (b) explicitly marked **UNVERIFIED** or **SIMULATOR DESIGN CHOICE**. Nothing here is invented.

---

## 1. Which exam is this?

The project brief referred to the "NCBTMB Foundations of TCM exam". Two candidate bodies were checked.

| Organization | What it administers | TCM/Oriental Medicine foundations exam? |
|---|---|---|
| **NCBTMB** (National Certification Board for Therapeutic Massage & Bodywork) | One exam: the Board Certification Examination for Therapeutic Massage and Bodywork (BCETMB), 140 questions / 140 minutes, pass/fail. Revised domains effective May 4, 2026: Assessment, Care Planning & Documentation 25%; Massage Techniques & Modalities 24%; Anatomy, Physiology & Kinesiology 24%; Professional Practice 14%; Law & Ethics 13%. [S7], [S8] | **No.** None of its domains are TCM theory. No "Foundations" exam exists at NCBTMB. |
| **NCBAHM** (formerly NCCAOM) | Four exam modules: Foundations of Oriental Medicine (FOM), Biomedicine (BIO), Acupuncture with Point Location (ACPL), Chinese Herbology (CH). FOM + BIO + ACPL are required for the Diplomate of Acupuncture credential. [S3 p.7] | **Yes.** The "Foundations of Oriental Medicine" module is the only US certification exam matching the brief's description. |

**Conclusion:** The intended exam is NCBAHM's **Foundations of Oriental Medicine** module. The brief's "NCBTMB" attribution was a mix-up between two similarly named boards. The name "Foundations of East Asian Medicine" does **not** appear in any official NCBAHM document found; the official module name in all 2026 documents remains "Foundations of Oriental Medicine" (FOM).

**Name change:** NCCAOM became NCBAHM effective January 2, 2026. Credentials earned before that date remain valid; credentials earned after are issued under NCBAHM. [S6a], [S6b]

**Workspace context:** This simulator was built in the Domains workspace where Yarree's Oregon acupuncture licensure (Fall 2026) is tracked. Oregon licensure runs through NCBAHM certification, which is consistent with the identification above. (This is context, not a source for the spec.)

---

## 2. Current content outline (effective September 1, 2026)

NCBAHM's Exam Content Outlines page lists the 2020 outlines as current "until the next national Job Analysis study" and separately lists four new outlines under the heading **"Effective September 1, 2026"**. [S1] Because today's date (2026-10-19) is after that date, **the 2026 outline is the operative blueprint** for this simulator.

### 2.1 Domains and weights — 2026 FOM Content Outline [S2], confirmed in [S3 pp.19–21]

| Domain | Weight |
|---|---|
| **I. Patient Assessment Methods** | **28%** |
| I-A. Observation / Looking (Wang) | 6% |
| I-B. Auscultation and Olfaction / Listening and Smelling (Wen) | 3% |
| I-C. Inquiry / Asking (Wen) | 10% |
| I-D. Palpation / Touching (Qie) | 9% |
| **II. Pathomechanisms and Pattern Differentiation** | **38%** |
| **III. Treatment Planning** | **34%** |

Domain II and III have no official sub-weights; they list the theories/tasks below without percentages.

### 2.2 Task statements (verbatim structure from [S2])

**Domain I — Patient Assessment Methods (28%)**

- **I-A Observation (6%)**: 1. Identify manifestation of Spirit (Shen) (complexion, general behavior). 2. Assess appearance of eyes, nose, ears, mouth, lips, throat, face (color, moisture, texture, corresponding organ locations). 3. Identify manifestations of the tongue (body, coating, sublingual veins). 4. Assess appearance of the body (shape, movement, head, hair, neck, back, chest, abdomen, extremities, blood vessels, skin, nails). 5. Assess appearance of excretions (mucus, saliva, sweat, discharge, stool, urine, blood).
- **I-B Auscultation and Olfaction (3%)**: 1. Assess respiratory sounds, voice, tonal qualities, speech. 2. Identify odors of body, breath, excretions, secretions.
- **I-C Inquiry (10%)**: 1. Identify presenting complaints (onset, location, aggravation). 2. Formulate additional questions based on responses and findings. 3. Conduct a Review of Systems using the "Ten Questions" (Shi Wen) and other approaches. 4. Identify etiological factors: internal (emotions), external (environment), miscellaneous (diet, occupation). 5. Assess personal and family health history.
- **I-D Palpation (9%)**: 1. Differentiate characteristics of the radial pulses (rate, depth, strength). 2. Identify findings from palpation of other body areas (abdomen, torso, limbs) and channels (temperature, texture, pain, tissue quality, edema).

**Domain II — Pathomechanisms and Pattern Differentiation (38%)**

1. Analyze assessment findings to establish pattern differentiation and underlying pathomechanism(s) based on: (a) Yin/Yang; (b) Five Elements (Wu Xing); (c) Eight Principles (Ba Gang); (d) Qi, Blood, Body Fluids (Qi, Xue, Jin Ye); (e) Channel (Jing Luo) — 12 primary channels, eight extraordinary channels, Luo-connecting channels; (f) Organ (Zang Fu); (g) Six Stages; (h) Four Levels (Wei, Qi, Ying, Xue); (i) Triple Burner (San Jiao); (j) Internal etiology (seven emotions, stress); (k) External etiology (wind, damp, cold, dryness, heat, summer heat, pestilential Qi); (l) Miscellaneous etiology (diet, lifestyle, trauma); (m) Chinese organ clock.

**Domain III — Treatment Planning (34%)**

1. Formulate appropriate treatment principles based on theories (a)–(l) above (same list minus organ clock). 2. Establish treatment priorities (Root and Branch [Ben Biao], acute vs. chronic) and develop a treatment plan. 3. Modify the treatment plan based on patient's response, disease progression, lifestyle factors. 4. Explain assessment findings and the treatment plan to the patient. 5. Counsel the patient on self-care home management techniques (Qi Gong, Tai Ji, breathing). 6. Provide dietary recommendations according to Chinese medicine (temperature, taste, functions).

### 2.3 What is NOT on this exam

Acupuncture point location, needling technique, safety, and herbal formulas belong to the ACPL and CH modules [S1], [S3]. They are **excluded** from this question bank except where channel *theory* (Domain II-e / III-1-e) or dietary therapy (III-6) requires them. Biomedical diagnosis belongs to the BIO module and is excluded.

### 2.4 Superseded outline (for reference only)

The 2020 outline (effective Jan 1, 2020 through Aug 31, 2026) used three domains at **35% / 35% / 30%** with different domain names (Clinical Examination Methods; Assessment, Analysis and Differential Diagnosis; Treatment Principle and Strategy). [S5] Third-party prep sites still quoting 35/35/30 or the older 2014-era 10/45/45 split are out of date. The simulator keeps the 2020 blueprint in `bank/blueprint.json` as an inactive alternative for comparison only.

---

## 3. Format, length, timing

| Item | Official value | Source |
|---|---|---|
| Format | Computerized adaptive testing (CAT) | [S3 p.14], [S4 Q2] |
| Number of questions | 100 multiple-choice questions | [S3 p.14], [S4 Q1] |
| Time limit | 2.5 hours (150 minutes) | [S3 p.14] |
| Question type | Multiple-choice; sample items show four options (A)–(D), single best answer | [S3 pp.47–48] |
| Answer revision | **Not possible.** "candidates are unable to change their responses to previous questions" | [S3 p.15], [S4 Q2, Q12] |
| Going back / review | **Not possible.** CAT "does not allow the test-taker to go back to review a question once they have moved onto the next question" | [S4 Q12] |
| Unanswered questions | "Candidates must answer all the questions for the examination to be scored" | [S4 Q12] |
| Domain distribution | "questions are selected for candidates according to the assigned domain percentages from the examination content outline" | [S3 p.14] |
| Pretest items | "All examinations include scored items as well as a limited number of pretest items… Pretest items do not count toward a candidate's total score." Number **not published**. | [S3 p.10] |
| Negatively worded items | Item writers are instructed to avoid "negatively worded questions that use 'not' or 'except'" | [S3 p.9] |
| Item standard | "Items must have a single correct answer that can be verified by at least one reference" | [S3 p.9] |
| Delivery | Pearson VUE test centers; preliminary pass/fail shown on screen at completion | [S3 p.15] |

**UNVERIFIED:** whether the 100 questions include or exclude the pretest items; the specific Pearson VUE interface (navigation controls, confirm-answer dialog, on-screen calculator, etc.); whether a time-expiry auto-submit scores the attempt.

---

## 4. Scoring

- "There is no predetermined number of items that must be answered correctly to pass an adaptive examination." [S3 p.15]
- The raw score, "taking into consideration item difficulty, is transformed into a scaled score." [S3 p.15]
- "Scaled scores range from 1 to 99 with 70 designated as the passing score. Scaled scores do not represent the percentage of questions answered correctly." [S3 p.15], [S4 Q19]
- The passing standard is set by a panel of practicing, licensed, Board-certified acupuncturists through standard setting. [S3 p.15]
- A pass letter shows no numerical score; a fail letter shows the overall scaled score and a breakdown by domain. NCBAHM cautions that per-domain scaled scores are based on small numbers of items and are less reliable. [S3 p.16], [S4 Q20]

**Consequence for this simulator:** The official scaled-score conversion is proprietary (item-response-theory based) and is **not published**. This simulator therefore reports **raw percentage correct only**, overall and per domain, and never displays a "scaled score" or a pass/fail prediction. Readiness labels in the app are internal study classifications (see §7).

---

## 5. Official sample questions

The 2026 handbook publishes three FOM sample items (FOM-1 to FOM-3) with the caveat that they "do not necessarily represent the difficulty level" and "performance on the sample questions is not an indicator of performance." [S3 pp.47–48] They are **not reproduced** in this bank. Their *format* informed the style guide: four lettered options; short theory recall items (Five Element correspondences); clinical vignettes (age, chief complaint, duration, associated symptoms, tongue, pulse) ending in "Which of the following is the most appropriate diagnosis?"; treatment-principle vignettes ending in "…most appropriate treatment principle?" with lowercase verb-phrase options.

---

## 6. Suggested bibliography (official) [S2 p.4]

NCBAHM states the content outline is the primary resource, recommends no single text, and lists these as resources frequently used by its item writers:

1. Cheng Xinnong (Ed.), *Chinese Acupuncture and Moxibustion*, 4th ed., Foreign Languages Press, 2019.
2. Deng Tietao, *Practical Diagnosis in Traditional Chinese Medicine*, Churchill Livingstone, 1999.
3. Kastner, Joerg, *Chinese Nutritional Therapy: Dietetics in Traditional Chinese Medicine*, 3rd ed., Thieme, 2021.
4. Maciocia, *Diagnosis in Chinese Medicine*, 2nd ed., Elsevier, 2018.
5. Maciocia, *The Foundations of Chinese Medicine*, 3rd ed., Elsevier, 2015.
6. Maciocia, *The Practice of Chinese Medicine*, 3rd ed., Elsevier, 2021.
7. Maclean, Lyttleton, Bayley, Taylor, *Clinical Handbook of Internal Medicine*, 2nd ed., Eastland Press, 2018.
8. Scheid, Bensky, Ellis, Barolet, *Chinese Herbal Medicine: Formulas and Strategies*, portable 2nd ed., Eastland, 2015.
9. Wiseman & Ellis, *Fundamentals of Chinese Medicine*, revised ed., Paradigm, 1995.
10. Wu Yan & Fischer, *Practical Therapeutics of Traditional Chinese Medicine*, Paradigm, 1997.

Terminology convention adopted by this bank: Maciocia / Cheng Xinnong style ("Liver Blood deficiency", "Spleen Qi deficiency", "Wind-Cold", pinyin in parentheses on first use), since these dominate the official list and the official sample items use that register.

---

## 7. How the simulator maps to the official exam

| Official feature | Simulator behavior | Label |
|---|---|---|
| 100 questions, 150 minutes | Default full exam: 100 questions, 150-minute countdown, auto-submit at expiry | Official (verified) |
| Domain weights 28/38/34, I-A..I-D 6/3/10/9 | Exam assembly draws exactly 28/38/34 (6/3/10/9) per attempt | Official (verified) |
| Sub-weights inside Domains II and III | Internal sub-weights in `bank/blueprint.json` | **SIMULATOR DESIGN CHOICE** (no official sub-weights exist) |
| CAT (adaptive difficulty) | Not simulated. Each attempt is a fixed, randomized form balanced by difficulty tier. True CAT needs calibrated item parameters that do not exist for an original bank. | **SIMULATOR DESIGN CHOICE** |
| Cannot go back / change answers / review | **Fidelity mode** (default for Full Exam): forward-only, answer locks on "Next", no review panel. | Official (verified) |
| Navigation panel, flagging, answer revision | **Linear-review mode** (optional toggle): conventional navigation panel with flags and revisable answers. | **SIMULATOR DESIGN CHOICE** (not how the real exam works; offered for practice convenience) |
| All questions must be answered | Fidelity mode cannot advance without an answer; Linear-review mode warns on unanswered items at submission | Official / design choice |
| Scaled score 1–99, pass 70 | **Not shown.** Raw percent only. | Official constraint (conversion unpublished) |
| Pretest items | Not simulated | Design choice |
| Pass/fail on screen | Not shown; readiness labels instead | Design choice |

---

## 8. Sources

- **[S1]** NCBAHM, *Exam Content Outlines* page (last modified 2026-03-04). https://www.ncbahm.org/exam-content-outlines/ — lists 2020 outlines as current and the 2026 outlines "Effective September 1, 2026".
- **[S2]** NCBAHM, *Foundations of Oriental Medicine Content Outline, Effective September 1, 2026* (PDF, © 2026, 4 pp.). https://www.ncbahm.org/wp-content/uploads/pdf/NCBAHM_FOM_Exam_Content_Outline-w-Bibliography_Jan_2026.pdf — copy archived at `docs/NCBAHM_FOM_Exam_Content_Outline-w-Bibliography_Jan_2026.pdf`.
- **[S3]** NCBAHM, *Acupuncture (AC) Candidate Preparation Handbook*, Updated May 2026 (PDF, 62 pp.). https://www.ncbahm.org/wp-content/uploads/pdf/2026_AC_Candidate_Preparation_Handbook.pdf — copy archived at `docs/2026_AC_Candidate_Preparation_Handbook.pdf`. Linked from the NCBAHM Prep Handbooks page https://www.ncbahm.org/certification/ncbahm-exam-preparation-center/study-guides/.
- **[S4]** NCCAOM, *2022 Examination FAQs*, Updated February 2022 (PDF). https://www.ncbahm.org/wp-content/uploads/pdf/2022_NCCAOM_Examination_FAQ_Final.pdf
- **[S5]** NCCAOM, *Foundations of Oriental Medicine Content Outline and Bibliography*, effective January 1, 2020, updated June 2021 (PDF). https://www.ncbahm.org/wp-content/uploads/pdf/2020-FOM-Content-Outline-and-Bibliography-Updated-June-2021.pdf
- **[S6a]** Indiana Professional Licensing Agency, Acupuncture home page notice (Jan 2, 2026 name change). https://www.in.gov/pla/professions/acupuncture-home/
- **[S6b]** NCBAHM, *NCCAOM Name Change FAQs* (PDF). https://ncbahm.org/wp-content/uploads/pdf/NCCAOM_Name_Change_FAQs_Final.pdf ; see also Acupuncture Today, "NCCAOM finalizes name change", https://acupuncturetoday.com/article/39769-nccaom-finalizes-name-change
- **[S7]** NCBTMB, *Board Exam Breakdown* (PDF, Jan 2026). https://ncbtmb.org/wp-content/uploads/2026/01/Board-Exam-Breakdown.pdf
- **[S8]** AMTA, "NCBTMB Announces New Domains for Board Certification Exam". https://www.amtamassage.org/about/news/updates-to-bcetmb/

Third-party pages consulted and **not relied on** for any specification: tcmreview.com, ccmu.edu (quotes the superseded 35/35/30 outline), aomtestprep.com, tcm.ac, asaom.edu (links to the 2026 outlines under legacy nccaom.org URLs that now 404).

---

## 9. Open items for the candidate to confirm

1. The exact test date. Candidates testing **before** September 1, 2026 were assessed on the 2020 outline; everyone after is on the 2026 outline. This simulator defaults to 2026.
2. Whether NCBAHM publishes an updated Examination FAQ for 2026 (the newest found was 2022; the 2026 handbook supersedes it on all points checked and agrees with it).
3. Whether any 2026 standard-setting changed the scaled passing score. The May 2026 handbook still states 70.
