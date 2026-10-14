# D-031: First teacher teaching workspace

Status: Approved — Option A (review queue only; broader workspace deferred)
Date: 2026-10-14
Risk: Yellow — teacher curriculum and assignment-reading authority

## Question and evidence

What should teachers see beyond the existing submission-review queue? F005 explicitly deferred assigned-teacher curriculum access and DW-010 records the missing teaching workspace. Current curriculum RLS permits the owning active student and separately approved authoring scopes, not a general teacher reader. A Teacher role must not silently expose every program, unpublished work, student contacts or authoring tools. This is a genuine access/product decision, not a new hosting purchase.

## Options

### A — Keep the review queue only for now

Continue existing submission/feedback operations and defer the broader teaching workspace. Teachers do not gain new curriculum-reading access.

- Cost: ₹0 additional vendor spend.
- Impact: Least new scope; teachers still need separate reference material to prepare lessons.
- Reversibility: B or C can be specified and added later.

### B — Assigned-offering teaching reader (recommended)

Give current explicitly assigned teachers a read-only workspace for published, currently assigned curriculum versions within their authorized offering scope: sections, topics, lessons, released assignment briefs/private reference materials and published evaluation guidance. Provide navigation into the existing review queue without bypassing its submission-level authorization. Recheck current person, live session, employee membership, Teacher role and explicit offering authority on every protected read/download.

No unpublished drafts, authoring/publication, new feedback authority, account support, CRM/contact data, broad roster, attendance, schedule or automatic messaging. Do not display individual enrolment details merely to determine which version is currently used. Revoked/suspended/expired/cross-offering teacher scope fails closed; no global Teacher-role wildcard.

- Cost: ₹0 additional vendor spend using the approved stack and fictional fixtures; ordinary existing hosting/storage limits still apply.
- Impact: A focused teacher preparation space consistent with student coursework and existing review tools; current explicit teaching scope must be set for each offering.
- Reversibility: Add separate roster/scheduling modules later without changing canonical identity or published curriculum history.

### C — Plan the broader teaching dashboard now

Extend discovery to cohort rosters, class scheduling/cancellation and attendance as well as B. Before implementation, specify each data field, teacher scope, attendance correction/history, scheduling authority, notification effects and privacy/retention rules. Choosing C authorizes that expanded design/discovery, not guessed policies or real student data.

- Cost: Discovery/local fictional implementation can stay ₹0 additional vendor spend; more engineering/testing than B. External messages/providers remain separate cost approvals.
- Impact: More complete classroom operations, but larger personal-data and business-rule decisions before development.
- Reversibility: Modules can be staged later; collected real attendance/personal data cannot be recalled, and none is authorized here.

## Original recommendation and gate

Engineering recommended B to connect coursework and review tools without expanding into rosters or class operations prematurely. The owner selected A instead, as recorded below. B/C remain available alternatives but require a future explicit scope approval before implementation. No option authorizes production, real data, paid services or AI-provider activation.

## Owner decision — 2026-10-14

The owner chose Option A: retain the existing submission/feedback review queue and defer the broader teacher teaching reader. No new teacher curriculum/assignment-reading authority, screen, roster, scheduling or attendance is authorized. Existing approved review permissions and material access within those reviews are unchanged.

Options B/C remain documented alternatives for later, not approved scope or discarded requirements. F018 and DW-010 retain the resume prerequisites: an explicit owner decision selecting the desired scope and confirming its permission/privacy boundary. No D-031 answer remains pending. Routine verified work within previously approved scope may continue; do not implement F018 because a prior recommendation favored B.
