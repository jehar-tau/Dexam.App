# D-048 — Role-separated portal experience

Status: Option B approved by the owner 2026-10-17; F033 implementation/verification active. Requested alongside role-based usage documentation. This records an experience/architecture choice, not permission to expand roles or activate production. F033 specifies entrances, compatibility, same-identity switching and conservative existing-authority eligibility. It supersedes D-040's mixed dual-membership menu presentation, not its authorization rules.

## Before-implementation audit

`src/app/router.tsx` places every route under `AppShell`. Students use `/sign-in` and Member ID/password; teachers, staff and admins use `/staff/sign-in` and employee email/password. Authorized navigation and live backend checks separate permitted work, but distinct teacher/admin login pages and four separate visual shells do not exist. A dual-membership account can currently see both permitted sets. Employee sign-in defaults to enrolments unless a valid staff return path is supplied, which is not an appropriate universal landing for every employee.

## Options

- **A — Retain current arrangement:** shared shell/employee entrance with authorized menus. Smallest scope; does not satisfy the requested fully distinct experiences. ₹0 additional vendor spending for local work.
- **B — Recommended: four distinct entrances and shells on the existing secure backend:** student, teacher, staff and admin sign-in/workspace experiences, reusing the strict design system and canonical identity. Keep current server/database authorization, MFA, capability/offering scope and revocation decisive. A portal choice or admin URL never grants a role. Resolve role-appropriate landing, dual-role switching, safe returns and account/session behaviour explicitly in the feature specification before coding. ₹0 additional vendor spending for local development; production remains gated. No duplicate accounts or databases merely to separate presentation. Reversible through routing/shell changes, with existing bookmarks/deep links requiring a migration/compatibility plan.
- **C — Plan independently deployed applications first:** discovery of separate origins/domains, session boundaries, deployment/maintenance, shared design components and cross-app links. Larger development and operations scope; hosting/provider costs and production activation require separate review. No separate deployments are created by this planning choice.

Recommendation: B matches the requested user-facing separation without duplicating identities or inventing new authority. This is not a proposal for four unrelated design systems; use the existing approved tokens/primitives while distinguishing each audience's experience.

## Acceptance to specify after choice

Four intended entrances and layouts; role-appropriate permitted landing; wrong-role/guessed-route denial; unchanged MFA/revocation/current-state checks; dual-membership/switch/sign-out behaviour; preserved safe bookmarks/notifications/activation/recovery links; no cross-user draft/cache leakage; mobile/accessibility and design-system verification. Exact routing/design and what qualifies an employee for each portal need a bounded specification, not a client-side role selector treated as security.

The role-based handbook is updated alongside F033 to describe the implemented routes/layouts and retained legacy links. Local implementation is not production acceptance; verification evidence belongs in F033/current state and the PR.
