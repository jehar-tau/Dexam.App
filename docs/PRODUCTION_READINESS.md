# Production readiness — release blockers

Status: Not ready for production. This checklist records required work, not permission to configure a provider, spend money, send real messages, or deploy production.

D-042 Option A approved launch-readiness planning on 2026-10-15. `LAUNCH_PLAN.md` sequences these gates with owners, dependencies, acceptance evidence and verified budget scenarios. It does not check off any item or approve implementation/activation. Database backups exclude Storage object bytes; recover both, and review organisation-level billing and spend-cap exclusions before approving a budget.

F025/D-039 B is fictional pilot hardening, not launch acceptance. Assignment-material orphan/uncertain-attachment handling needs an approved operational owner and evidence-based controlled cleanup (DW-046). Fixed initiating-JWT compensation must never borrow a replacement account; lost metadata confirmation must never auto-delete a possibly referenced file.

F023 lesson files additionally require verified Storage cleanup scheduling/ownership, storage/egress capacity review, metadata/audit retention review, and operational handling of uncertain uploads before real data. Local object deletion and the service-only worker do not prove production scheduling. Do not add a credential-bearing Cron command or treat SQL maintenance as Storage deletion.

F030/D-044 B is verified for fictional/local uploads and cleanup through PR #70 (`c3e3bd8`): referenced, held and unknown legacy objects stay protected. Hosted cleanup, marker retention and operational activation remain unapproved. `MAINTENANCE_OPERATIONS_PLAN.md` inventories existing jobs and failure drills. F031/D-045 B implements independent local incident review for uncertain recovery; no reset-unlock operation is approved or implemented.

F022 supplies only fictional native in-app delivery. Production still requires capacity review, operational ownership, failure alert/escalation policy and separately scheduled Storage file/audio cleanup. Private worker success becomes unhealthy after three minutes without a success; Free-project pausing can stop delivery. No production job is activated by migrations.

The owner confirmed on 2026-10-13 that D-029 Option B means local email testing now and real authentication email delivery before launch. Keep evidence beside each completed item; never infer production readiness from fictional staging acceptance.

## Authentication email — required before real employee onboarding

- [ ] Approve a delivery provider, volume estimate, monthly cost ceiling, sending domain/address, and operational owner.
- [ ] Configure approved sender verification and domain authentication, with credentials stored server-side only.
- [ ] Configure exact production activation/recovery callback URLs; reject unsafe redirects and remove test-only delivery paths from the production configuration.
- [ ] Verify actual invitation and password-recovery delivery to explicitly authorized test recipients, including expiry, replay, cancellation/reissue, mobile behavior, and credential-safe logging.
- [ ] Verify old-session invalidation, suspension denial, unchanged verified-email policy, and preservation of MFA after password recovery.
- [ ] Define retry/rate limits, bounce/failure handling, monitoring, and an accountable support/escalation process.
- [ ] Establish evidence-based reconciliation for uncertain password mutations. Never unlock an `executing` reset merely because its link expired; first prove the external update stopped and verify current provider state under a separately recorded operational approval.
- [ ] Define recovery-ledger/audit retention and production abuse budgets. Local testing's shared 100-request/hour budget is not a production traffic policy.
- [ ] Complete a launch review: a local captured email is not proof of real deliverability. Keep authentication delivery separate from marketing notifications.

## Other existing release gates

- [ ] Verify and operationally own scheduled class-history cleanup and notification delivery. Session/history retention expires 12 months after the latest scheduled end or cancellation; deletion occurs on the next successful maintenance run. Fictional scheduling grants must not become real staff grants without explicit provisioning and review.

- [ ] Configure and verify scheduled submission/checklist retention cleanup, failures/alerts and accountable ownership before actual student data. Checklist reads expire at 12 months after course end; timely physical deletion requires a successful maintenance run. Fictional local purge tests are not proof of production scheduling.

- [ ] Confirm initial student activation uses exact approved production callbacks, fragment credentials, private handover and credential-safe host/referrer/logging behavior. Previously issued query links cannot have their original exposure undone; allow them to expire or deliberately reissue before real onboarding.

- [ ] Approve and verify hosted student assisted recovery activation, exact production callback/handover procedure, two-admin operational availability, production proof/abuse budgets and minimized ledger/audit retention. F017 is fictional-local only; no mandatory student contact or real delivery is implied.
- [ ] Apply DW-045 uncertainty reconciliation to student as well as employee password mutation, including proof that the external update stopped, independent operational approval, and tested current-provider/session checks. Link expiry never unlocks execution.

- [ ] Complete remaining student/employee recovery and identity workflows under their approved feature decisions.
- [ ] Establish production security/incident ownership, attributable privileged accounts, emergency procedures, and cross-system offboarding.
- [ ] Validate production backup/restore and privacy tombstone behavior; fictional rebuilds are not production backups.
- [ ] Approve notices, privacy/request handling, retention, and professional privacy/security review for actual processing.
- [ ] Validate public intake abuse controls, storage/egress budgets, production configuration, and explicitly approved deployment/domain setup.

Canonical scope and prerequisites remain in `DEFERRED_WORK.md`, F001/F016, D-029, and the relevant feature decisions. Maintain this checklist when testing-only choices create launch work. None of these boxes is currently marked complete merely because staging passed.
