# ADR-059 — One student portal with a left sidebar (D-059)

Status: Directed by the product owner on 2026-10-28 (standing instruction to execute without further questions). Supersedes the "separate `/tests` shell" part of D-057.

## Context

D-057 gave the test series its own shell with a left sidebar, while the coaching student portal (`/student`) kept a row of tabs across the top. Students moved between two different-looking products. The test series also had an Overview page and a separate Analytics page showing overlapping numbers, plus a Bookmarks placeholder and a Sketches page.

## Decision

1. **One shell.** `src/app/student/StudentShell.tsx` is the layout for both `/student/*` and `/tests/*`.
   - Left vertical sidebar on desktop; off-canvas menu on phones.
   - **Coaching students** see: Home, Notifications (with the unread count), then **Coaching**: Coursework, Assignments, Study checklist, Class agenda, Work archive, then **Test series**: Overview, Practice, Papers, Mocks.
   - **Public candidates** (Google sign-in) see the Test series group only, because the coaching routes are not theirs.
   - A coaching student who is also an employee gets "Switch to …" links in the sidebar footer.
   - Light theme by default, with optional dark, as before.
   - URLs are unchanged.
2. **Overview and Analytics merge.** `/tests` shows the stats, Up next, the progress chart, topic strengths and every result. `/tests/analytics` redirects to `/tests`.
3. **Bookmarks and Sketches are removed.** Both URLs redirect to `/tests`. Part B sheets, marks and evaluator feedback now appear on the paper's result page (`PartBResultCard`), and Part B's final screen links back to the result.

Staff, teacher and admin portals keep their existing layout.

## Consequences

- Access is unchanged:
  - `/student` routes still sit behind `StudentAccessBoundary`, and the routes that refused preview still do;
  - `/tests` routes still sit behind `TestsAccessBoundary`.
- `list_my_part_b` is no longer called by the app. The RPC is kept for now; removing it needs a migration.
- Tests:
  - `StudentShell.test.tsx` covers the coaching, candidate and dual-employee sidebars;
  - the e2e journeys cover moving between coaching and test-series pages in one sidebar, and the retired URLs redirecting.
