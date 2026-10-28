# F042 — Exam interface (redesign step 2)

Status: Phase 1 (client exam window on a fictional paper) merged 2026-10-28 (#94). Phase 2a (real bank papers for signed-in students) implemented locally 2026-10-28 with F038; in review. Phase 2b (server-authoritative timer, autosave and submit lock) follows with scoring (F044).

## Phase 2a: bank papers

- Preview (`?preview=1`) keeps the fictional practice paper. A signed-in student opening `/tests/exam/:paperId` gets the bank paper behind that catalogue paper (`bankPaperId()`): only reviewed (ready) objective questions, in paper order, grouped into NAT, MSQ and MCQ sections by first appearance.
- **Marking and time:** UCEED and CEED use the verified 2026 Part A pattern (UCEED 120 minutes; NAT +4/0, MSQ +4/−1 with part marks, MCQ +3/−0.71. CEED 60 minutes; MCQ +3/−0.5). When only some questions are ready, the official time is scaled to the questions shown, at least 5 minutes. NID and NIFT publish no per-question scheme, so marking shows "—" and timing is one minute per question.
- The login and instruction pages say how many of the paper's objective questions are shown and how the time was set.
- Figures are shown byte-for-byte from signed links, scaled down to fit but never cropped or redrawn.
- **States:** loading; "This paper is still being reviewed" when nothing is ready or the paper is not linked to the bank; "This paper could not be opened" when the server refuses.
- The paper page shows signed-in students "N of M questions have been reviewed and are ready" and hides Start when none are.

## Purpose and problem

Candidates need to rehearse on a screen that behaves like the official computer-based exam, so that exam day holds no surprises: exam-centre style login, instructions, a declaration, a timed screen with sections, the question palette and the official answering rules, and a submit summary.

## Users

- Signed-in students with an active student membership.
- The fictional preview (`?preview=1`) when `VITE_ENABLE_STUDENT_PREVIEW` is on.

## User flow

1. On a paper page (`/tests/papers/:paperId`), "Start timed paper" opens `/tests/exam/:paperId`, full screen and outside the test-series shell.
2. **Candidate login:** name, roll number (the Member ID; `DXM-PREVIEW0001` in preview) and paper. "Sign in" continues, "Back to papers" leaves.
3. **General instructions:** the clock, the palette legend, moving between questions, answering each question type. "Next".
4. **Paper instructions:** question count, duration, the marking table per section, and the declaration checkbox. "I am ready to begin" is disabled until the declaration is ticked. "Previous" goes back.
5. **Exam screen:** header with paper and candidate; section tabs with answered counts; the countdown; the question with its marks and type; the response area (radio buttons, checkboxes, or the numeric keypad); "Mark for Review & Next", "Clear Response" and "Save & Next"; the palette with the legend and counts for the current section, and "Submit".
6. **Submit:** a confirmation dialog with the per-section summary and the number of unanswered questions. "No, go back" (default focus, also Escape) or "Yes, submit".
7. **Submitted:** the summary, "Take it again" and "Back to papers". When time runs out, the paper is submitted automatically and the page says so.

## Answering rules (official behaviour)

- A response is kept only through **Save & Next** or **Mark for Review & Next**. Jumping away through the palette or a section tab discards an unsaved choice.
- Saving an empty response clears the saved one. **Clear Response** removes the saved response but keeps a review mark.
- **Save & Next** removes a review mark; **Mark for Review & Next** adds one, with or without a response.
- "Answered and marked for review" responses count for marking.
- After the last question, "Next" wraps to the first.
- Numerical answers accept an optional leading minus, digits and one decimal point, up to 12 characters, from the keypad or the keyboard.

## In scope (phase 1)

- `src/features/testSeries/examPaper.ts`: the paper shape and the fictional practice paper (14 questions: 4 NAT, 4 MSQ, 6 MCQ; 20 minutes). It carries no answer keys.
- `src/features/testSeries/examAttempt.ts`: pure transitions (begin, go to, Save & Next, Mark for Review & Next, Clear Response, submit, expiry), statuses and counts, the clock format, numeric sanitising, and validated local persistence.
- `src/pages/tests/exam/`: the login, instruction, exam, dialog and submitted screens, and the fictional figures.
- The paper page's "Start timed paper" link.

## Out of scope

- Real paper content, figures and image zoom (F038 bank and media).
- Server-authoritative timer, server autosave with idempotency keys, and a server submit lock (phase 2).
- Scoring, results and review (F044); attempt policy (F040/F041).
- Part B drawing and uploads (F043).

## Permissions

The route sits behind `StudentAccessBoundary`, like the rest of `/tests`. No new grants or data access.

## Business rules

- Every catalogue paper opens the fictional practice paper until F038 serves real ones; the login and instruction pages say so.
- The exam window always uses the light theme and restores the previous theme on leaving.
- An attempt is stored in the browser under `dexam-exam-attempt-v1:<account>:<paperId>`, so a reload resumes it and a shared computer never shows one candidate another's attempt. Stored data is validated, and anything malformed or pointing at an unknown question is ignored. An attempt whose deadline has passed is submitted on load.
- While the exam is running, the browser warns before the page is closed or reloaded.
- The palette status colours follow the official exam (grey not visited, red not answered, green answered, purple marked for review, purple with a green dot for answered and marked). This settles the F042 palette-colour gate under the owner's D-057 approval of an official-looking exam window; brand orange is used for actions.

## Interface states

| State                | Behaviour                                                         |
| -------------------- | ----------------------------------------------------------------- |
| Unknown paper        | "Paper not found" with a link back; nothing is stored.            |
| Five minutes or less | The clock turns red and a polite live region announces it once.   |
| Time up              | Automatic submission and a "Time is up" heading.                  |
| Phone width          | Palette behind a "Question palette" button; no horizontal scroll. |
| Blocked storage      | The attempt still works for the page view; it cannot resume.      |

## Data and privacy

No new personal data. The candidate name is the fictional preview name or the Member ID already shown in the shell. The local attempt holds question IDs and responses only.

## Analytics events

None.

## Security considerations

- Phase 1 is presentation only: no network calls, no answer keys in the bundle, nothing scored.
- Local storage is user-controlled, so it is validated with a schema and never trusted for scoring; phase 2 moves the attempt, timer and submit lock to the server.
- Local attempts are keyed by the signed-in account, so candidates sharing a coaching-centre computer cannot open each other's attempts.
- No HTML is injected: figures are React SVG components, and question text renders as plain text.
- Preview fixtures appear only when the preview flag is on (`previewSearch`).

## Relevant sources and ADRs

- D-054 (`ADR-054-test-series-programme.md`), D-057 (`ADR-057-test-series-experience.md`)
- `docs/assessment/TEST_SERIES_PROGRAMME.md`

## Acceptance criteria

1. Login, general instructions, paper instructions with the declaration gate, the exam screen, the submit dialog and the submitted page work in order.
2. The answering rules above hold, and the palette shows all five statuses.
3. The clock counts down and submits automatically at zero.
4. A reload resumes the attempt; tampered storage is ignored.
5. The phone layout has the palette toggle and no horizontal scroll.

## Verification plan

Vitest (`examAttempt.test.ts`, `ExamWindowPage.test.tsx`), Playwright (`tests/e2e/test-series-exam.spec.ts`), `pnpm verify`, and the D-056 gate.

## Open decisions

None for phase 1. Attempt policy (one attempt or re-attempts) is decided with F040/F041.
