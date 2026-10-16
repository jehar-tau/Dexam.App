# F030 — Assignment upload reconciliation

Status: D-044 Option B approved 2026-10-16; fictional/local implementation verified. Addresses DW-046. No production activation or real-file deletion approved.

## Existing failure

`uploadAssignmentMaterial` uploads bytes, then inserts `assignment_materials`. A lost insert response may hide a committed attachment; the browser deliberately retains the object. Account revocation can also prevent safe compensation. Deleting everything absent from one query would race attachment and risk a referenced file.

## Approved scope: D-044 B

Keep current draft-editing capabilities, file types, five-file/10 MB limits, publication pinning and student access. Add a private server-owned reservation ledger for new assignment material uploads; capture assignment version, initiating actor, unique object path, timestamps and state. No file content, credentials or signed URL goes in the ledger/audit. Existing referenced assets remain readable and protected; unknown legacy objects are report-only, never silently adopted or deleted.

The current author reserves a slot under the assignment-version lock, uploads once to its exact reserved path, then asks the server to attach. Attachment and cleanup claim serialize on the same reservation. The server checks current authority and draft state at attachment, even if upload began earlier. Database guards enforce this for every metadata insert path; browser-only guards are insufficient. New reservations count against the existing file limit until released safely.

Reservation fencing must also cover direct Storage INSERT, UPDATE and DELETE policies, not just metadata operations, so clients cannot bypass reservations or overwrite/delete protected paths.

Reservation states: reserved, attached, quarantined, deleting, deleted. A lost response can be retried by request identity and returns current state without duplicate attachments. A committed attachment wins over an uncertain browser outcome. Only genuinely unreferenced reservations may enter quarantine. Approved grace: 30 days from reservation before deletion eligibility (D-044 B), not inherited permission from lesson files.

The bounded service worker atomically claims eligible unreferenced reservations and prevents later attachment before calling the Storage API. It rechecks references and holds/current state; errors retain a retryable record. It never changes credentials, uses another browser user's session, deletes a referenced published/draft asset, or guesses ownership from a filename. Record a deletion marker and reconcile late-arriving object bytes against that marker; never reopen attachment or forget an uncertain in-flight upload. Physical deletion is verified separately from metadata state. No production scheduler is enabled in this slice.

Reporting is restricted to existing scoped content authority for its own assignment; no new Teacher reader or broad staff file browser. Product owner remains human incident lead and Rohin backup. Production worker ownership, alert channel, audit/marker retention and activation remain launch decisions; fictional markers may live only for the disposable test run.

## Acceptance evidence

- Before/after lost response: committed attachment survives; retry returns same result.
- Revocation/account replacement: attachment denied; no compensation uses replacement credentials.
- Concurrent attachment versus cleanup: exactly one allowed outcome; no published or referenced file deleted.
- Thirty-day boundary, unattached upload, failed delete, late upload, retry and repeated execution.
- Existing references and unknown legacy objects remain protected; a newly published version cannot be altered through cleanup.
- RLS/direct API negative tests, scoped reporting, size/slot limits and secret-safe errors.
- Actual fictional Storage upload/delete verification with exact owned cleanup, plus independent security review.

No actual student's files, new vendor, spending or production is authorised. Full retired-published-content deletion and password-mutation reconciliation (DW-045) remain separate scopes.

## Implementation and operating boundary

New uploads reserve a slot before Storage upload and attach through an idempotent RPC. Browser code retries an uncertain reserve/attach once with the same request identity, never deletes bytes and never borrows replacement-account credentials. Unconfirmed reservations continue consuming slots until safely claimed for cleanup; refresh before repeating an uncertain upload. Existing referenced files are not backfilled or altered. Direct metadata inserts require a matching reservation and confirmed object metadata; every mutation rechecks draft state and authority after locks. Storage insert requires the initiating owner/reservation; direct Storage update/delete is denied.

`list_assignment_uploads` provides a bounded (100-record) scoped-author report without object URLs; it does not grant Teacher access. There is no new reporting screen. Private service-owned hold flags block cleanup. No browser can set/release holds or operate the worker.

`pnpm pilot:assignment-uploads` runs the actual local SDK/Storage exercise and cleans exact randomized fixtures. Its reusable helper rejects non-local clients and requires up to 100 explicit upload IDs. It uses claim → recheck → Storage API delete → database absence confirmation. Failed cleanup stays retryable; deleted markers are retained and revisited for late object metadata/bytes. No local recurring job, hosted function or production scheduler is installed. A production worker, marker retention, durable deletion evidence, off-site recovery and operational alerting remain launch gates. Provider internals/invisible orphan bytes are not independently inspected by this Storage API exercise.

The actual test covers idempotent requests, reference/legacy/hold protection, direct overwrite/delete denial, failed-delete retry, late upload recheck and both queued direct metadata INSERT/DELETE across publication. Exact fixture accounts/files/domain rows are removed with FK constraints retained. Publication fixtures are privileged synthetic setup, not publication-approval UI evidence.

Acceptance 2026-10-16: 304 app/unit tests, 1,111 database assertions (36 files), 63 Chromium regression journeys, actual Storage acceptance and independent security review passed. Formatting, lint, types and production build passed; the existing bundle-size warning remains. The new upload path is tested through real SDK/Storage and component tests; the existing browser journeys are regression coverage, not a new real-account upload UI journey.
