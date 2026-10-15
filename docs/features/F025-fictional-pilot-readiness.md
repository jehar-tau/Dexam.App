# F025 — Fictional pilot readiness

Status: Active under D-039 Option B
Risk: Red for shared-browser account isolation; no new authority or product rules

## Scope

Audit and exercise existing approved workflows with disposable fictional local fixtures. Fix implementation defects, retain the strict shared design system, and produce an evidence-backed pilot/launch gap checklist. No new modules, actual curriculum migration, default grants, real data, production, paid services or external message delivery. Existing deferrals (including D-031 A, D-036 A and DW-011) remain in force.

## First defect: shared-browser account isolation

AppProviders retained one QueryClient across all authentication identities; older page queries without a user-specific key could reuse cached private data after another account signed in. Partition the query-provider subtree by current authentication user, clearing the retired cache and remounting private form state on sign-out/account change. Same-account token refresh must not destroy drafts; it is not a new identity. Pending old requests must never populate the new account's cache. Existing server authorization remains authoritative.

Recheck staff/student access while a foreground protected page stays open; a denied/error result must unmount private content. This improves visible revocation handling, not an instantaneous remote-screen-erasure guarantee; backend current-state checks remain required on every protected operation.

## Verification

Regression tests: identity switch with identical legacy query keys; sign-out; in-flight old response; private local form state; same-account token refresh; foreground boundary membership/capability revocation and failed refresh. Real SDK/Chromium account-switch acceptance uses only disposable accounts and deletes exact fixtures. Full format/lint/types/app/DB/browser suites and independent security review before merge.

Pilot evidence and gaps are maintained in `../PILOT_READINESS.md`; local mocked previews are distinguished from actual SDK/Edge/browser acceptance and hosted release checks.

## Continuation and recording safeguards

Shared Auth events are authoritative; late startup lookups/sign-in/out completions cannot replace newer events. Employee/student sign-in validates in an isolated session before committing to shared auth; failed old login cleanup cannot sign out a newer shared account. Assignment material upload is pinned to the initiating JWT, compensates only confirmed pre-metadata failures with that identity, and never deletes a possibly referenced file after uncertain metadata confirmation. DW-046 records the unresolved operational cleanup gate.

Teacher continuation guards stop retired draft/save/publish/audio/assistance work. Microphone tracks are stopped on unmount, late permission, unsupported recorder construction or recording-start failure. Student multi-file loops stop before the next upload after retirement. Same-account refresh preserves active drafts; current server checks still govern all requests.

Local acceptance reruns passed with exact disposable cleanup for account switching, initial activation, employee invitation/recovery, independently approved student recovery, submission/teacher publication/course closeout/archive, checklist, class agenda/cancellation/latest alerts, private lesson files, read-only version impact and actual native scheduled delivery. HMAC throttle counters expire separately under existing rules. Remaining composed workflow gaps stay explicit in the pilot checklist; this is not a claim of complete pilot or production readiness.
