# F044 — Scoring and results (redesign step 4)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. Selection likelihood (F045), time per question and topic practice links (F047) follow.

## Purpose and problem

A mock is only useful once the candidate knows how they did and why. Scores must be computed by the server from keys the browser never sees, and the result must explain itself: section and topic breakdowns, areas to improve, and a review of every answer.

## Users

- Signed-in students with an active student membership (real attempts).
- The fictional preview (`?preview=1`), scored in the browser with fictional keys.

## User flow

1. Opening `/tests/exam/:paperId` opens (or resumes) a server attempt that **pins the exact question versions** shown. Nothing is timed yet.
2. "I am ready to begin" starts the **server clock**; the server returns the deadline. Beginning again returns the same deadline.
3. On submit (or when time runs out) the browser sends the saved responses once. The server validates them, scores every question and closes the attempt; submitting again returns the first result.
4. The browser opens `/tests/results/:attemptId`:
   - score and percentage, accuracy, answered, correct, part-marks and wrong counts;
   - a section table (correct, part, wrong, not answered, marks);
   - areas to improve (weakest topics with at least two questions and under 60% right) and accuracy by topic;
   - a review of every answer, filterable (all, wrong or part, not answered, correct): the candidate's choice, the correct answer, marks awarded, and the explanation when it has been verified;
   - "Take it again" and "Back to papers".
5. The paper page shows the student's attempts with scores and links to each result, and the best score.

## Scoring rules

Server: `assessment_score_response()`. Preview: `scoring.ts`, held to the same golden cases (`src/features/testSeries/scoringGolden.json`, also checked in pgTAP).

| Type       | Rule                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCQ        | Any listed option is correct; anything else scores the wrong-answer marks.                                                                                                                                                      |
| MSQ        | The exact set earns full marks. With partial marking (UCEED/CEED), a non-empty subset of a correct set with no wrong option earns one mark per option chosen; any wrong option earns −1. Alternative keys take the best result. |
| NAT        | An exact value (`2.00` equals `2`) or a value inside an accepted range, inclusive.                                                                                                                                              |
| Dropped    | Scores nothing and leaves the maximum.                                                                                                                                                                                          |
| Full marks | Everyone gets the correct-answer marks.                                                                                                                                                                                         |
| Blank      | Not answered, 0.                                                                                                                                                                                                                |

**Marking** (pinned on the attempt):

- **UCEED:** NAT +4/0; MSQ +4 with part marks, −1; MCQ +3/−0.71.
- **CEED:** the same, except MCQ +3/−0.5.

Both follow the verified 2026 Part A brochures.

**NID and NIFT** publish no per-question scheme. They use **Dexam practice marking**, +1 per correct answer with no negative marks, labelled as such on the instructions and the result.

## Data and privacy

- `assessment_attempts` and `assessment_attempt_questions` hold the person, the paper, the pinned questions, responses, outcomes and marks.
- There is no browser grant on either table. Students reach them only through `open_`, `begin_`, `submit_`, `get_assessment_attempt_result` and `list_assessment_attempts`, each limited to the caller's own attempts.
- Answer keys and verified explanations are returned only for the caller's own submitted attempts. Provenance and licences are never returned.
- A student can read figures of questions in their own attempts even after a question is retired, so a result stays reviewable.

## Interim defaults (owner to confirm)

- **Attempt policy:** a student may re-take a paper. Each attempt is pinned and scored on its own, and the best score is shown. One open attempt per paper at a time.
- **Late submissions:** responses received more than two minutes after the server deadline are still scored, and the attempt is marked "after the deadline". Phase 2b autosave will remove the need for this.
- **Practice marking** for NID and NIFT, as above.

## Known limits

- Questions are returned when an attempt opens, before the clock starts. This is acceptable for self-paced papers, but the all-India live mock (R3) must release questions only at the scheduled start.

## Out of scope

- Selection likelihood bands (F045, Decision Gate).
- Time per question (needs phase 2b autosave).
- Practice links from areas to improve (F047).
- Server autosave during the exam (F042 phase 2b). Responses stay on the device until submit.

## Security considerations

- Scores are computed only on the server, from server-held keys, using marking pinned when the attempt opened.
- Responses are validated:
  - only questions in the attempt;
  - strings of at most 32 characters, or at most 6 letters A–F.
- Attempts cannot be begun, submitted or read by another student. pgTAP covers this.
- Preview keys are fictional and live in the browser only for the fictional paper.

## Acceptance criteria

1. **Golden cases:** every case passes in pgTAP and Vitest.
2. **Lifecycle:**
   - open pins the ready questions;
   - begin sets a server deadline;
   - submit before begin is refused;
   - double submit returns the first result;
   - no result is released before submission;
   - a new attempt opens after submission.
3. **Isolation:** another student cannot begin, submit or read an attempt.
4. **Results:** the page shows score, sections, topics, areas to improve and the filterable review. It works at phone width.
5. **Failed submit:** if submission fails, answers stay on the device and "Try again" resubmits.

## Verification plan

- pgTAP: `00400_assessment_attempts_scoring.test.sql`.
- Vitest: scoring, bank calls, the exam window and the results page.
- Playwright: `test-series-exam.spec.ts`.
- `pnpm verify` and the D-056 gate.

## Relevant sources and ADRs

D-054 (`ADR-054-test-series-programme.md`), D-057 (`ADR-057-test-series-experience.md`), F038, F042, `docs/assessment/TEST_SERIES_PROGRAMME.md`.
