# Release status and remaining work

Updated 2026-10-17. This is a concise delivery map, not launch permission or a replacement for `PRODUCTION_READINESS.md` and `DEFERRED_WORK.md`.

## Current approved core

Identity/enrolment, scoped admissions CRM, versioned teaching content, assignment distribution/submission, teacher feedback, in-app alerts, classes, private checklist and bounded work archive are implemented within their approved fictional/local scopes. Some operating setup is exercised by fixture scripts rather than a complete production administration interface. Local acceptance does not imply every deferred product module exists.

Recent evidence: 1,140 database assertions, 67 Chromium journeys, actual Storage/concurrency and independent recovery-incident acceptance, and a 68-second isolated application/four-object restore with exact cleanup. F030 helper failure-path coverage adds ten cases. Current build-packaging verification is tracked in the associated PR and `CURRENT_STATE.md`; none of these tests proves real delivery, full Auth recovery or production capacity.

## Remaining launch dependencies

| Area                        | Current boundary                                                                                        | What must happen before real launch                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication email        | Closed mock adapter; external setup deliberately deferred                                               | Owner-controlled sign-in/terms; approved subdomain verification; reviewed live transport/callbacks, private test recipients and actual delivery/failure tests. No API keys or sending enabled.                                    |
| Exceptional recovery        | Independent incident investigation exists; uncertain execution remains blocked                          | Supported proof that provider mutation stopped, current-state reconciliation, approved resolution authority/retention and fault-injection/security acceptance. Never unlock merely on expiry.                                     |
| Recoverability              | Isolated fictional application and file rehearsal passes                                                | Approved full Auth/config/secrets procedure, encrypted off-site DB/object custody, independently durable newer erasure/revocation evidence, production-sized timing and accepted recovery targets/budget.                         |
| Maintenance and observation | Bounded local/service mechanisms and tests exist                                                        | Approved production job identity/scheduling, real completion checks, external observation during service failure, minimized alerts, escalation and rehearsed retry/failure handling.                                              |
| Human operations            | Owner primary, Rohin backup; Siddhant Modi third admin nominee; owner reports staffed 24/7 availability | Verify attributable privileged accounts/MFA and availability without weakening current rules; document private contact, shift handover, acknowledgement/escalation/fallback and rehearse incidents. Nomination creates no access. |
| Capacity                    | Up to 50 students is the planning ceiling, not measured capacity                                        | Confirm file/submission/concurrency workload; measure synthetic peak, latency/errors, disk/egress and quota behaviour; approve budgets and human quota response.                                                                  |
| Privacy and content         | Existing minimized/RLS/retention controls; fictional content only                                       | Actual notices/purposes/rights/request procedures and qualified privacy/security review, including minors and content ownership/import review. No compliance claim.                                                               |
| Production cutover          | Fictional staging only                                                                                  | Exact production environment/domain/configuration, supported staff/offering setup, go/no-go authority, budget, rollback and observation plan. Do not reuse fictional reset/bootstrap against real accounts.                       |

These tasks are not all ordinary coding changes. Account ownership/terms, professional review, human availability, spending, real-data processing and production activation cannot be fabricated by an unattended agent. Continue reversible engineering/testing and planning; preserve the explicit gates without repeatedly asking the same deferred question.

## Deliberately outside this release

Payments/commerce, assessments/scoring, live transcription/proofreading/bulk AI, richer media, external marketing channels, wider Teacher reader/authority, reminders, actual curriculum upgrades and college/professional monetization remain governed by their recorded decisions and the deferred register. “Finish everything” is not treated as silently specifying their business, privacy, authority or spending rules.

No completion percentage or calendar promise is inferred from test counts. The next useful work should close a concrete gap in this map—not merely add tests to imply the application is launch-ready.
