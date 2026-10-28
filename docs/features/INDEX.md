# Feature Index

- F001 Authentication — student activation, student sign-in, and employee sign-in implemented
- F002 Roles and permissions — approved foundation implemented under D-003/D-004/D-005/D-008
- F003 Application shell and basic administration — employee-gated Enrolment Operator interface in progress
- F004 Course and enrolment foundation — approved database, activation-pack, and student-own workspace foundation implemented under D-009
- F005 Coursework — implemented and merged through PR #9 under D-013 Option B
- F006 Assignment definition and submission — implemented and merged through PR #11 under D-017/D-018 Option B
- F007 Teacher feedback — implemented and merged through PR #12 under D-014/D-019/D-020 Option B
- F008 Notifications and automation — D-021 Option B implemented and merged through PR #13
- F009 Academic content authoring — implemented and merged through PR #10 under D-015/D-016 Option B
- F010 CRM leads and follow-ups — D-022 Option B implemented and merged through PR #14
- F011 CRM assignment operations — D-023 Option B implemented and merged through PR #15
- F012 Enrolment handoff and identity resolution — D-024 Option B implemented and merged through PR #16
- F013 CRM data lifecycle and privacy operations — D-025 Option B implemented and merged through PR #17
- F014 Hosted staging and release foundation — accepted through PR #25 and protected rebuild run `38298241510` under D-026 Option B
- F015 Staff MFA and session security — fictional staging accepted through PR #33 and protected run `38422519675` under D-027/D-028 Option B
- F016 Employee invitation and password recovery — fictional/local scope accepted through PRs #35–#37 under D-029 Option B; real delivery/reconciliation remain mandatory production gates
- F017 Student assisted account recovery — local implementation verified and merged through PR #40 under D-030 Option B; independent approval required for every reset, hosted execution disabled
- F018 Teacher teaching workspace — deferred under D-031 Option A selected 2026-10-14; retain existing review queue without new teacher reading authority
- F019 Enrolment closeout and student work history — D-032 B approved; implemented and merged through PR #45
- F020 Student learning progress — D-033 B approved; private checklist implemented and merged through PR #47
- F021 Class schedule foundation — D-034 B implemented through PR #49; protected fictional release `38522570468` passed
- F022 Fictional in-app worker operations — PR #50 merged; protected release `38525635333` verified a real scheduled tick and existing authorization/MFA checks
- F023 Private lesson files — D-037 B accepted through PR #54 and protected fictional release `38594311834`; production remains gated
- F024 Curriculum impact preview — D-038 B accepted through PR #56 and protected fictional release `38603078466`; no student migration or default grants
- F025 Fictional pilot readiness — D-039 B active: account isolation fixes, real workflow reruns and explicit remaining acceptance gaps; no production approval
- F026 Authorized navigation — D-040 B accepted through PR #60 and protected fictional release `38691212531`; no new grants or production approval
- F027 Guided fictional pilot review — owner provisionally approved all current UI layouts; actual staff distribution form acceptance passed; no production approval, later visual refinements retained
- F028 Launch-readiness planning — D-042 A approved; sequenced evidence/ownership/cost plan, no implementation or production activation authorised
- F029 Isolated restore rehearsal — D-043 B approved; disposable local DB/file recovery implementation and validation active
- F030 Assignment upload reconciliation — D-044 B approved; tracked uploads and local-only cleanup verified; production activation remains gated
- F031 Uncertain password-recovery incident review — D-045 B approved; independent local incident review implemented/verified, resolution and production remain gated
- F032 Authentication email transport preparation — D-046 B approved; offline adapter verified, live integration/setup/sending remains gated
- F033 Role-separated portals — D-048 B implemented; merged PR #81 after independent review and required CI; distinct entrances/layouts on existing identity/backend, no new grants
- F034 Editable submission versions and repeat attempts — D-049 B approved 2026-10-18; copy-on-write edits until published review, multiple attempts, stale-review and purge fencing; verification active

- F035 Teacher content tools — D-050 B approved; explicit scoped editing/publication, named multi-file references and safe draft-topic removal; verification active

IDs are stable. Use `../templates/FEATURE_SPEC_TEMPLATE.md` for new specifications.

- F036 Isolated Resend connection probe — preparation authorized 2026-10-21; fixed non-credential single-use executor, offline tests only, no handler integration or activation

- F037 Assessment and test-series foundation — D-053 B; fictional runner preview at `/student/tests?preview=1`; merged PR #89
- F042 Exam interface — D-057 redesign step 2; phase 1 exam window (merged #94); phase 2a serves reviewed bank papers to signed-in students; server timer and autosave in phase 2b
- F038 Assessment question bank — D-054 A, D-055 A; redesign step 3: migration, importer and workstation exporter; real bank loaded locally only
- F051 Test-series shell and Papers page — D-057 redesign step 1; `/tests` shell, Papers dashboard with fictional preview data
