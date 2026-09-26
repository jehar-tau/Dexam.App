# F008 — Notifications and Automation

Status: Planned — discovery and channel decisions required
Risk: Yellow; Red for marketing consent, external messaging, or sensitive content

## Outcome

Dexam can notify the right person about an important event at the right time without embedding messaging logic separately into every feature. The same notification foundation supports pre-enrolment operations and enrolled students, while their permissions, consent, templates, and delivery rules remain separate.

## Architecture direction

Build notifications as a separate platform capability connected to product events:

1. A feature records a durable domain event, such as `lead_follow_up_due`, `class_scheduled`, `class_cancelled`, `assignment_published`, or `submission_reviewed`.
2. A notification rule decides whether that event should produce a notification, for whom, and when.
3. A template renders channel-appropriate content without exposing unnecessary personal or academic data.
4. Delivery creates one or more notification records for in-app, email, push, or an approved external channel.
5. The system records delivery status, failure, retry, read state, and cancellation.

The domain event is the source of truth. Notifications are a consequence of the event, not the only record that a class was cancelled or an assignment was published.

## Initial use-case groups

### Marketing and admissions operations

- New lead assigned to an owner
- Follow-up due or overdue
- Student/guardian replied or requested a callback
- Counselling session scheduled, changed, or cancelled
- Application or payment needs attention
- Lead has had no activity for an approved period

These are primarily internal task notifications for authorized Sales or Admin users. Automated promotional messages to prospective students require separate consent, preference, and channel approval.

### Student learning and operations

- Class scheduled, rescheduled, or cancelled
- Assignment published, due soon, or overdue
- Submission received or reviewed
- Teacher feedback available
- Enrolment activated or nearing expiry
- Important course announcement

Urgency must determine behavior. A cancellation may need immediate delivery; a routine reminder may be grouped into a digest. “Overdue” reminders must account for extensions, submission state, and teacher/admin changes.

## Platform concepts

- `domain_events` — durable facts emitted by trusted application workflows
- `notification_rules` — event, audience, timing, channel eligibility, and active state
- `notification_templates` — versioned content by event and channel
- `notifications` — one recipient's in-app notification and read state
- `delivery_attempts` — provider-neutral delivery status, retries, and errors
- `notification_preferences` — permitted channel and category preferences
- `scheduled_jobs` — future reminders and digests with cancellation/deduplication keys

Use a transactional outbox or equivalent database-backed queue so a successful product action cannot silently lose its corresponding event. Begin with Supabase/Postgres scheduling and workers where practical; do not purchase a dedicated automation platform until scale or reliability evidence requires it.

## Rules and safeguards

- Audience selection uses current roles, assignments, enrolments, and lead ownership.
- Suspended people and revoked employees cannot receive protected in-app content or use a notification link to regain access.
- Notification links open an authenticated page that rechecks current authorization.
- Do not place sensitive academic, financial, recovery, or personal data in lock-screen previews, email subjects, or SMS text.
- Transactional/service notifications are distinguished from promotional marketing.
- Marketing messages require recorded consent and a working opt-out where applicable.
- Required operational messages cannot be disabled if doing so would make the service unsafe, but channel choices should be offered when possible.
- Schedule changes cancel or replace obsolete reminders; idempotency prevents duplicates.
- Users do not receive the same event repeatedly because a worker retries.
- All staff-created broadcasts identify the creator, audience, template/version, and send time.
- Rate limits and approval boundaries prevent accidental mass messaging.

## Delivery sequence

### Foundation

- In-app notification centre
- Internal Sales/Admin follow-up alerts
- Student class-change and assignment notifications
- Database-backed event/outbox, scheduling, read state, retry, and audit trail

### Later, after separate approval

- Transactional email through an approved provider
- Mobile/web push after the product has an appropriate installable/mobile surface
- WhatsApp or SMS only after cost, consent, templates, provider, and legal requirements are approved
- User-configurable digests and more advanced no-code automation rules

## Acceptance direction

- Creating the same event twice with the same idempotency key does not send duplicates.
- A cancelled class reminder cannot be delivered as though the class is still scheduled.
- Students receive notifications only for their own active enrolments.
- Teachers and marketing employees receive notifications only for their assigned scope.
- A failed provider attempt retries safely and remains observable.
- A user can mark in-app notifications read without altering the underlying domain record.
- Promotional opt-out stops future promotional delivery without blocking required account/service messages.
- Every mass send and sensitive operational send is auditable.

## Decisions required before implementation

- Which notifications belong in the first usable milestone
- Transactional versus promotional category definitions
- First external channel and provider
- Consent, preference, retention, and quiet-hour rules
- Immediate versus digest defaults
- Who may create templates, automation rules, and broadcasts
- Retry, escalation, and operational monitoring targets
