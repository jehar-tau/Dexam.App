# F026 — Existing-authority-aware navigation

Status: Accepted through PR #60 (`110f907`) and protected fictional release `38691212531` under owner-approved D-040 Option B
Risk: Red — current identity and scoped capability presentation

Replace the shared staff-heavy menu with links to existing authorized workspaces. Students see their own learning/work/agenda/archive/notifications; current employees see only existing relevant staff destinations. Dual memberships retain both sets. Keep staff security/MFA setup reachable for current employees even before privileged assurance. Anonymous visitors retain existing public activation/sign-in/status entry points.

Use existing navigation styles/components, not a new sidebar or authority mode. No default grants, new permissions, wider Teacher workspace, rosters, reporting, actual curriculum migration, external delivery, production or spending. Link visibility is never authorization: existing route/SQL/Edge gates remain decisive.

Return only current-account boolean navigation flags, never people/course/grant identifiers, records or counts. Reuse current role/capability/offering checks, including explicit scheduling/impact grants; fail closed while unavailable and do not carry another account's cache. Recheck foreground navigation every 30 seconds and invalidate after MFA verification. Public production builds retain no fictional preview bypass; development demo links must remain explicitly marked and target only existing preview-enabled pages.

Privileged invitation/student recovery/staff recovery links use their exact fresh-MFA/Elevated Admin workspace helpers, not generic capability booleans. Factor verification and removal invalidate the navigation query; the staff security entry itself remains reachable without elevated assurance. An independent security review identified and cleared this alignment before acceptance.

Correct the existing scoped assignment-distribution/reviewer **entrance** mismatch using the same offering-scoped authorities their backend operations already enforce, without widening record access. Other global-only workflows remain global-only.

Verification: student/Sales/scoped teacher/operator/elevated/mixed/suspended/revoked/expired/global-only negative cases, MFA security entry, minimal DTO, failed-refresh hiding, account isolation, preview/live destinations, direct-route denial, desktop/mobile visual checks and independent security review. Authoritative decisions remain D-031 A/D-036 A/D-038 B/D-040 B.

2026-10-15 evidence: the full `pnpm pilot:verify` passed: 295 app tests, 1075 database assertions, 63 Chromium smoke journeys and all nine actual scripts including scheduled delivery and exact fixture cleanup. The composed actual admissions/academic browser acceptance also checks student-only links, Sales denial of distribution, scoped operator distribution entry, scoped teacher review entry, and live review grant revocation hiding the link and denying the page while retaining staff security. Desktop/mobile student screenshots were inspected. Hosted synthetic verification checks the minimal navigation DTO, inactive/still-unassured denials and no default impact grant. Independent read-only security review found no remaining blockers after the exact privileged-helper correction. Required PR/main CI and protected fictional release `38691212531` passed, including hosted authorization, advisor, MFA recovery and native-tick checks. The hosted frontend serves the new bundle. Designer review remains separate under F027/D-041 A.
