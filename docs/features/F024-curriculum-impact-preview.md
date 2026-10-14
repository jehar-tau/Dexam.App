# F024 — Read-only curriculum impact preview

Status: Locally verified and independently reviewed under D-038 Option B; PR/release pending
Risk: Red — scoped aggregate enrolment information

Selected current employees need existing content-publication and enrolment-operation authority plus an explicit revocable offering-scoped `curriculum.upgrade_preview` grant. No role receives this automatically and a global preview grant cannot bypass scope.

Compare two distinct published versions in one active offering. Show topic/lesson/material differences using stable section/topic/lesson codes, counts of changes and aggregate active enrolments pinned to the source, separated into direct and active-cohort assignment. Do not return student identifiers, names, Member IDs, individual records, private checklists, grades, file IDs/URLs, or passive analytics. Staff-scope context contains only allowed offerings/published version metadata. Display up to 100 differences with total/truncation notice; counts cover all.

No writes, proposals, notices or migration operation. Student access, assignments, feedback and progress remain unchanged. Preview uses existing design primitives and a real staff session; no public preview bypass. No new vendor, paid service, real data or production activation.

Verification: all three permission prerequisites, offering/global-scope denial, expired/revoked grants/roles/employment, student/Teacher-only denial; source/target publication/same-offering checks; stable code matching, shared material identities and change counts; direct/active-cohort aggregate counts with closed/unassigned exclusions; minimized payload keys; read-only row invariance; generic frontend failures, user-isolated caching, responsive UI, real SDK/Chromium and independent security review. Actual migration remains DW-011 with a separate policy gate.

Local acceptance 2026-10-14: 259 application tests, 1040 database assertions, 63 Chromium journeys, full format/lint/type/build checks, and real SDK/Chromium comparison with explicit disposable offering grants. Verified minimal aggregate report, unchanged enrolment, API/UI revocation denial, desktop/mobile visual layout and no horizontal overflow. Combined F023 file acceptance/concurrency/purge regressions also passed; exact fictional objects/accounts/domain fixtures removed and trigger flags restored. Independent Codex security review cleared implementation before PR. No automatic grant or production activation.
