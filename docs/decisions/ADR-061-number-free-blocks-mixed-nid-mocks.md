# ADR-061 — Number-free question blocks, owner task collections and mixed NID DAT drawing mocks (D-061)

Status: Directed by the product owner on 2026-10-29.

## Context

The owner's aim is one common bank, mixed into new mock papers for UCEED, CEED, NID and NIFT rather than served paper by paper. Two things stood in the way of mixing:

- **Printed numbers:** the printed blocks (D-060) still carried their source numbers ("Q.06", "Question No. 8", "21A)").
- **No NID mix:** NID mocks existed only as fixed papers. NID DAT is now an all-drawing, 3-hour paper (2026 Prelims: six tasks with sub-parts, 100 marks).

The owner also supplied a scanned collection of NID-style drawing tasks to add to the bank.

## Decision

1. **Number-free blocks.** The workstation's OCR helper now returns the exact box of a leading question number. The cropper paints the number white on every block (sub-part labels such as "21A)" too). This covers "Q.06", "Q7)", "28." and the "Question No. 8" headings of CEED 2013/2015 and others. When OCR missed the number, the space left of the question's first line is blanked instead. Blank answer space is trimmed for every question type.
2. **Owner task collections.** `tools/ingest_task_collection.py` reads a scanned collection page by page, in column order.
   - **Splitting:** it splits tasks at question labels, keeps sub-parts together, drops assignment titles and institute headers, and skips duplicates.
   - **Storage:** each task is clean text with no number, unless it has a real picture; then its exact crop is kept.
   - **Picture references:** tasks that mention a picture missing from the source are flagged.
   - **Review:** every task waits for the owner's review.

   The first collection gave 290 tasks: 5 with pictures, 22 flagged.

3. **Drawing types.** Every drawing task (from every source) gets a type: scene, story, product, communication, problem, creative or skill. It is exported as the topic `drawing-<type>`.
4. **Mixed NID DAT drawing mocks.** `start_drawing_mock` builds a 3-hour, 100-mark mock of six tasks.
   - **B.Des:** scene, story, product, communication, creative and one more.
   - **M.Des:** problem, product, communication, scene, creative and one more.
   - **Pool:** every ready drawing task for the level: NID papers, UCEED or CEED Part B, NIFT CAT, Dexam originals and the owner's collections.
   - **Order:** tasks the student has never had come first.
   - **Pinning:** the tasks are pinned when the mock starts and stay hidden until drawing begins.
   - **Access:** candidates get one free drawing mock per level, the same rule as the objective mocks.

   The mock appears on the Mocks page beside the UCEED, CEED and NIFT mocks, which already mix questions from every source by type. It also appears on the Drawing papers page.

## Consequences

- **Migration** `20261029020000_nid_drawing_mocks.sql`:
  - new functions `assessment_drawing_level`, `assessment_drawing_blueprint`, `assessment_drawing_pool` (service only), `current_person_can_start_drawing_mock`, `list_drawing_mocks` and `start_drawing_mock`;
  - regenerated `begin_part_b` (keeps pinned tasks and their marks) and `get_part_b` (title, pinned count, tasks hidden before the start).
- **pgTAP** `00490_nid_drawing_mocks.test.sql`.
- **Re-crop:** every block was re-cropped, so all crops are pending the owner's review again; none had been approved yet.
- **Printed marks stay:** marks printed inside a block (for example "(20 marks)") are still there. A mixed mock sets its own marks per task.
- **Text quality:** task text from phone screenshots is machine-read, so the review page is where wording errors get fixed.
