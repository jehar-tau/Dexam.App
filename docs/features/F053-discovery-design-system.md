# F053 — DEXAM Discovery design system

Status: pre-push gates passed 2026-11-04, including Claude correctness/security review; publication in progress. Owner approval: D-064 and explicit GitHub/app publication request on 2026-11-04.

## 2026-11-04 publication acceptance

Fresh `pnpm verify` passed 644 tests, formatting/lint/types, the Discovery contract/contrast validator and production bundle budget. All 130 Chromium journeys passed, including the desktop/mobile visual matrix, axe, dark theme, focus return and exam start/answer/submit/review. Storybook built and `pnpm audit --prod` reported no known vulnerabilities. Reviewed representative generated screenshots for student desktop, staff-content mobile, admin entrance and dark mock-test view. No database reset or server integration test was needed: this diff changes no schema, grant, RLS, Edge Function, payment/scoring/timer rule or wire contract. Property/load tests are not applicable to the visual-only change; event-load acceptance remains a separate launch gate.

The authenticated Claude subscription CLI completed an independent medium-effort Opus correctness and precautionary security review of the complete staged diff (session `dc4baa78-0efb-4b23-9f15-5959de25ea13`): safe to push, no blockers. Review used no execution tools, hooks, Chrome or MCP. Generated tool-use text in its response was not executed; treat the result as diff-only static review, not independent source queries, runtime/contrast measurements or screenshot inspection. Actual test and visual evidence above was obtained separately by the implementing agent.

Non-blocking suggestions retained deliberately: the compact 8px brand subtitle has an accessible link name and approved visual specimen, but merits the later portal usability review; duplicate identical page-gutter/color-scheme declarations are harmless and left to avoid unrelated churn; role differentiation remains explicit in text rather than old coloured borders, per D-064; the EmptyState artwork default is intentional. No blocking defect was identified. Added-line secret-pattern checks and staged whitespace check pass; Gitleaks is unavailable and was not run. The only new dev dependency's official registry metadata confirms Deque's `axe-core-npm` repository and MPL-2.0 licence. Existing production Zod patch passes the audit.

This supersedes the historical Claude-limit blocker below. Only the app is authorized for publication; the separate website candidate remains local. GitHub CI and unresolved-review inspection remain merge gates. This is a design-system release to the existing app/staging/catalogue, not production authentication, payment or real-data activation.

## Outcome

The approved Design Instinct/academy website styling becomes the DexAM app's visual language end to end. Paper backgrounds, forest text and controls, orange accents, Figtree UI, Zilla Slab headings, quiet tactile cards, and original geometric SVG illustrations form one reusable system.

## Scope and acceptance

- Active light/dark tokens affect public, student, teacher, staff, administrator, assessment, review, loading, empty, error, and recovery screens.
- Both portal shells, wordmark, buttons, inputs, cards, badges, callouts, and empty states use the system.
- Learning home, public entrance, sign-in, and mock-test cards use reusable original illustrations; public entrance copy replaces development-only descriptions.
- Test windows retain question imagery, timer clarity, answer-state meanings, keypad behavior, and submission controls.
- Decorative content is hidden from assistive technology; navigation labels, focus, mobile menu behavior, semantic statuses, and forms remain accessible.
- The complete contract, machine-readable primitives, component specs, and Storybook specimens define future work. The old theme cannot be regenerated over the active theme by `pnpm design:tokens`.
- Check desktop and 390px mobile, light/dark, existing functional journeys, text contrast, and a keyboard pass. Use fictional previews only.

## Boundaries

No backend migration, permission change, new data collection, scoring change, email transmission, commercial change, or production deployment. Protected screens retain their existing guards; preview support is not widened.

## Evidence

- `pnpm verify`: synthetic-fixture guard, Discovery contract, 38 light/dark contrast pairs, formatting, lint, strict types, 644 tests in 102 files, production build, and browser chunk budget pass.
- `pnpm test:e2e`: all 130 Chromium journeys pass. The visual matrix covers 15 existing public/student/staff entrances and fixture screens at 1440px and 390px; axe WCAG checks, overflow assertions, saved screenshots, dark mode, and keyboard focus return. Axe also checks active exam controls and mobile results. The suite covers protected redirects, coursework, assignments, staff workflows, exam start/answer/submit/review, and mobile exam controls. Issues found and fixed: inline callout links distinguishable without color, keyboard-scrollable results, mobile-menu focus return, and full-opacity exam section counts.
- `pnpm build-storybook`: builds the catalog with Brand, five illustration variants, dark artwork, and full light/dark system specimens. Scoped theme aliases are rebound so dark specimens work inside a container as well as on `html`.
- `pnpm audit --prod`: no known vulnerabilities. The existing Zod 4.6.5 advisory was resolved with the compatible 4.6.6 patch ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). The only added package is development-only `@axe-core/playwright` from Deque's official package, MPL-2.0.
- Website companion checks: build, 31 direct routes/unique metadata, 1,039 internal links, approved brand/type contract, and all eight assessment tests pass. The same 1.0 contract and future-contributor guidance are present in the academy repository.
- Local previews: app port 5182 and catalog port 5183; existing services on 5173/5180 preserved. Browser screenshots contain fictional fixtures only. Screenshots from the matrix are in ignored `test-results/` output; owner-facing preview captures are saved in the task's `review/` folder.

## Threat review

Green visual change with an independent Claude code review and a precautionary security review required before push. Authentication pages are styled; their session, redirect, credential, capability, and MFA logic is unchanged. No new endpoint, database/schema/policy, payment action, upload behavior, private data exposure, analytics, AI authority, HTML injection, or question-bank access is introduced. SVG is static JSX and contains no external URLs or executable content. Existing Google font hosts are reused. Public Storybook examples contain no sessions, keys, real students, or real exam content. Existing authorization and question-serving boundaries continue to govern the app. No production operation is performed.

Staged added-line secret pattern scan and `git diff --cached --check` pass (0 findings). Gitleaks is not installed; this is not represented as a Gitleaks scan.

The original expired OAuth session was resolved by the owner on 2026-11-01. On 2026-11-02, the installed CLI at `/Users/snehalkumarshinde/.local/bin/claude` confirmed an authenticated Claude Pro subscription session. The full staged-diff review was retried with Opus, then Sonnet, using medium effort, read-only tools, hooks/Chrome/MCP disabled and API-provider environment variables removed. Both attempts returned an account usage limit resetting at **2026-11-02 23:10 IST**. Both are errors, with zero reported cost; neither review ran or passed. The owner’s explicit choice to wait for Claude remains in force, with no substitute reviewer or paid extra usage authorized. The follow-up `finish-dexam-review` is rescheduled for **23:15 IST**. Raw error evidence is in the task’s `review/discovery-claude-review-20261102.json` and `review/discovery-claude-review-sonnet-20261102.json` files, outside this repository.

The automated gates were rerun on the current source: `pnpm verify` passes with 644 tests in 102 files; all 130 browser journeys pass; Storybook builds; `pnpm audit --prod` reports no known vulnerabilities. The first browser run exposed a theme-transition measurement race: axe read interpolated navigation colours before the dark palette settled. The check now awaits finite CSS transitions, then audits the real palette; no product theme colours or behaviours were changed to suppress the finding. The existing dark-theme check remains the regression.

Under `../QUALITY_GATE.md`, the changes remain staged locally on `feature/discovery-design-system`; no commit, push, PR, merge or production deployment has occurred. A fresh staged added-line secret-pattern scan and whitespace check pass. At the follow-up, inspect current work, rerun any evidence affected by changes, complete the full Claude correctness/security review, fix blockers and then follow the gated app publication workflow. The owner separately requested that the website typography/copy candidate stay local, so this follow-up must not publish or open a PR for the website. Do not sleep or shut down the computer.
