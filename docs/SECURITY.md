# Security and Privacy Baseline

- Deny access by default and grant least privilege by role and ownership.
- Enable and test Row Level Security for every exposed table.
- Never trust role, price, entitlement, score, ownership, or file metadata supplied by a browser.
- Keep service credentials server-only; variables prefixed `VITE_` are public.
- Store no real student data in source control, fixtures, logs, screenshots, or staging.
- Validate file type, size, ownership, and access; use private storage and time-limited access for student work.
- Verify webhook signatures and make handlers idempotent.
- Log security-relevant administrative actions without logging sensitive contents.
- Review authentication, RLS, payments, personal data, admin access, and student APIs at Red risk level.
- Rotate a secret immediately if it is exposed; removing it from the latest commit is insufficient.
- Give every student and employee one canonical, immutable internal identity; authentication accounts link to it rather than replacing it.
- Keep employee accounts individual, invite-only, least-privileged, and represented in a cross-system access inventory.
- Enforce active/suspended status from current database state on protected operations rather than relying only on potentially stale JWT claims.
- Offboarding revokes sessions and application roles, removes every external-system grant, and rotates exposed or shared credentials.

See `decisions/ADR-004-identity-deduplication-and-revocation.md` for the approved identity and revocation requirements.

Security behavior must have automated tests. Production access and destructive operations require explicit authorization and a recovery plan.
