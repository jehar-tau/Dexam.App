# F030 — Assignment upload reconciliation

Status: concrete proposal under D-042 planning; D-044 awaiting owner choice. Addresses DW-046. No implementation, scheduled deletion or production activation yet.

## Existing failure

`uploadAssignmentMaterial` uploads bytes, then inserts `assignment_materials`. A lost insert response may hide a committed attachment; the browser deliberately retains the object. Account revocation can also prevent safe compensation. Deleting everything absent from one query would race attachment and risk a referenced file.

## Recommended scope: D-044 B

Keep current draft-editing capabilities, file types, five-file/10 MB limits, publication pinning and student access. Add a private server-owned reservation ledger for new assignment material uploads; capture assignment version, initiating actor, unique object path, timestamps and state. No file content, credentials or signed URL goes in the ledger/audit. Existing referenced assets remain readable and protected; unknown legacy objects are report-only, never silently adopted or deleted.

The current author reserves a slot under the assignment-version lock, uploads once to its exact reserved path, then asks the server to attach. Attachment and cleanup claim serialize on the same reservation. The server checks current authority and draft state at attachment, even if upload began earlier. Database guards enforce this for every metadata insert path; browser-only guards are insufficient. New reservations count against the existing file limit until released safely.

Reservation fencing must also cover direct Storage INSERT, UPDATE and DELETE policies, not just metadata operations, so clients cannot bypass reservations or overwrite/delete protected paths.

Reservation states: reserved, attached, quarantined, deleting, deleted. A lost response can be retried by request identity and returns current state without duplicate attachments. A committed attachment wins over an uncertain browser outcome. Only genuinely unreferenced reservations may enter quarantine. Proposed grace: 30 days from reservation before deletion eligibility; this is a new assignment-upload retention choice requiring D-044 approval, not inherited permission from lesson files.

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
