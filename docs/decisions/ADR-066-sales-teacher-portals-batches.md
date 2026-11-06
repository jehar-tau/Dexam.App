# D-066 — Sales and Teacher portals, batches created by Sales and placed by both

Status: owner decision, 2026-11-06, in chat. The owner was given options with a recommendation for each and chose:

1. **Batch roles:** "Both can assign".
   - Sales create batches.
   - Sales and teachers place and move students.
   - Teachers cannot create batches.
   - Every move is recorded.
2. **Portals:** "Sales portal + Teacher portal" (recommended).
   - The staff entrance becomes the Sales portal.
   - Content and Distribution move to the Teacher portal, with batch-wise Reviews.
   - Privacy moves to the Admin portal.
   - Old links keep working.
3. **Duration:** "Default per type, editable" (recommended).
   - Each service type pre-fills the end date, and Sales can change it.
   - The defaults are placeholders until the owner supplies them.

Students see the batch name but never its start date. This is owner-directed and enforced with a column-level grant.

These role defaults are the first owner-approved role-default capabilities since F026's "no default grants": `batch.manage` for Sales and Elevated Admins, and `batch.assign` for Sales, teachers (within their scope) and Elevated Admins. They grant nothing beyond batch operations. Implementation, limits and evidence are in `features/F055-sales-teacher-portals-and-batches.md`.

Reversibility: presentation changes revert in code. Capabilities are removed by deleting `role_capabilities` rows. The added columns and history tables are additive, and the history is kept.
