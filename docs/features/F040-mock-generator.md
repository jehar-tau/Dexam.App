# F040 — Mock generator with no-repeat ledger (redesign step 8a)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. The owner granted standing approval to proceed with the recommended defaults, recorded as interim below.

## What it does

`/tests/mocks` offers full-length mocks on the 2026 pattern, built per student from the common question bank:

| Blueprint           | Sections               | Time    | Source                    |
| ------------------- | ---------------------- | ------- | ------------------------- |
| UCEED 2026 (B.Des)  | 14 NAT, 15 MSQ, 28 MCQ | 120 min | Verified 2026 brochure    |
| CEED 2026 (M.Des)   | 8 NAT, 10 MSQ, 26 MCQ  | 60 min  | Verified 2026 brochure    |
| NIFT B.Des GAT 2026 | 100 MCQ                | 120 min | Draft blueprint (interim) |
| NIFT M.Des GAT 2026 | 120 MCQ                | 150 min | Draft blueprint (interim) |

**How each mock is built** (`start_assessment_mock`):

1. Each section is filled with ready questions of that type that the student has **never been served in any attempt**: paper, practice or mock. This is the no-repeat ledger, taken from `assessment_attempt_questions`.
2. **Mixing:** questions from the same exam come first, then the rest of the common bank, in random order.
3. **Shortfalls:** if the bank cannot fill the blueprint, the mock is smaller and the time is scaled to the questions served. The page and the instructions say so.
4. **Order:** questions are pinned in blueprint section order.
5. **Scoring:** the exam's marking applies, through the same server scoring and result page.

**Running it:** mocks run at `/tests/mock/run/:attemptId` with the full exam-centre flow (login, instructions, declaration). An unfinished mock is resumed rather than rebuilt.

`list_assessment_mocks` returns, for each blueprint:

- the questions ready for this student versus the blueprint total;
- the number taken;
- any open attempt;
- whether the student may start one.

## Access (interim)

- **Coaching students:** unlimited mocks.
- **Free candidates:** one mock per blueprint; more need an entitlement (`mock-<key>`) from a plan, F049.
- **NID DAT mocks:** wait for the confirmed 2026 NID format.

## Not yet

- Topic quotas per section. The current topics are keyword guesses; quotas start once the tagging pass is reviewed.
- Part B inside mocks: mocks are Part A only for now.

## Verification

- pgTAP `00450_assessment_mocks.test.sql` (18 checks):
  - unknown blueprints are refused, and the blueprint total is 57;
  - the size equals the blueprint or the unseen pool;
  - a resumed mock is the same mock;
  - NAT comes first;
  - a second mock shares no question with the first;
  - the taken count;
  - isolation between students;
  - one free mock per candidate, then locked (`DX001`);
  - anon is refused.
- Vitest (`TestsMocksPage.test.tsx`):
  - the level filter and the short-pool warning;
  - building a mock and opening the runner;
  - a free candidate's lock;
  - the preview;
  - mock paper notes and scaled time.
- **Live local check, as the fictional student:** the UCEED 2026 mock showed 57 / 57 ready and opened in the exam-centre window. The test attempt was deleted.
