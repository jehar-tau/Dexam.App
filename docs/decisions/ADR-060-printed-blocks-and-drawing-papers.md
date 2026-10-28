# ADR-060 — Printed question blocks, owner review and timed drawing papers (D-060)

Status: Directed by the product owner on 2026-10-28 (standing instruction to execute; the owner reviews the questions next).

## Context

The bank held 4,183 questions from the official papers, but only 695 were served:

- **Missing figures:** most UCEED, CEED and NID questions depend on figures. CEED and NID had no crops at all, and the UCEED crops had never been reviewed.
- **Missing options:** several hundred questions print their options as images, so they had no structured options.
- **Part B:** drawing tasks were served as text, without the pictures that their prompts refer to, and Part B could only be taken straight after Part A.
- **NID:** NID DAT 2026 Prelims (21 December 2025) changed to a single 3-hour, 100-mark, all-drawing paper of six tasks with sub-parts. The bank had no paper in that pattern.

## Decision

1. **Exact printed blocks.** The workstation crops every question from its source page as one block. This works for UCEED, CEED, NID and the NIFT picture questions:
   - the block runs from the question's number to the next question's, across page breaks;
   - page headers, footers and section headings are left out;
   - drawing tasks lose their blank answer boxes;
   - nothing is redrawn.

   A question with an approved block is shown exactly as printed (`display_mode = 'block'`), with the answer buttons below it. Its options are printed inside the block, so the buttons carry only their letters. The prompt text stays in the page for screen readers.

2. **The owner approves every crop.** A local-only review page renders each question exactly as the exam window does. It runs at `/review/questions` on the dev server, reading the workstation export through a dev-server plugin.
   - The owner marks each question "Looks right" or "Needs a fix" (with reasons and a note).
   - Verdicts are written back to the workstation. `tools/apply_owner_verdicts.py` approves or rejects the crops, and the next export and import serve the approved ones.
   - Until then:
     - text-only questions stay as text;
     - picture questions, and drawing tasks whose prompts point at pictures, stay held.
3. **Timed drawing papers.** A paper's drawing tasks can be taken on their own: attempt kind `drawing`, with no Part A.
   - **Timing:** UCEED 60 minutes, CEED 120 minutes, NID DAT drawing mocks and NIFT CAT 180 minutes, and older NID drawing tasks 20 minutes each.
   - **Flow:** Part B's own flow runs it: instructions, the clock, the 10-minute upload window, anonymous evaluation.
   - **Marks:** tasks may carry their own marks (`task_marks`).
   - **Scores:** drawing sittings stay out of the scored attempt list and the progress chart.
4. **NID DAT drawing mocks.** Dexam wrote eight original mocks (five B.Des, three M.Des) on the 2026 pattern.
   - **Format:** six tasks for 100 marks in 3 hours.
   - **Task themes:** visual storytelling, alternative uses, opinion with visual communication, design for safety, redesign for three users, and visual metaphor.
   - **Content:** the prompts are Dexam's own, not reconstructions of the 2026 paper.

## Consequences

- **Migration** `20261029010000_question_blocks_drawing_papers.sql`:
  - new columns `display_mode` and `task_marks`, the attempt kind `drawing`, and `drawing_minutes`;
  - new functions `assessment_drawing_paper_minutes`, `list_drawing_papers` and `start_drawing_paper`;
  - regenerated `assessment_question_payload`, `begin_part_b`, `get_part_b`, `list_assessment_attempts` and `get_assessment_progress`.
- **Importer:** the export carries `display` and `taskMarks`.
  - The import sets them on the imported version.
  - A block question needs no option text.
  - The content hash leaves the new fields out unless they are set, so existing text questions keep their versions.
- **No bank content in the repository:**
  - the review page has no route in builds;
  - its plugin applies to the dev server only;
  - verdicts and media stay in the workstation.
- **Repaired:** the UCEED 2015–2017 rows that had stored the paper's instructions as Q1–Q6 now hold the real questions; their answer keys were already right.
- **Not done yet:**
  - answer keys for CEED 2010–2019 and 2026, NID and most NIFT;
  - NIFT reading-comprehension passages;
  - mock blueprints for NID DAT that draw on the bank, rather than the fixed original mocks.
