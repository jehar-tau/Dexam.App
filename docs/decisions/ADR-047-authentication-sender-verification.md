# D-047 — Authentication sender account/domain verification

Status: awaiting owner choice. Concrete DNS/sender plan: `AUTH_EMAIL_SETUP_PLAN.md`. D-046 B explicitly excludes account setup and DNS changes.

The owner supplied `designexam.com` for planning. Public DNS currently routes root mail to Zoho through DomainControl nameservers. The proposed isolated sending subdomain is `auth.designexam.com`, with candidate sender `accounts@auth.designexam.com`. No new records or account have been created.

- **A — Defer external setup:** keep the verified mock adapter and continue offline readiness planning. ₹0 additional vendor spend; live email remains blocked.
- **B — Recommended: configure free account and verify only the sending subdomain:** set up/reuse an owner-controlled Resend Free account, register `auth.designexam.com`, and add only provider-issued verification records within that subdomain's DNS namespace. Preserve root nameservers, root MX/SPF and existing Zoho service. No mailbox migration, DMARC enforcement change, application sending, real employee recipient import, API key/runtime activation, paid plan or production deployment. ₹0 additional vendor spending within the existing domain/Free plan; if payment or a broader DNS change is required, stop for a new decision. The owner performs required sign-in and any account/terms acceptance; Codex handles the technical setup. DNS records can be removed to reverse verification, but account/provider-side records may persist under its terms.
- **C — Use an existing verified Resend account/sender:** inspect that owner-selected account after login and prepare reuse without adding DNS records. ₹0 for inspection; confirm existing quotas, ownership and costs before activation. No sending, upgrades or runtime integration approved.

Recommendation: B resolves ownership and verification prerequisites while preserving the existing mail service. Record the actual issued records and successful DNS/provider verification privately where appropriate; never put account tokens or keys into the public repository. Any required owner login/terms acceptance, unavailable Free plan, out-of-scope record or collision must be surfaced before the affected action.

This choice does not authorize recipient delivery tests or production email. Those still require exact approved callback/recipient configuration, privacy/retention review, live integration tests and an explicit activation decision.
