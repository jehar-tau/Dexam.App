# Production readiness — release blockers

Status: Not ready for production. This checklist records required work, not permission to configure a provider, spend money, send real messages, or deploy production.

The owner confirmed on 2026-10-13 that D-029 Option B means local email testing now and real authentication email delivery before launch. Keep evidence beside each completed item; never infer production readiness from fictional staging acceptance.

## Authentication email — required before real employee onboarding

- [ ] Approve a delivery provider, volume estimate, monthly cost ceiling, sending domain/address, and operational owner.
- [ ] Configure approved sender verification and domain authentication, with credentials stored server-side only.
- [ ] Configure exact production activation/recovery callback URLs; reject unsafe redirects and remove test-only delivery paths from the production configuration.
- [ ] Verify actual invitation and password-recovery delivery to explicitly authorized test recipients, including expiry, replay, cancellation/reissue, mobile behavior, and credential-safe logging.
- [ ] Verify old-session invalidation, suspension denial, unchanged verified-email policy, and preservation of MFA after password recovery.
- [ ] Define retry/rate limits, bounce/failure handling, monitoring, and an accountable support/escalation process.
- [ ] Complete a launch review: a local captured email is not proof of real deliverability. Keep authentication delivery separate from marketing notifications.

## Other existing release gates

- [ ] Complete remaining student/employee recovery and identity workflows under their approved feature decisions.
- [ ] Establish production security/incident ownership, attributable privileged accounts, emergency procedures, and cross-system offboarding.
- [ ] Validate production backup/restore and privacy tombstone behavior; fictional rebuilds are not production backups.
- [ ] Approve notices, privacy/request handling, retention, and professional privacy/security review for actual processing.
- [ ] Validate public intake abuse controls, storage/egress budgets, production configuration, and explicitly approved deployment/domain setup.

Canonical scope and prerequisites remain in `DEFERRED_WORK.md`, F001/F016, D-029, and the relevant feature decisions. Maintain this checklist when testing-only choices create launch work. None of these boxes is currently marked complete merely because staging passed.
