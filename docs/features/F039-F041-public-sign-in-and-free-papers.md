# F039 and F041 — Public sign-in, onboarding and free papers (redesign step 6)

Status: Implemented locally 2026-10-28 under D-054 A and D-057; in review.

- **Google sign-in is not switched on yet:** that waits for Decision Gate D-058 below and the owner's Google OAuth client.
- **Everything after sign-in is built and was tried locally:** account setup, onboarding, access rules, free papers and locks. The local test used a fictional candidate with a simulated Google identity.

## Purpose

The test series is sold across India, not only to coaching students. A public candidate needs to sign in with Google, say whether they are preparing for B.Des or M.Des, and try one free paper of each exam before paying. Coaching students keep their Member ID and get every paper.

## User flow

1. A signed-out visitor to any `/tests` page goes to `/tests/sign-in`. The page offers:
   - **Continue with Google**;
   - **Sign in with your Member ID**, for coaching students; it returns them to the test series.
2. Google returns to `/tests/welcome`. On the first visit, `provision_google_candidate()` creates:
   - a person (named from the Google profile);
   - an `oauth_google` login link;
   - an active **candidate** membership.

   It refuses any login that did not come from Google, and never touches an existing person.

3. The candidate chooses **B.Des or M.Des**, the exams they are taking (UCEED / NID DAT / NIFT, or CEED / NID DAT / NIFT) and their exam year (`save_candidate_profile()`). They then land on Papers.
4. **Papers:**
   - **Every paper** of an exam with an unused free slot shows **Free**: any one year can be the free paper.
   - **The claimed paper** shows **Your free paper**.
   - **Others** show **Locked** ("More papers unlock with a plan, coming soon").
   - **The other programme's papers** are locked.

   The paper page says "Starting this paper uses your free UCEED paper" before the claim.

5. Opening a paper claims the free slot on the server (`assessment_claim_paper()`, called inside `open_assessment_attempt()`). A second paper of the same exam, or a paper outside the candidate's programme, is refused with `DX001`, and the exam window says "This paper is not included". The claimed paper can be re-taken.
6. **Shell and exam login:** the shell shows the candidate's name and "B.Des candidate". The exam-centre login shows their name and a `CAND-…` reference instead of a Member ID.

## Access rules

| Who                                                    | Test series              | Papers                                                       | Practice                 |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------ | ------------------------ |
| Coaching student (active student membership)           | Yes                      | All                                                          | Yes                      |
| Candidate (active candidate membership, profile saved) | Yes                      | One free paper per exam of their level, plus entitled papers | Yes (interim, see below) |
| Login with no test-series account                      | Sent to `/tests/welcome` | —                                                            | —                        |
| Signed out                                             | Sent to `/tests/sign-in` | —                                                            | —                        |

**Server side:**

- `current_person_can_take_tests()` (student or candidate) replaces the student-only check in every assessment function. The coaching portal still requires a student membership.
- `current_person_can_open_paper()` decides paper access.
- `get_test_access()` returns the kind, name, profile, free slots and entitled papers.
- `candidate_profiles` and `assessment_entitlements` have no browser grants.
- **One free paper per slot:** a unique index on `(person, free_slot)` makes one free paper per slot race-safe.

**Free-paper slots** are derived from the bank paper id:

- `uceed-*`;
- `ceed-*`;
- `nid-bdes-*`, `nid-mdes-*`;
- NIFT ids containing `bdes` or `mdes`.

B.Des slots are UCEED, NID B.Des and NIFT B.Des; M.Des slots are CEED, NID M.Des and NIFT M.Des. NIFT B.F.Tech and M.F.M papers have no free slot.

## Decision Gates (owner)

**D-058 — opening sign-up to Google only.**

Supabase blocks every new account while `auth.enable_signup = false`. The email provider must stay on, because staff and students sign in with it, so switching sign-up on would also let anyone create an email/password account.

1. **Option A (recommended):** switch sign-up on, and add a Supabase "before user created" auth hook that rejects every new user whose provider is not Google.
   - **Proof first:** on staging, confirm that staff invites and student activation, which create users with the service role, still work.
   - **Reason:** this is the only option that admits Google candidates while closing email sign-up at the source.
   - **Reversibility:** turning sign-up off again restores today's behaviour.
2. **Option B:** switch sign-up on with no hook.
   - **Effect:** stray email sign-ups would still get no test-series access (`provision_google_candidate()` refuses them), but they would create auth users.
   - **Use:** acceptable only for local testing.
3. **Option C:** keep sign-up off, and invite candidates by hand. This does not scale to public sales.

**F039 gate — linking a Google account to an existing coaching Member ID.**

- **Interim default:** never linked automatically. A coaching student who signs in with Google becomes a separate candidate.
- **Alternatives:** an explicit, verified linking flow later; or block Google sign-in for emails that belong to a coaching student.

**To switch Google on locally after D-058:**

1. Create a Google OAuth client with the authorised redirect URI `http://127.0.0.1:54321/auth/v1/callback`.
2. Set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
3. Set `[auth.external.google] enabled = true` and apply the chosen sign-up setting.
4. Add `http://127.0.0.1:5180/tests/welcome` to `additional_redirect_urls`.
5. Restart the local stack.

## Interim defaults (owner to confirm)

- **Free paper choice:** the candidate picks any one year per exam, rather than a fixed free paper. This avoids handing out papers whose questions are still in review.
- **Practice:** open to candidates during R1. Revisit with pricing in R2.
- **Plans:** locked papers say plans are coming. Purchases arrive with commerce (R2, F049).

## Out of scope

Payments and plans (F049), linking accounts, staging or production auth configuration, and the Overview page.

## Verification

- pgTAP `00420_public_candidates_entitlements.test.sql` (31 checks):
  - slot mapping and no browser grants;
  - email-only logins refused;
  - provisioning is idempotent;
  - candidates are not students;
  - profile validation;
  - free-slot claim and lock, `DX001`, and re-takes;
  - students open everything and record no claims.
- Vitest (`TestsAccess.test.tsx`):
  - the safe return path;
  - paper access states;
  - sign-in calls Google OAuth with the welcome redirect;
  - setup then onboarding;
  - non-Google refusal;
  - students pass straight through.
- Playwright: the sign-in page, and the test series redirecting to it.
- **Local live check, with a fictional candidate and a simulated Google identity:**
  - setup and onboarding;
  - Papers badges and locks;
  - claiming UCEED 2025;
  - UCEED 2024 locked;
  - the exam login showing the candidate's name.
