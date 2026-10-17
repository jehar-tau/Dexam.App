# F033 — Role-separated portals

Status: merged through PR #81 (`c7a56dc`), 2026-10-17, after all required CI and independent security review passed. Owner-approved D-048 B. Risk: Yellow presentation/routing, with security review for access compatibility.

## Scope and identity

Four distinct entrances and shell variants: student `/sign-in` → `/student`; teacher `/teacher/sign-in` → `/teacher`; staff `/staff/sign-in` → `/staff`; admin `/admin/sign-in` → `/admin`. One existing canonical identity/backend/browser session; no duplicate accounts, domains or databases. Switching an authorized portal changes presentation, not user identity. Changing people requires sign-out. Existing account-keyed cache retirement and current backend authority stay intact.

Student uses Member ID; all three employee forms reuse established verified email/password authentication. Employee portal selection is not a role grant. Teacher workspace access uses existing scoped feedback authority. Staff remains the existing active-employee operational entrance with individually filtered capabilities, not a new generic role. Admin-specific entrances require current global Elevated Admin role; sensitive operations additionally retain existing capability/MFA checks. Own security setup remains accessible through the existing staff route before MFA; aliases never remove its checks.

## Layout/navigation

Student learning header/navigation, teacher review rail, staff operations sidebar, admin protected workspace sidebar/header use existing tokens/primitives and a documented PortalFrame pattern derived from pinned SidebarLayout/SidebarItem sources. Public directory offers four sign-in choices. Current portal shows only relevant allowed destinations; cross-portal links are explicitly labelled switches for the same account. No sensitive data or broader roster/teacher reader introduced. Signed-out navigation contains public entrances only. Fail closed on unavailable/current access lookup; refresh checks every 30 foreground seconds and retire results across accounts.

## Links and compatibility

Keep every existing `/staff/...`, activation/recovery and notification link working with its existing authorization/preview flags. Legacy review route gets teacher presentation; legacy admin-only tools get admin presentation while retaining their original guard. New teacher review/notification/security and admin employee/recovery/incident/security aliases reuse the same page/services. Legacy employee deep links may retain their existing employee sign-in redirect. New aliases return to their own login/security entrance. Validate local return targets by exact origin and allowed route namespace, rejecting external/protocol-relative/backslash/control/encoded normalization escapes and login/security loops. Do not carry credential fragments through redirects.

Home pages show safe links to authorized work, not new data dashboards. Staff no longer defaults every employee to enrolments. Teacher-only users do not acquire staff operational tools by using the staff entrance. Dual memberships/roles keep permitted portal switches, not mixed student/admin menus. Admin role recognition can occur before MFA; private admin tools still require their existing MFA/current capability. No remembered portal preference in localStorage.

## Acceptance

- Four public entrances and distinct mobile/desktop shells; keyboard/focus/skip navigation and Storybook variants.
- Sign-in defaults/return filtering, old links and recovery/MFA continuations preserved.
- Student-only, teacher-only, staff-only, admin and dual-role menus; no guessed-route authority.
- Denial/pending/error/revocation/account-switch checks; preview remains explicitly fictional and forbidden on admin/recovery aliases.
- Existing app/DB/browser regressions and independent review; actual local role/MFA acceptance when applicable.
- Update all usage guides, D-048 and current/deferred records. No production/real-data/provider/spend activation.

## Local implementation evidence

Four entrances, audience-specific layouts/menus, safe portal home landings, same-account switches, teacher/admin aliases, and old bookmarks are implemented. Admin eligibility uses the existing current-global-role RPC; all original operation-level guards remain. No database migration/grant required. The legacy WorkspaceNavigation component remains for prior reference/tests; AppShell now uses PortalNavigation, covered by its own account/error/revocation tests.

Verification: 439 app tests, 1,140 DB assertions and all 75 Chromium journeys; focused 8-journey rerun after visual refinement; normal build/bundle budget, lint/types/formatting and Storybook. Independent review found no remaining security blockers. MFA verify/removal invalidate the new portal-access cache immediately. Exact return tests distinguish protected `/admin/recovery` from public `/staff/recover`.

Actual local F031 SDK/MFA/browser rehearsal opened the new admin home, followed `/admin/incidents`, then used the legacy incident route; independent review/revocation/fences passed with exact cleanup. Its exact disposable actor then received existing offering-scoped teacher authority: real teacher home/review APIs and dual-role switch worked; revoking only its synthetic admin role denied admin while preserving teacher access. This does not prove typing through a real teacher email-login form or production onboarding. Actual student same-browser sign-out/replacement/delayed-read/revocation acceptance passed with exact cleanup. Its owned server now uses 5189, preserving the owner's 5173 preview; browser-close failure cannot skip remaining cleanup. Desktop teacher/student fictional screenshots are under ignored `test-results/f033`; teacher preview inspected in the app. Required CI/merge tracked in the PR.
