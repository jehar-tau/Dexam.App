# Authentication email setup — designexam.com

Prepared 2026-10-17; setup evidence updated 2026-10-21. D-046 B approved mock preparation and D-047 B subsequently approved Free-account/subdomain verification. This document itself activates no runtime or delivery.

## Latest verified setup evidence — 2026-10-21

The owner resumed setup and handled account sign-in. Resend now reports `auth.designexam.com` verified in Tokyo (`ap-northeast-1`). Provider-issued TXT `resend._domainkey.auth` and CNAMEs `rsend.auth` → `rsend-apne1.forge.rmta.net`, `send.auth` → `send.forge.rmta.net` were prepared, saved by the owner and checked against GoDaddy's records. Existing website A/www, nameservers, three Zoho root MX and root SPF records remained unchanged. The optional root DMARC suggestion was intentionally not added; receiving remains off. No website/root mail migration occurred.

The owner created an API key and confirmed saving it privately. Subsequent read-only provider metadata confirms Sending access restricted to `auth.designexam.com`, with zero uses/no activity. The secret was not revealed, copied to chat or installed in any runtime. Configuration offers tracking setup but tracking has not been independently proven disabled for credential-bearing delivery. TLS currently shows Opportunistic; secure credential delivery policy still needs review before activation.

F036/D-051 A's isolated local one-message non-credential test is complete: the owner reported provider acceptance and confirmed inbox receipt on 2026-10-21. This is owner-reported evidence, not an inbox/header audit. No credential-bearing message, recipient import, actual administrator provisioning, hosted runtime activation, paid upgrade or production deployment occurred. No repeat test is authorized by default. Keep real private recipient/account lists out of repository artifacts. The historical handoff below is superseded for account/domain verification, owner key custody and the specific one-message test, not broader live-delivery authority.

## Observed public DNS

Read-only DNS checks on 2026-10-17 returned nameservers `ns53.domaincontrol.com` and `ns54.domaincontrol.com`, with root MX records pointing to `mx.zoho.in`, `mx2.zoho.in` and `mx3.zoho.in`. A root SPF record is present. The resolver returned NXDOMAIN for `_dmarc.designexam.com`; no A/AAAA/CNAME/MX/SPF answer was observed for the proposed `auth.designexam.com`. This is a dated observation, not proof that the subdomain is unused by every service or an authorization to change it.

Use the authoritative DNS account for any eventually approved records. Frontend hosting on Cloudflare does not itself determine where this domain's DNS is managed. Preserve the existing root MX/SPF records and Zoho mail service. Review any root policy separately before changing it.

## Proposed sender boundary

Candidate sending subdomain: `auth.designexam.com`. Candidate sender address: `accounts@auth.designexam.com`, with a Dexam Accounts display name if the later implementation supports it. These are proposals, not configured/verified senders. Confirm support replies or an approved Reply-To mailbox separately; do not assume the candidate address receives mail.

Before live use, the owner must approve the exact sender, provider account/terms, delivery recipients and DNS scope. Choose a verified subdomain in the provider dashboard and copy only the exact records issued there. Do not invent DKIM selectors, SPF values, return-path MX records, verification tokens or DNS record contents from examples. Record expected owner/name/type, verify authoritative answers after propagation and preserve rollback information for only the newly approved records.

Disable open/click tracking for authentication messages and verify that setting. Review provider-side credential-bearing message retention and any applicable processing terms. A domain verification success is not permission to send messages or activate production authentication. No paid upgrade, overage, DNS transfer or root mailbox migration is part of the proposal.

## Engineering work still required after mock acceptance

1. An approved live transport/integration design must replace the closed mock's wire executor and explicitly consume a server-side provider key. No environment switch in the current mock can send email.
2. Preserve the exact application invitation/recovery proof, including invitation reissues that use recovery OTP type with the activation route. Keep request ownership, link expiry, cancellation/replay checks, session cutoffs and MFA unchanged.
3. Design reviewed production email validation/database migrations and exact callback origins. The current `.invalid` constraints and local-only worker policies remain mandatory until that integration is approved. `designexam.com` as a sender does not select the production app's hostname.
4. Approve explicit delivery-test recipients through a private allowlist/configuration, volume/rate budgets and accountable failure handling. Never collect credentials or recipient lists in public issues, logs or source control.
5. Test accepted/rejected/uncertain transport results, delayed/bounced messages, safe retries, quota exhaustion and actual authorized delivery before onboarding. Keep uncertain password mutation resolution as its separate gate.

## Historical handoff — 2026-10-17

D-047 Option B was approved on 2026-10-17 for an owner-controlled Free account and provider-issued verification records confined to `auth.designexam.com`, preserving root DNS and Zoho. Account sign-in/password reset is blocked; the owner elected to defer this setup and continue fictional workflow testing. No domain verification, DNS changes, API keys, recipient imports or runtime activation have been completed. Resume after the owner completes account sign-in and required terms acceptance; do not treat Zoho credentials as a Resend account.

Real messages, paid services, real employee onboarding and production deployment remain unapproved. Codex owns technical setup within the approved scope; the designer is only needed for ownership/login, material choices and actual launch approval. Never record passwords or credential screenshots in repository artifacts.
