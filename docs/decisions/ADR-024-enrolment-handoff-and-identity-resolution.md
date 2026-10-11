# ADR-024 — Enrolment Handoff and Identity Resolution

Status: Decision required — Option B recommended
Date: 2026-10-11
Decision ID: D-024
Risk: Red — canonical student identity, duplicate resolution, enrolment approval, and account access

## Decision Gate

### Decision

How should an Enrolment Operator turn an explicit CRM enrolment-review request into a canonical student and approved enrolment without creating duplicate people or giving Sales academic-access authority?

### Option A — One-click automatic conversion

The system treats the CRM subject as a new student, generates a Member ID, creates student membership, chooses a default offering/cohort, and approves the enrolment as soon as Sales requests review.

- **Impact:** Fastest handoff with almost no operator work.
- **Cost:** Lowest first implementation cost and ₹0 provider cost.
- **Risk:** Weak contact evidence can create duplicate students; guardian details can be mistaken for student identity; inferred offering/cohort choices can grant the wrong learning access; Sales effectively causes academic access despite D-008.
- **Reversibility:** Low after identities, credentials, coursework, and submissions attach to the wrong person or enrolment.

### Option B — Guided operator resolution and atomic approval (recommended)

Create a dedicated, capability-gated handoff inbox containing only explicit pending CRM review requests. For one request at a time, an Enrolment Operator:

1. reviews the minimum prospect, guardian/contact, interest, request-note, and possible-match evidence;
2. either confirms the CRM subject as a new student or deliberately links the request to an existing canonical student found through bounded Member ID/display-name search;
3. resolves each presented weak contact match as **same person** or **different people** without silently merging on phone/email alone;
4. chooses an active offering and optional compatible active cohort;
5. confirms approval with a bounded reason, or returns the request to Sales with a bounded reason when evidence is incomplete.

The trusted transaction rechecks current `enrollment.operate` authority, request state, identity choice, offering/cohort validity, and duplicate open enrolments. A new student receives a generated immutable Member ID and active student membership, then an approved enrolment enters the existing activation queue. An existing claimed student receives an active enrolment without a second activation pack. Every resolution, return, and approval is attributable and immutable.

- **Impact:** Completes the real Sales-to-enrolment bridge while keeping identity and academic access under the approved Enrolment Operator boundary.
- **Cost:** Moderate database, interface, and test work; ₹0 external-service cost.
- **Risk:** The operator can make a wrong manual identity decision, contained by minimum evidence, explicit confirmation, current-state authorization, single-record actions, immutable history, and no destructive person deletion.
- **Reversibility:** High before activation and moderate afterward. The request can be returned; identity linkage remains auditable; later correction uses a separately approved exceptional workflow rather than silent rewrites.

### Option C — Two-person approval for every conversion

One Enrolment Operator proposes the identity/enrolment resolution and another authorized employee must approve it before any Member ID, membership, or enrolment is created.

- **Impact:** Adds stronger separation for every case.
- **Cost:** Highest workflow and staffing burden; still ₹0 provider cost but difficult for a small team to operate.
- **Risk:** Routine enrolments can stall and staff may work around the system. D-008 already reserves two-person approval for exceptional security actions, not routine enrolment creation.
- **Reversibility:** High, but at substantial operational cost.

## Recommendation

Approve Option B. It implements the authority already approved in D-008, preserves the existing activation-pack review, and prevents phone/email matches from becoming automatic merges. It is free-first, auditable, and narrow enough for the current operational volume.

## What approval would authorize

Option B would authorize the F012 first slice:

- a pending/returned/resolved enrolment-review request lifecycle with immutable history;
- a minimum-data Enrolment Operator handoff inbox;
- bounded existing-student lookup by Member ID/display name;
- explicit new-versus-existing student choice and weak-match disposition;
- active offering and compatible cohort selection;
- atomic student membership and enrolment approval;
- reuse of the current activation queue for new unclaimed students;
- direct activation for an already-claimed active student;
- return-to-Sales with a reason and later resubmission;
- database, unit, component, responsive-browser, and authorization tests.

It would not authorize fuzzy/AI matching, automatic merge, broad people search, destructive duplicate deletion, Sales enrolment approval, activation credential delivery by Sales, payment checks, external messages, bulk conversion, production personal data, or production deployment.

## What can continue while pending

The merged CRM and enrolment foundations remain safe: Sales can submit explicit review requests, but no browser workflow can create student membership or enrolment from them. Specification and fictional preview planning may continue; identity/enrolment mutation must wait for approval.

## Approval

Pending product-owner selection.
