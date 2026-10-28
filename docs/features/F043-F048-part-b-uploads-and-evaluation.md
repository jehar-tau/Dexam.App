# F043 and F048 — Part B drawing, uploads and evaluation (redesign step 7)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. The owner granted standing approval to proceed with the recommended defaults, recorded as interim below.

## Purpose

UCEED, CEED, NID and NIFT all have a drawing part. Candidates draw on paper, then photograph or scan their sheets. Dexam evaluators mark them against each task and release the Part B score.

## Flow

1. After Part A of a paper is submitted, its result page shows **Part B: drawing** whenever the paper has ready drawing tasks (bank questions with `response_mode = 'upload'`).
2. `/tests/part-b/:attemptId` explains Part B. **Begin Part B** (`begin_part_b`) pins the paper's ready drawing tasks and starts the drawing clock:
   - **UCEED:** 60 minutes.
   - **CEED:** 120 minutes.
   - **NID and NIFT:** 15 minutes a task (practice timing).
3. **I have finished drawing** (`start_part_b_upload`), or the end of drawing time, opens a **10-minute upload window**.
   - **Files:** each task takes up to 5 JPEG, PNG or PDF files of at most 10 MB, uploaded to the private `assessment-part-b` bucket.
   - **Paths:** `<attempt>/<task>/<random>.<ext>`.
   - **Registration:** each file is registered with `register_part_b_upload`.
4. **Submit Part B** (`submit_part_b`) locks the sitting. An unsubmitted window closes on its own.
5. **Evaluation** happens at `/staff/part-b`, which needs the `assessment.part_b.evaluate` capability.
   - **Queue:** shows a candidate reference (`CAND-…`) only, never a name.
   - **Marking:** the evaluator opens a sitting, sees each task's prompt and uploaded sheets, and saves marks (0 to the task maximum) with feedback.
   - **Release:** once every task is marked, **Release** sets the Part B score.
6. **Sketches** (`/tests/sketches`) lists the student's sittings: sheets, status, and, after release, marks and feedback. The result page shows the same status.

## Marks

- **UCEED and CEED:** 100 marks shared equally across the pinned tasks (interim; the official papers give per-task marks in the prompt).
- **NID and NIFT:** 10 marks a task (practice).

## Security

- **Uploads:** the storage insert policy (`current_person_can_upload_part_b`) admits a file only when all of these hold:
  - the path is well-formed (UUID / UUID / UUID with a JPEG, PNG or PDF extension);
  - the attempt belongs to the caller and is in its drawing or upload window;
  - the task is pinned on that attempt;
  - the task has fewer than 5 files.

  The bucket also limits the MIME types and the 10 MB size.

- **Reading sheets:** limited to the owner and evaluators. Evaluators can also read a task's figures.
- **Tables:** `assessment_attempt_tasks` and `assessment_part_b_uploads` have no browser grants.
- **Marks:** students cannot mark their own work. Marks and feedback reach the student only after release.
- **Anonymity:** evaluators never receive the candidate's name.

## Interim defaults (owner to confirm)

- **F048 gate, who evaluates:** Admin (`elevated_admin`) for now. Teacher scoping and paid evaluation for public candidates come later.
- **Upload window:** 10 minutes, within the 5–10 minute range in the brief.
- **Part B timing and marks:** as above, from the 2026 blueprint drafts.
- **Drawing-only papers:** papers with no ready objective questions (NIFT CAT, NID mains) are not offered yet, because Part B follows Part A.

## Verification

- pgTAP `00440_part_b_uploads_evaluation.test.sql` (40 checks):
  - Part B only after Part A;
  - pinned tasks and marks, the CEED clock, and a stable restart;
  - upload path, task and type checks;
  - registration against the right task;
  - owner can read; no uploads after submit; students cannot self-mark;
  - no marks before release;
  - other students locked out;
  - an anonymous queue, the marks ceiling, mark-all-before-release, and release;
  - the student sees the score and feedback.
- Vitest (`PartB.test.tsx`): file rules; begin, draw, upload and submit; refusing an unsupported file; Sketches; evaluator marking and release.
- **Live local check, as the fictional student on CEED 2024:**
  - Part A submitted, then the result offered Part B with 5 tasks;
  - the drawing clock showed 2:00:00, and finishing drawing opened the 10-minute window;
  - a PNG sheet uploaded through the storage policy and showed as a thumbnail;
  - after submitting, Sketches showed the sitting "Awaiting evaluation" with the sheet.
