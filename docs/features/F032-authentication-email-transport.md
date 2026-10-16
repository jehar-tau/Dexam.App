# F032 — Authentication email transport preparation

Status: concrete proposal under D-042 planning; D-046 provider/implementation choice pending. No provider account, DNS change, delivery, real address processing or production activation approved.

## Existing boundary

F016 generates exact-request invitation/recovery proofs and app links, clears fragments on entry, and uses isolated sessions. `_shared/local-employee-email.mjs`, worker preflights, callbacks and database email constraints deliberately allow fictional local email only. Changing Supabase SMTP alone cannot carry this complete custom application proof flow or satisfy its authorization rules. Preserve the existing implementation until a separately reviewed integration replaces it.

## Recommended next slice: D-046 B

Prepare a provider-neutral authentication-email interface and a Resend API adapter, tested entirely against a mock transport with fictional addresses. Limit purposes to existing employee invitations and unchanged-email recovery. Do not add student email, marketing, attachments, inbound mail, tracking or bulk contact import. This slice installs no live configuration, obtains no API key and changes no `.invalid` database constraint or local worker guard. The default runtime remains disabled for external sending; no new deployed worker invokes the adapter.

The interface receives the already validated purpose, exact recipient, approved sender/callback configuration and one delivery-attempt identity. Strictly validate HTTPS endpoint, headers, message type, exact app callback/path/fragment and one recipient; forbid arbitrary user-supplied endpoints/redirects. Keep provider keys server-only and separate from Supabase service credentials. Return a normalized accepted/rejected/uncertain result without provider bodies, message content, recipient or link in errors/logs.

An accepted provider response means accepted for delivery, not mailbox delivery or account activation. Reuse the exact message and idempotency key for a bounded in-memory retry; never generate another proof/link during a transport retry. Provider idempotency is not durable application recovery after a process restart. A lost result beyond the tested retry remains uncertain and requires current-state inspection and deliberate cancellation/reissue through the existing workflow. Do not persist credential-bearing email bodies to a new outbox in this slice.

Test malformed configuration, recipient/header injection, callback substitution, redirects, timeout/5xx, wrong response identity, rejected quota, identical retry payload/key, uncertain result and secret-safe errors. Preserve local capture tests and all identity/session/MFA behavior. Independent security review is required before acceptance. No live recipient is used in tests.

## Provider facts and cost envelope

Verified from official sources 2026-10-17: Resend lists Free at $0 with 3,000 transactional emails/month and 100/day; Pro starts at $20/month for 50,000. Free may fit the initial employee-auth workload, but employee count and peak recovery traffic are not yet measured. No plan upgrade, add-on or overage is approved. Local adapter testing adds ₹0 vendor spending. Domain purchase and eventual review/operations costs remain outside this allowance. [Pricing](https://resend.com/pricing).

Resend requires an owned verified sending domain; its docs recommend a subdomain and allow transactional tracking to stay disabled. No sender/subdomain is selected here. [Domain guidance](https://resend.com/docs/dashboard/domains/introduction).

Resend keeps idempotency keys for 24 hours. A retry must preserve the exact request within the application credential's shorter validity window; this does not extend a link's expiry. [Idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Supabase describes its default SMTP as a restricted testing service. Production sending needs explicit setup, not an assumption that default delivery will work. [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

## Later activation inputs and gates

Before any live setup/send: owner approves the provider's processing/retention terms, an owned sending domain/address, actual callback host, explicit test recipients, verified DNS changes, volume/rate budget, operational ownership and spending ceiling. Review provider-side message retention because recovery emails contain credentials; disable link/open tracking and verify this at the domain. Store secrets through dashboards/secret management, never chat. Test authenticated delivery/bounce behavior and exact identity/callback/session safeguards before real onboarding. Separately approve database/worker changes for real email addresses and activation. Student recovery, uncertain-password resolution, backups and production go/no-go remain their own gates.
