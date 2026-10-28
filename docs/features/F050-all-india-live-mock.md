# F050 — All-India live mock (redesign step 8c, R3)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review. The seat cap is an interim default (organisers set it per event) until the owner decides it. No live event exists anywhere yet.

## What exists

**Organisers** (`/staff/live-events`, capability `assessment.live.manage`, on `elevated_admin`):

1. **Schedule a draft** (`create_live_event`): key, title, pattern (UCEED or CEED 2026), Part A start, optional registration close (defaults to the start), a 15–20 minute break and a seat limit. Part A uses the blueprint's time (UCEED 120, CEED 60 minutes); Part B is UCEED 60 or CEED 120 minutes; the upload window is 10 minutes, as for every Part B.
2. **Publish** (`publish_live_event`, before registration closes): pins **one** question set to the blueprint (same exam first) and the Part B tasks (UCEED 2, CEED 5), so every participant sits the identical paper and ranks are fair. Publishing opens registration.
3. **Cancel** (`cancel_live_event`) before Part A starts.

**Students** (Mocks page → "All-India live mocks", then `/tests/live/:key`):

| Phase        | What the page shows                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Registration | Seats left and **Register**; registering gives a roll number (`KEY6-00001`) and is idempotent.    |
| Waiting room | The countdown to Part A, the schedule and the rules.                                              |
| Part A       | **Enter Part A** (or Return): the exam-centre window, with the deadline fixed by the event clock. |
| Break        | The countdown to Part B, and the Dexam cohort rank.                                               |
| Part B       | **Open Part B**: the Part B page on the event's tasks and clock, then the 10-minute upload.       |
| Finished     | Ranks, and a link to the Part A answers.                                                          |

The page refreshes itself when a phase turns, and every 30 seconds.

## Rules enforced by the server

- **Questions are released only when Part A starts** (`join_live_part_a` refuses before with `DX006`, after with `DX007`). Only registered students can enter.
- **One clock for everyone:** the attempt's start and deadline are the event's, however late the student joins. Part A submits itself at the deadline, like every timed paper.
- **Answers stay hidden until Part A ends** for everyone (`get_assessment_attempt_result` returns `DX006` for live attempts until then), so nobody can share keys mid-exam.
- **Ranks** (`get_live_event_standing`) are published after Part A ends: rank, percentile and the top 10 by **roll number only**, never names. Papers submitted more than 2 minutes after the deadline are not ranked. Labelled "Dexam cohort rank — an estimate, not an official rank".
- **Part B** (`begin_part_b`, live branch) opens only after the break, uses the event's tasks and ends at the event's Part B end for everyone.
- **No repeats:** the paper's questions join each participant's seen record, so they never appear in that student's later mocks or practice.
- Registration closes at its time (`DX004`) or when seats run out (`DX005`).

## Security

- `live_events`, `live_event_questions`, `live_event_tasks` and `live_event_registrations` have no browser grants; every read and write goes through SECURITY DEFINER functions with `search_path = ''`.
- Drafts are visible only to organisers. Students see published events only.
- Standings never expose names or person ids.

## Not yet

- Load-testing autosave and timer traffic at the target seat count on Supabase Pro (required before the first real event).
- Paid event passes (F049 has no live-event plan yet), reminders by email, and organiser analytics.
- A student who closes the tab before the deadline keeps an unsubmitted Part A, so they are unranked.

## Verification

- pgTAP `00470_live_mock_events.test.sql` (48 checks): no browser grants; only organisers create, publish and cancel; blueprint, start and break validation; drafts hidden; one publish, never after registration closes; roll numbers and idempotent registration; seat limit and closing; Part A refused before the start and to unregistered students; the event deadline; identical papers; answers held until Part A ends; ranks, percentile, roll-number-only top list; late papers unranked; Part B after the break on the event's tasks and deadline; cancelling.
- Vitest `TestsLivePage.test.tsx`: countdown and phase helpers, registration, entering Part A, the cohort rank card, late visitors, the Mocks page list and the organiser page.
- Playwright: the waiting room in preview, and the organiser page needing staff sign-in.
