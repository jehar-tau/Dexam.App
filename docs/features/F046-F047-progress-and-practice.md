# F046 and F047 — Progress analytics and topic practice (redesign step 5)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review.

## Purpose

Students need to see whether they are improving and to work on their weak topics between full papers. Step 5 adds the Analytics page (F046) and topic practice (F047), both built on the server attempts and scoring from F044.

## Analytics (`/tests/analytics`)

- **Stats:** papers taken, average and best paper score (%), practice sets, and the share of questions marked right.
- **Progress chart:**
  - **What it plots:** paper score % over time (submission date on X, score / maximum on Y), one line per exam.
  - **Colours:** UCEED, CEED, NID and NIFT keep fixed colours, from the reference categorical palette validated with the dataviz checker for both themes. Every line is labelled at its end with its latest score; a legend appears when there are two or more exams.
  - **Marks and hover:** 2px lines, ringed markers and a hairline grid. A crosshair and tooltip respond to the pointer, and to the arrow keys when the chart is focused.
  - **Text alternative:** the History table is the chart's table view.
- **Topic strengths:** accuracy per topic across every paper and practice set, weakest first, each with a "Practise" link.
- **History:** every submitted paper and practice set, with score, percentage and a link to its result.
- **Preview** (`?preview=1`): fictional progress.

Server: `get_assessment_progress()` returns the caller's own submitted attempts and topic totals (dropped questions excluded).

## Topic practice (`/tests/practice`)

1. Choose an exam (or all exams), a topic, a size (10, 25 or 50) and timed (90 seconds a question) or untimed.
   - Topics show how many reviewed questions exist and how many are new to the student.
   - `?topic=<slug>` preselects a topic; result pages and Analytics link here.
2. `start_assessment_practice()` pins up to that many ready questions on the topic.
   - **Order:** questions the student has never seen in any attempt come first, then a random order.
   - **Replacing:** starting again on the same topic and exam replaces an unfinished set.
3. The set runs in the exam window at `/tests/practice/run/:attemptId`. There is no exam-centre login or declaration; the student starts from a short "Practice set" page.
   - **Untimed sets** hide the clock. The server still closes them after 10 hours.
4. On submit the server scores the set:
   - **Marking:** the selected exam's marking, or Dexam practice marking for all exams, NID and NIFT.
   - **Result:** opens on the same result page, with "Practise again" and "Back to practice".

Server: `list_assessment_practice_topics()`, `start_assessment_practice()`, `get_assessment_attempt()`. Attempts gain `kind` (`paper` or `practice`), `title` and `timed`. Results carry the kind and title.

## Permissions and privacy

Unchanged from F044: active students only, own attempts only, no browser grant on attempt tables, keys released only with a submitted result. Unseen counts are per student.

## Interim defaults (owner to confirm)

- **F047 Decision Gate — do practised questions count as seen for mocks?**
  - **For now:** "unseen first" counts every attempt, papers and practice alike.
  - **Later:** the mock generator (F040) will apply whichever rule you choose.
- **Practice timing:** 90 seconds a question for timed sets.

## Out of scope

- Instant answer checking during practice (answers are revealed in the review after submit).
- The selection-likelihood band on Analytics (F045).
- Time per question (needs server autosave).
- Overview page content.

## Verification

- pgTAP `00410_assessment_progress_practice.test.sql` (27 checks):
  - access for anonymous visitors;
  - topic counts and the exam filter;
  - size, exam and topic validation;
  - pinning, the practice marking and duration, and replacement;
  - resume by id, unseen-first ordering, progress aggregation and isolation between students.
- Vitest: bank calls; the Analytics, Practice and practice-runner pages; the chart's keyboard tooltip.
- Playwright:
  - preview Analytics with the keyboard, the practice link and phone width (`test-series-exam.spec.ts`);
  - `pnpm verify` and the D-056 gate.
