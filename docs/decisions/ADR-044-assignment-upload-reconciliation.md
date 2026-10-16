# D-044 — Unconfirmed assignment uploads

Status: awaiting owner decision

The recoverability work is implemented and the active-CRM erasure defect is fixed. DW-046 now needs a retention and deletion-authority choice. `F030-assignment-upload-reconciliation.md` specifies the proposed implementation.

- **A — Keep manual investigation:** retain unconfirmed uploads and the existing fail-closed behaviour; no cleanup worker. ₹0 new vendor spending; unresolved storage growth and launch gap remain.
- **B — Recommended: tracked uploads and 30-day quarantine:** build the reservation/attachment fence and a bounded service worker that deletes only tracked, unreferenced uploads after 30 days. Referenced files and unknown legacy objects are protected. Implement and test with fictional local data; no production job or real-file deletion. ₹0 new vendor spending. Adds an explicit retention rule and automated deletion authority, so owner approval is required. Code is reversible; actual future deletion is not.
- **C — Broader retention design first:** include retirement of published materials and wider file/audit retention before building cleanup. ₹0 for planning, larger scope and additional policy choices; orphan cleanup remains unimplemented meanwhile.

Recommendation: B resolves the bounded new-upload failure without changing student access or published-material retention. No password-reset unlock, new role grant, paid provider or production activation is part of any option.
