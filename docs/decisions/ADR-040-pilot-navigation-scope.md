# D-040 — Pilot navigation scope

Status: Option B approved by owner, 2026-10-15 — existing-authority-aware navigation only

## Evidence and question

The composed fictional student journey works, but `AppShell` still renders the shared staff-heavy navigation for students. This is a usability problem, not proof of access to staff data: route, database and function authorization remain enforced. Changing which workspace controls a person sees is an owner-visible experience decision under D-039's scope boundary.

## Options

### A — Keep the current shared menu

Defer navigation changes and proceed to owner walkthrough with the current links. Smallest scope, no added vendor spending, but students continue to see inaccessible staff destinations. Reversible later; this does not expand permission.

### B — Show existing authorized destinations only (recommended)

Use current student/employee membership and existing current-state capability checks to show the destinations each account can already use. Students get their own learning/work/agenda/archive/notifications links; staff get only existing relevant workspaces. Accounts with both memberships retain both existing sets; no new role or mode-based authority. Missing/unverifiable scope must not reveal private labels or cached account state. Staff must still be able to reach their existing security/MFA setup/challenge route. Direct URLs keep their existing route and server checks; hiding a link is not authorization.

Reuse current design-system navigation styles and approved components rather than introducing a new sidebar/layout. No Teacher reader, default grants, roster access, student records, business workflow, actual curriculum migration, production or external delivery added. No additional vendor spending for fictional testing; reversible presentation change with account-switch, revocation, responsive and independent security review.

### C — Design the broader information architecture first

Defer code while defining a new sidebar, grouping and mobile navigation in the owner's design system. More design work and later approval of reusable patterns; no vendor spending for discovery. Existing permissions remain unchanged and no new design tool/provider is authorized.

## Recommendation

B removes irrelevant controls from the working pilot without redesigning the entire application or changing authority. Broader visual redesign can follow the owner's walkthrough. A real launch remains blocked by `PRODUCTION_READINESS.md` regardless of this choice.
