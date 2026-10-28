# ADR-063 — Answer keys: official, carried over, solved by Dexam, or typed by the owner (D-063)

Status: Directed by the product owner on 2026-10-29 ("find the answer keys online; otherwise solve them with high probability").

## Findings

- **CEED:** IIT Bombay publishes Part A answer keys only from 2020. For 2010–2019 the CEED site has question papers but no keys. The CEED 2026 key was published and is now in the bank (44 official keys).
- **NIFT and NID:** neither publishes keys for these papers. The NIFT booklets of a year share questions; a key moves to the same question in another booklet only when its prompt and option texts match (12 questions).

## Decision

1. **Solved by Dexam.** Answers solved from the question text are recorded as `independently-solved`; the platform keeps them held until a second check. These are NIFT and NID general knowledge, English, arithmetic and reasoning, plus a few CEED questions. Visual counting puzzles are left for a person, because solving them from the crops is not reliable enough.
2. **The owner's review is the second check.**
   - Marking a question "Looks right" in the review page confirms a solved key (`second-pass-reproduced`).
   - The review card now has an "Answer key" field. The owner (or a teacher) can type or correct a key while reviewing.
   - Typed keys are stored as `owner-provided`, which the importer trusts.
3. **No guessing:** keys are recorded only with high confidence. Where options are garbled, a solved key that points at a missing option is quarantined by the importer (`key-option-mismatch`).

## Consequences

- **Importer:** `planImport` trusts `owner-provided`.
- **Review plugin:** accepts an optional `answer`: letters such as "A,C", or a number or range such as "6 to 6.5".
- **Workstation:** `tools/apply_owner_verdicts.py` writes typed keys and confirms solved ones. `tools/record_solved_keys.py` and `tools/solver_text.py` / `tools/solver_sheet.py` support the solving pass.
- **Bank on 2026-10-29:**
  - 1,165 official keys;
  - 384 keys carried from matching or positional sources;
  - 712 solved by Dexam, awaiting the owner's confirmation;
  - about 1,700 objective questions still without a key: mostly CEED 2010–2019 visual puzzles, NIFT reading-comprehension passages and garbled OCR.
