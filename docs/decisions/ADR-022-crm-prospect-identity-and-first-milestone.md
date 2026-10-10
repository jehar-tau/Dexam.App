# ADR-022 — CRM Prospect Identity and First Milestone

Status: Option B approved 2026-10-10
Date: 2026-10-10
Decision ID: D-022
Risk: Red — prospect/guardian personal data, identity duplication, Sales authority, consent, and enrolment conversion

## Question

How should Dexam represent and manage pre-enrolment enquiries so Sales can own leads and follow-ups without creating duplicate students, gaining enrolment authority, or prematurely enabling external marketing automation?

## Why this needs a decision

The product owner wants notifications for employees handling marketing before a student joins. F008 now provides a durable, free in-app notification foundation, but it cannot know who owns a lead or when follow-up is due until CRM records become the source of truth.

This slice introduces personal contact data and visible Sales workflow. It must also reconcile two approved principles: D-004 says lead relationships should eventually attach to canonical people, while D-008 says Sales cannot create a canonical student, approve enrolment, or issue access. The chosen design must preserve both boundaries.

## Options

### Option A — Standalone lead rows with free-form contact details

Create a simple `leads` table containing name, phone/email, status, owner, note, and next follow-up. Link it to a person only after enrolment.

- **Impact:** Fastest CRM screen and easiest spreadsheet-style import.
- **Cost:** Lowest initial engineering work and no external service cost.
- **Risk:** Repeats contact data, encourages guardian/student confusion, weakens duplicate detection, and requires a difficult reconciliation migration during conversion.
- **Reversibility:** Moderate to low once real records and activity histories depend on duplicated free-form identity fields.

### Option B — Identity-aware enquiry, ownership, and follow-up foundation (recommended)

Treat an enquiry as a specific expression of interest, separate from a person, student membership, enrolment, contact permission, and account. A trusted intake workflow creates or links non-authenticated prospect-person records and explicit self/guardian/prospective-student relationships after bounded duplicate checks. Creating a prospect person grants no login, student membership, academic access, or entitlement.

The first slice includes:

1. Manual enquiry creation with minimum source, contact route, target exam/interest, and intake context.
2. One current Sales owner, append-only ownership history, and a separate `lead.assign` capability.
3. An assigned queue, bounded activity outcomes, one current follow-up task, and deliberate reschedule/cancel/complete history.
4. A small lifecycle: new, contact in progress, engaged, qualified, enrolment review requested, converted, or closed.
5. Free F008 in-app alerts for lead assignment and due/overdue follow-up.
6. An explicit D-008 handoff: Sales may request enrolment review, while an Enrolment Operator resolves identity candidates and creates/links student membership and enrolment.

A phone number is a matching signal, not a unique human identifier. Guardian and student remain separate people. Weak matches are never merged automatically. Ordinary Sales users receive only a minimal “possible match requires operator review” result, not another person's private record.

No marketing consent is inferred from an enquiry. No email, WhatsApp, SMS, push, campaign, bulk send, website ingestion, payment, scoring, or paid provider is enabled. Those remain later decisions.

- **Impact:** Gives Sales a usable, auditable CRM and supplies reliable events for internal notifications while preserving the existing enrolment authority boundary.
- **Cost:** More schema, trusted workflows, RLS, duplicate-candidate handling, history, and tests than Option A; still ₹0 external-service cost in development.
- **Risk:** Introduces controlled prospect PII and a new trusted person-creation path. Risk is contained through minimum fields, current assignment scope, no authentication/membership creation, bounded duplicate results, and Enrolment Operator conversion review.
- **Reversibility:** High. Enquiry, person, contact, task, notification, and enrolment boundaries remain separate; external providers and future intake channels can be replaced independently.

### Option C — Adopt or build a full CRM and marketing suite now

Launch customizable pipelines, website capture, campaigns, templates, scoring, bulk communication, analytics, and multichannel automation in the first CRM release.

- **Impact:** Broadest commercial feature set and fastest path to complex marketing operations.
- **Cost:** Highest implementation/operations burden or recurring vendor cost, plus migration, integration, training, and monitoring work.
- **Risk:** Premature personal-data collection, consent mistakes, accidental mass sends, vendor lock-in, opaque scoring, and confused authority before the basic admissions workflow is validated.
- **Reversibility:** Low to moderate because data, staff habits, provider reputation, messages already sent, and recurring cost are difficult to unwind.

## Recommendation

Approve Option B. It directly supports the requested internal marketing-team notifications, stays within the free-first architecture, respects existing Sales/enrolment separation, and builds clean identity and workflow boundaries without pretending Dexam needs an enterprise CRM today.

## What approval would authorize

Option B would authorize the F010 first-slice specification: minimum prospect/contact records, manual enquiry intake, duplicate-candidate checks, explicit guardian/student relationships, assigned-owner queue, ownership/activity/follow-up history, the proposed lifecycle, a separate assignment capability, in-app assignment/follow-up notifications, and an explicit enrolment-review handoff.

It would not authorize production personal data, public website integration, external messages, marketing campaigns, consent assumptions, contact import/export, payment collection, AI lead scoring, a paid CRM/provider, or production deployment. CRM retention/deletion and the exact website intake path must be approved before production use.

## Consequences if approved

- F010 becomes the active implementation slice after approval.
- DW-032 moves from roadmap discovery into active CRM foundation work.
- DW-023 becomes implementable for internal assignment/follow-up notifications.
- DW-024 remains deferred because promotional automation still requires consent, provider, template, sender, cost, and opt-out decisions.
- The public marketing website remains separate until a later authenticated, rate-limited, consent-aware intake integration is approved.

## Approval

The product owner approved Option B on 2026-10-10. Dexam may build the identity-aware, manually operated first CRM slice described above, including minimum prospect/contact records, assigned ownership, bounded activity outcomes, follow-up history, enrolment-review handoff, and free in-app assignment/follow-up alerts. This approval does not authorize production personal data, external communication, website intake, campaigns, exports, paid services, or production deployment.

The product owner clarified the approved closed-enquiry behavior on 2026-10-10: Sales may move an owned active enquiry out of the active queue with a reason; it remains in a Recently dead area for seven days and then appears automatically in a common Dead archive. This is a reversible lifecycle state over the same audited record, not deletion or copying. Authorized Sales may restore the enquiry to Contact in progress with a reason, while the closure and restoration history remains attributable.
