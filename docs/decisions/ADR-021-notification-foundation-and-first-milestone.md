# ADR-021 — Notification Foundation and First Milestone

Status: Decision required
Date: 2026-10-10
Decision ID: D-021
Risk: Yellow — student/staff attention, private educational context, automation, and future messaging cost; Red if external promotional delivery is added

## Question

What notification architecture and user-visible scope should Dexam build first, before the CRM, class-scheduling domain, or any paid external messaging provider exists?

## Why this needs your decision

Notifications affect what students and employees are told, when they are interrupted, which records they can reach, and whether important events can be missed or duplicated. The platform already has assignment release, submission, and teacher-feedback events that can support a useful first inbox. It does not yet have the CRM or class-scheduling source records needed for reliable marketing follow-ups or class-change alerts. Email, SMS, WhatsApp, and push also introduce consent, opt-out, provider, privacy, and variable-cost decisions that are not approved.

The first implementation should therefore create a durable foundation without pretending that a notification is the source of truth or committing Dexam to an external channel too early.

## Options

### A — Add a simple in-app inbox directly inside each feature

Each existing feature would insert its own notification rows and the application would show a bell/inbox with read and unread states. There would be no shared domain-event outbox, versioned template registry, scheduling model, or central idempotency policy.

- **Impact:** Fastest visible implementation for assignment and feedback alerts.
- **Cost:** No provider cost and the least initial engineering work.
- **Risk:** Notification logic becomes duplicated across features; a successful business transaction could lose its alert; retries can create duplicates; future CRM and scheduling work would require a redesign.
- **Reversibility:** Moderate because early notification records and feature-specific triggers would need migration.

### B — Build an event-backed in-app foundation with essential academic notifications (recommended)

Build a provider-neutral notification platform around a transactional database outbox. The business transaction and its domain event commit together. An idempotent worker converts eligible events into one recipient-specific in-app notification using a versioned, code-controlled template. The notification is a pointer to the source record, not a copy of sensitive student work or feedback.

The first visible milestone would include:

1. **Students:** assignment published, teacher feedback available, and correction requested.
2. **Teachers:** a submitted attempt is ready for review within their current offering scope.
3. **Shared interface:** unread count, notification centre, mark-one-read, mark-all-read, empty/loading/error states, and authenticated links that recheck current authorization.

Assignment release, submission finalization, and feedback publication would emit durable events from their existing trusted database functions. Duplicate event keys and unique recipient/event constraints would make retries safe. Revoked employees, suspended people, ended enrolments, or removed teaching scope would fail closed at read time and link-open time. Notification text would contain only a safe summary such as “Feedback is available”; feedback content, grades, personal details, and private file names would remain on the authorized destination page.

For this first milestone:

- Delivery is immediate and in-app only. No email, push, SMS, WhatsApp, or paid automation service is enabled.
- Notifications are categorized as required account/service or academic operations, never promotional marketing.
- Required in-app academic/service notifications cannot be disabled yet; read state is a presentation preference, not evidence that the underlying task is complete.
- Delivered inbox records are retained for 12 months, then purged by a service-only cleanup job. Domain events and security audit evidence follow the retention policy of their source record.
- Templates and event-to-recipient rules are version-controlled in migrations/code. No broadcast composer or end-user automation builder is included.
- Class schedule/cancellation notifications wait for an authoritative scheduling feature. Marketing follow-up alerts wait for the CRM and lead-ownership model.
- External channels, promotional consent/opt-out, quiet hours, digests, and channel preferences require later Decision Gates.

- **Impact:** Delivers a useful student/teacher inbox now and creates the reusable foundation required by future scheduling and CRM work.
- **Cost:** No external service cost. It requires more database, worker, RLS, cleanup, UI, and test work than Option A but stays within the existing Supabase/React stack.
- **Risk:** More initial engineering surface, controlled by a narrow event list, private summaries, current-state authorization, bounded retention, and deterministic local tests.
- **Reversibility:** High. The worker, templates, rules, and later channel adapters remain replaceable while durable source events stay stable.

### C — Launch in-app notifications plus email/WhatsApp and marketing automation now

Build the shared event platform and immediately connect student external messages and pre-enrolment marketing follow-ups through selected providers.

- **Impact:** Broadest communication capability and earlier off-platform reach.
- **Cost:** Introduces provider setup, message fees, monitoring, template management, consent records, support work, and potentially recurring automation-platform cost.
- **Risk:** Highest consent, privacy, deliverability, accidental-mass-send, and vendor-lock-in exposure before the CRM and scheduling sources of truth exist.
- **Reversibility:** Low to moderate because messages already sent, consent mistakes, incurred charges, and provider reputation effects cannot be undone.

## Recommendation

Approve Option B. It provides immediate value for the academic workflows Dexam already has, preserves the free-first constraint, and builds the reliable event/outbox boundary needed for future marketing operations without prematurely selecting a provider or inventing CRM and scheduling data.

## What approval would authorize

Option B would authorize the database event/outbox, in-app notification records, 12-month inbox retention, current-state RLS, idempotent local worker, version-controlled safe templates/rules, notification-centre UI for students and teachers, and integration with assignment release, submission finalization, and feedback publication. It would not authorize external delivery, promotional messages, contact-channel collection, paid services, class-schedule alerts, CRM follow-ups, broadcasts, or production deployment.

## What can continue while pending

Documentation, event naming, threat modelling, and test planning can continue. User-visible notification behavior, retention enforcement, recipient selection, and event emission must wait for approval.

Please choose Option A, B, or C, or give another direction.
