# F052 — Printed question blocks, owner review and drawing papers

Status: Implemented 2026-10-29 under D-060 (`../decisions/ADR-060-printed-blocks-and-drawing-papers.md`).

## Printed blocks

- **Workstation:** `tools/crop_question_blocks.py` crops each question from its page renders into `server/data/media/<paper>/blocks/<id>.png`, with confidence flags in `block_meta_json`.
  - It handles questions that run across a page break, and leaves out headers, footers and section headings.
  - Drawing tasks lose their blank answer boxes.
  - NIFT text questions stay as text.
- **Exam window:** shows the block in place of the text. It is used by:
  - the result review;
  - Part B tasks and the Part B result card;
  - drawing papers.

## Number-free blocks and mixed NID mocks (D-061)

- **Numbers:** blocks carry no question numbers. The cropper paints over "Q.06", "Q7)", "28.", "Question No. 8" and sub-part labels such as "21A)", so a block can sit in any paper under a new number.
- **Owner collections:** collections of drawing tasks go into the bank with `tools/ingest_task_collection.py <pdf> --paper nid-task-collection-NN --title …`. Each task becomes clean text, or an exact crop when it has a picture, and every task waits for the owner's review.
- **NID DAT mocks:** "NID DAT mock, built for you" (on Drawing papers and Mocks) mixes six tasks of different drawing types from every source for the student's level: 3 hours, 100 marks, unseen tasks first.

## Owner review (local only)

1. In the workstation, run `python3 tools/export_platform_bank.py`. It writes `dexam-bank-export.json` and `dexam-review.json`.
2. Start the dev server with the workstation data:

   ```bash
   DEXAM_REVIEW_DATA="$HOME/Documents/Default Project/Dexam_Mock_Test/server/data" pnpm exec vite --host 127.0.0.1 --port 5180
   ```

3. Open `http://127.0.0.1:5180/review/questions`.
   - **Filters:** exam, paper, type, status ("Not reviewed yet", "Flagged by the cropper", "Marked to fix", "Marked right") and search.
   - **Each card shows:**
     - the question in the exam window's own view, which you can try;
     - the answer key and the source page;
     - what approval does.
4. Apply the verdicts:
   1. In the workstation, run `python3 tools/apply_owner_verdicts.py`. It prints the fix reasons, so patterns can be applied across the bank.
   2. Run the export again.
   3. Run `pnpm assessment:import --file … --media …`.

## Drawing papers (`/tests/drawing`)

- **Listing:** `list_drawing_papers()` lists every paper with ready drawing tasks: minutes, marks, whether it is locked for the caller, and the caller's latest sitting.
- **Starting:** `start_drawing_paper(paper)` creates or resumes a `drawing` sitting. It applies the same access rules as opening the paper, including candidates' free slots. The student continues at `/tests/part-b/<attempt>`.
- **Groups:**
  - NID DAT drawing mocks (3 hours, 100 marks, six tasks);
  - Part B drawing papers (UCEED 60 minutes, CEED 120 minutes);
  - NIFT CAT (3 hours);
  - NID past-paper drawing tasks.

## Tests

- **pgTAP** `00480_question_blocks_drawing_papers.test.sql`:
  - the display mode in the payload, and the minutes per exam;
  - listing and starting, and resuming a sitting;
  - the 3-hour clock, and task marks adding up to 100;
  - drawing sittings kept out of scores, access refusal and privacy.
- **Vitest:**
  - block mapping in the exam window;
  - importer rules for block questions and hash stability;
  - Drawing papers page and names;
  - a drawing paper in the Part B screen;
  - review plugin path safety and verdict validation.
- **Playwright:**
  - the Drawing papers preview, with B.Des and M.Des;
  - the review page is absent from a build.
