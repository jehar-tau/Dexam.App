# D-049 Student attempt editing and repeat submission

Status: Option B approved by owner on 2026-10-18; implementation in F034. Supersedes F006 immediate submission locking for editing before published review.

## Requested outcome

The owner requests editing of submitted attempts before review, permanent locking after review, and student-initiated second, third and subsequent attempts rather than requiring a teacher correction request. This supersedes F006's immediate finalization lock only after the new rule is fully specified and implemented. Existing ownership, active enrolment, release eligibility, private storage and upload limits remain in force. No production activation or paid service is included.

## Current evidence

F006 and `enforce_submitted_attempt_immutability` lock all submitted attempts. `start_assignment_attempt` accepts assigned/correction-requested instances only. Teacher feedback can have a private draft before publication. Simply reopening submitted rows could allow feedback written against an earlier file set to publish against changed work. This needs an explicit workflow choice, not just a button change.

## Options

### A Lock when the teacher starts a review

Students may edit submitted work until a teacher starts a feedback draft; starting review locks that attempt. Further numbered attempts remain available while current academic access permits. Smaller implementation, but editing stops before feedback is published and therefore earlier than the owner's proposed visible review boundary. No extra vendor spend for fictional/local testing.

### B Lock after published review with version checks

Students may edit until feedback is published. Preserve the prior submitted snapshot internally; changed work invalidates stale feedback publication without deleting the teacher's private draft. The teacher must reload and explicitly review the updated submission before publishing. Published reviews permanently lock the exact reviewed attempt. Students can create further numbered attempts independently of a correction request, with one editable draft at a time. Existing per-attempt limits apply; no promise of infinite storage. More implementation/concurrency testing; matches the requested editing boundary. No extra vendor spend for fictional/local testing. Recommended.

### C Keep submitted snapshots immutable and permit further attempts

Do not edit submitted attempts; allow further numbered attempts without a correction request. Every submission remains an attributable snapshot. Simplest history model but does not provide the requested edit action. No extra vendor spend for fictional/local testing.

## Implementation and acceptance

F034 implements the approved B choice across database/storage/API/UI, covering ownership, revoked/ended access, reviewed locking, multiple attempts, stale teacher drafts, concurrent edit/publication and retries. Teacher queues retain existing scope and label exact attempts/versions. Online and printable handbooks are refreshed. Independent security review cleared the implementation; required CI remains a merge gate. No new grants, resets, production activation or general private-file deletion authority.
