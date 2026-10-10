# ADR-023 — CRM Assignment Authority and Queue

Status: Option B approved 2026-10-11
Date: 2026-10-11
Decision ID: D-023
Risk: Red — prospect personal data, cross-owner visibility, staff privilege, and operational continuity

## Question

Who should be allowed to see unassigned or stranded enquiries and assign or reassign them to Sales staff, and how much automation should the first assignment interface provide?

## Why this needs a decision

D-022 approved a separate `lead.assign` capability and the F010 database foundation already preserves ownership history and rechecks the target owner's current Sales authority. The staff interface intentionally stopped at each salesperson's own queue. Exposing an unassigned queue changes who may browse prospect contact data, while giving only Elevated Admins the routine task would spend high privilege on daily Sales operations.

The first interface also needs a deliberate rule for enquiries whose owner is suspended, revoked, or no longer in Sales. Those enquiries must not remain visible to that former owner, but they must remain recoverable by a separately authorized operator.

## Options

### Option A — Elevated Admin assigns every enquiry

Only an active Elevated Admin can open the unassigned and stranded queues or assign/reassign an enquiry. Assignment remains one enquiry at a time with a required reason.

- **Impact:** Smallest privilege model and least new administration.
- **Cost:** ₹0 external cost and the smallest interface, but routine work depends on a highly privileged person.
- **Risk:** Creates an operational bottleneck and encourages Elevated Admin sessions to be used for ordinary Sales work.
- **Reversibility:** High; a scoped coordinator can be introduced later.

### Option B — Explicitly granted CRM Coordinator responsibility (recommended)

Keep `sales` as the person's ordinary role and grant `lead.assign` separately to selected active Sales staff. “CRM Coordinator” is a responsibility label, not a new broad role. The grant is immediately ineffective if the employee, Sales role, or capability grant is suspended, expired, or revoked. Elevated Admin retains exceptional access through the same capability check.

The first interface provides:

1. Separate **Unassigned** and **Needs reassignment** queues.
2. A minimal active-Sales owner picker that reveals no unrelated employee profile data.
3. One-enquiry assignment or reassignment with a required bounded reason and confirmation.
4. Existing ownership history, follow-up replacement, notification invalidation, and new-owner alert behavior from F010.
5. Conflict handling when another coordinator changes ownership first.

Bulk assignment, round-robin automation, workload scoring, geographic routing, imports, exports, and automatic reassignment remain out of scope.

- **Impact:** Lets a trusted Sales lead run daily allocation without granting enrolment, staff-security, or Elevated Admin powers.
- **Cost:** ₹0 external cost; moderate database query, interface, permission, and test work.
- **Risk:** A coordinator can view all unassigned/stranded prospect records and choose their owners. The risk is contained through an explicit revocable grant, minimum returned fields, single-record actions, required reasons, immutable history, and no export.
- **Reversibility:** High. The grant can be revoked immediately and later scopes or automation can be added without changing enquiry ownership records.

### Option C — Automated and bulk assignment now

Add bulk selection, round-robin or workload rules, reassignment batches, and automatic routing when enquiries arrive or owners become inactive.

- **Impact:** Fastest operation at larger volume.
- **Cost:** Highest implementation and monitoring burden; still no provider fee, but substantially more engineering and support work.
- **Risk:** A configuration mistake can expose or misroute many prospect records at once, while current volumes and staffing rules are not yet known.
- **Reversibility:** Moderate because automated decisions and staff expectations become embedded in operations.

## Recommendation

Approve Option B. It preserves least privilege without making routine allocation depend on a security administrator. Single-record actions are enough to validate the workflow and remain inexpensive, auditable, and easy to replace when real volume justifies automation.

## What approval would authorize

Option B would authorize the F011 CRM Assignment Operations slice: explicit `lead.assign` grants tied to a current Sales role, minimum active-owner discovery, unassigned and inactive-owner recovery queues, reason-required single assignment/reassignment, responsive UI states, and complete database/browser authorization tests.

It would not authorize bulk assignment, automatic routing, employee invitation or role-grant administration UI, external messages, exports, website intake, production prospect data, retention/deletion policy, or the Enrolment Operator handoff inbox tracked separately in DW-041.

## What can continue while pending

The repository can retain the D-022 assignment function and test fixtures. No new staff-visible queue or capability grant should be released until the product owner selects an option.

## Approval

The product owner approved Option B on 2026-10-11. Dexam may build the F011 single-record CRM assignment workspace with explicit `lead.assign` grants tied to a current Sales role, unassigned and inactive-owner recovery queues, minimum active-owner discovery, reason-required assignment/reassignment, and current-state authorization and concurrency checks.

This approval does not authorize bulk or automatic routing, staff-role administration UI, enrolment identity resolution, exports, external messages, website intake, paid services, production prospect data, or production deployment.
