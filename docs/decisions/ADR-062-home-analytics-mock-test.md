# ADR-062 — Analytics on Home, one Mock test tab, and Part B in UCEED/CEED mocks (D-062)

Status: Directed by the product owner on 2026-10-29.

## Decision

1. **Home carries the analytics.**
   - **Coaching students:** the portal Home (`/student`) shows the test-series analytics: stats, Up next, the progress chart, topic strengths and every result. They sit under the welcome and above the enrolments.
   - **Candidates:** their home is `/tests`, the same analytics titled "Home".
   - **Sidebar:** "Overview" leaves it, and `/tests` sends coaching students to `/student`.
2. **One "Mock test" tab.** It holds four exams and nothing else: UCEED, CEED, NID DAT and NIFT. One click on an exam builds a new paper from the common bank and starts it.
   - **B.Des / M.Des:** a switch picks the level for NID and NIFT.
   - **Removed:** Papers (year-wise), Mocks and Drawing papers.
   - **Old links:** Papers, Mocks and Drawing land on Mock test; Analytics, Bookmarks and Sketches land on Home.
3. **Part B in UCEED and CEED mocks.** After Part A, Part B pins drawing tasks from that exam's own Part B papers, tasks the student has never had first.
   - **UCEED:** one drawing task and one design-aptitude task, 50 marks each, 60 minutes.
   - **CEED:** five tasks of 20 marks, 120 minutes.
   - **Upload window:** when the drawing time ends, students get 10 more minutes to photograph or scan their sheets and upload them.

   NIFT mocks have no Part B; NIFT CAT stays a separate drawing test.

4. **Drawing tasks keep their printed answer space.** The boxes and frames show students where, and how much, to draw.

## Consequences

- **Migration** `20261029030000_mock_part_b.sql`: new functions `assessment_mock_part_b_size`, `assessment_mock_part_b_pool` and `assessment_pin_mock_part_b` (service only); regenerated `begin_part_b` and `get_part_b`.
- **pgTAP** `00500_mock_part_b.test.sql`.
- **Pages:** TestsPapersPage, TestsMocksPage and TestsDrawingPage are removed. `TestsMockTestPage` replaces them. Live mocks stay reachable from Home's "Up next".
- **Still available:** the year-wise exam window (`/tests/exam/<paper>`) and its results still work for past sittings, but nothing links to start one.
