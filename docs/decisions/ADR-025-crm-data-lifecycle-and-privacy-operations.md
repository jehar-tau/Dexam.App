# ADR-025 — CRM Data Lifecycle, Correction, Erasure, and Privacy Operations

Status: Option B approved 2026-10-11
Date: 2026-10-11
Decision ID: D-025
Risk: Red — personal-data retention, data-subject rights, irreversible erasure, and backup behavior

## Question

How should Dexam retain, correct, minimize, and erase prospective-student and guardian CRM data before any production personal data is accepted?

## Current legal and product context

India's Digital Personal Data Protection Act, 2023 provides rights to correction and erasure, subject to data still needed for the specified purpose or compliance with law. The notified Digital Personal Data Protection Rules, 2025 phase relevant obligations into force and require reasonable safeguards, access visibility, and minimum one-year retention of certain processing data and logs for specified purposes once the relevant provisions commence. The final Rules also require a published rights-request route and grievance period.

The exact legal effect depends on Dexam's entity, processing purposes, users, other applicable education/tax/consumer laws, and the phased commencement dates. The product should therefore support purpose-based retention, exceptions, and evidence rather than encode “compliance” as one universal number. Final launch policy and notices require professional review.

Official sources reviewed:

- [Digital Personal Data Protection Act, 2023 — India Code](https://www.indiacode.nic.in/indiacode/handle/123456789/22037?view_type=browse)
- [Digital Personal Data Protection Rules, 2025 — MeitY Gazette notification](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [DPDP Act commencement notification, 13 November 2025 — MeitY Gazette](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)

## Options

### Option A — Keep CRM records indefinitely and handle requests manually

Leave closed/converted enquiries in the current archive forever. An administrator edits or deletes rows manually when someone complains.

- **Impact:** Almost no engineering work now.
- **Cost:** ₹0 service cost, but high manual support and incident cost.
- **Risk:** No consistent purpose limit, no dependable correction/erasure route, easy accidental over-retention, unsafe database intervention, weak evidence, and no backup-restoration protection.
- **Reversibility:** Low after years of uncontrolled personal-data accumulation.

### Option B — Tiered retention with governed correction and two-person erasure (recommended)

Adopt a free, first-party lifecycle workflow:

1. **Active enquiries:** retain while the enquiry is active or an enrolment review is pending.
2. **Closed, unconverted enquiries:** keep in the existing Recently dead view for seven days, then restrict to the Dead archive. Minimize CRM personal data 12 months after the latest of closure, the person's meaningful interaction, or completion of a privacy request, unless a documented hold or law requires longer.
3. **Converted enquiries:** restrict CRM access after conversion and minimize CRM-only contact values, interests, intake text, and free-text notes 12 months after conversion or the last CRM interaction. Do not delete the canonical student or academic domains.
4. **Security and processing evidence:** retain the minimum logs/evidence required for at least one year from the relevant processing event once applicable, then erase unless a documented law or active investigation requires longer.
5. **Correction:** a separately granted Privacy Operator applies field-scoped changes with a reason. Audit records contain field identifiers and keyed fingerprints, not readable old values.
6. **Erasure:** the Privacy Operator proposes a scoped erasure after verification and dry run; a different current Elevated Admin must approve it. The service rechecks authority and scope before transactional execution.
7. **Holds:** a hold must have a reason, owner, and review date no later than 90 days; it must be renewed deliberately or expire.
8. **Backups:** provider backups expire under the approved backup policy. A non-content tombstone is replayed after any restoration so previously erased data cannot silently reappear.

The 12-month operational period is a conservative product default, not a claim that every record legally must or may be held for exactly 12 months. The engine supports earlier erasure when allowed and longer retention only through a documented exception.

- **Impact:** Provides a usable privacy queue, predictable lifecycle, auditability, safe correction, and controlled erasure without purchasing a vendor.
- **Cost:** ₹0 external-service cost; moderate schema, UI, testing, operational, and later scheduling work.
- **Risk:** Requires disciplined request verification and policy ownership. Two-person approval adds staffing friction but protects irreversible actions.
- **Reversibility:** High. Durations and policy versions are data-driven; the provider-neutral workflow can later integrate a self-service portal or privacy vendor.

### Option C — Buy a privacy-management platform now

Use a vendor for request intake, identity verification, data discovery, retention, and deletion orchestration.

- **Impact:** Potentially broad workflow and reporting sooner.
- **Cost:** Recurring vendor spend, integration work, training, and additional processing agreements.
- **Risk:** Premature vendor lock-in, more copies of sensitive data, complex connector security, and a workflow larger than Dexam's current scale.
- **Reversibility:** Moderate to low after cases, policies, and staff processes depend on the provider.

## Recommendation

Approve Option B. It is the cheapest robust path, scales operationally through explicit cases and automated lifecycle jobs, avoids indefinite CRM storage, and preserves human review for corrections and irreversible erasure. It also keeps Dexam's production launch blocked until the remaining notice, request-route, staging, backup, and legal-review work is complete.

## What approval would authorize

Option B authorizes the F013 database and staff-interface foundation: `privacy.manage`, lifecycle calculation, restricted records, request cases, correction operations, dry-run impact previews, time-limited holds, distinct erasure proposal/approval, idempotent execution, notification invalidation, and non-content backup-restoration tombstones.

It does not authorize production personal data, deployment, a public request portal, identity-document storage, automatic acceptance of requests, deletion of canonical student/academic/payment data, paid vendors, or a claim of legal compliance.

## Consequences

- DW-042 becomes the active F013 implementation slice after approval.
- F013 supplies the first concrete two-person high-impact workflow under D-008; broader elevated administration remains DW-005.
- Production scheduling and monitoring remain DW-025/DW-026.
- Website intake remains DW-043 and cannot launch until notices, lawful basis/consent, abuse controls, and the rights route are ready.

## Reversibility and migration

Retention periods and policy versions will be stored as explicit configuration/data rather than scattered constants. Existing fictional CRM fixtures will receive computed due dates. No existing record is destructively changed by the migration; minimization begins only through approved service operations after D-025 approval. A later reviewed policy may change future due dates while preserving the policy version used for prior actions.

## Approval

The product owner delegated approval authority for this unattended implementation run on 2026-10-11 and authorized the recommended Option B. Dexam may build the free-first, tiered CRM lifecycle and governed privacy-operations foundation described above, including separate privacy authority, field-scoped correction, dry-run erasure impact, distinct proposer/approver enforcement, time-limited holds, idempotent minimization/erasure, and backup-restoration tombstones.

This approval does not authorize production personal data, deployment, paid services, identity-document storage, automatic acceptance of privacy requests, deletion of canonical student/academic/payment data, or a claim of legal compliance.
