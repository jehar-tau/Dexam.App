# F051 — Test-series shell and Papers page (redesign step 1)

Status: Implemented locally 2026-10-28 under D-057; in review.

## Purpose and problem

The test series needs its own product shell and a papers dashboard where every paper is one click away, replacing the demo that lived inside the coaching portal.

## Users

- Signed-in students with an active student membership.
- The fictional preview (`?preview=1`) when `VITE_ENABLE_STUDENT_PREVIEW` is on.

## User flow

1. A student opens `/tests/papers`, either from the student portal's "Test series" link or directly.
2. They see a stats strip, choose B.Des or M.Des, and can filter to one exam.
3. Each exam card shows its papers as year tiles. The newest paper carries a "Free" badge, the current cycle's paper a "New" badge, and an attempted paper its best score and attempt count.
4. A tile opens `/tests/papers/:paperId`. "Start timed paper" is disabled until the step 2 exam window exists.

## In scope

- `TestsShell` (`src/app/tests/`): skip link; sidebar with seven sections; profile; student-portal link; sign-out for a real session; light/dark toggle; mobile top bar and off-canvas menu; `?preview=1` preserved on every link.
- `TestsPapersPage` and the paper page (`src/pages/tests/`), plus placeholder pages for the five sections built in later steps.
- `paperCatalog` (`src/features/testSeries/`): metadata only (exam, level, year, variant, sample flag, maximum marks), and fictional preview progress.

## Out of scope

- Real attempts and scores: they need F038 and the results step.
- Entitlements and locks (F041), onboarding (F039) and the exam window (step 2).

## Permissions

The shell sits behind the existing `StudentAccessBoundary`: an active student membership, or the fictional preview flag. No new grants.

## Business rules

- One free paper per exam: the first paper listed (newest, or the official sample where no dated paper is newer). Final entitlement rules belong to F041.
- "New" marks only a dated paper from `currentCycleYear`.
- Outside preview, no fictional progress or stats are shown. Stats read zero or "—".

## Interface states

| State              | Behaviour                                                 |
| ------------------ | --------------------------------------------------------- |
| Loading and access | Handled by `StudentAccessBoundary`.                       |
| Empty              | Real students see zero stats and "Start →" on every tile. |
| Unknown paper      | "Paper not found" with a link back.                       |
| Phone width        | Menu button, no horizontal overflow.                      |

## Data and privacy

No personal data beyond the signed-in Member ID shown in the profile. The catalogue holds no question content.

## Analytics events

None.

## Security considerations

- Routing and presentation only.
- No new data access: the catalogue is static, and preview fixtures appear only when the preview flag is on.
- Theme storage is wrapped so blocked storage cannot break the page.

## Relevant sources and ADRs

- D-054 (`ADR-054-test-series-programme.md`)
- D-057 (`ADR-057-test-series-experience.md`)
- `docs/assessment/TEST_SERIES_PROGRAMME.md`

## Acceptance criteria

1. `/tests/papers` shows the sidebar with Papers active, the stats strip, the level switch, the exam filter and the year tiles.
2. B.Des lists UCEED, NID DAT and NIFT; M.Des lists CEED, NID DAT and NIFT.
3. The light theme is the default, dark toggles and persists, and the whole page re-themes.
4. The phone layout has a working menu and no horizontal scroll.
5. Unit tests cover the catalogue rules, the shell, the page and the theme. An end-to-end test covers desktop and mobile.

## Verification plan

Vitest (catalogue, page, shell), Playwright (`tests/e2e/test-series-papers.spec.ts`), `pnpm verify`, and the D-056 gate.

## Open decisions

None for this step.
