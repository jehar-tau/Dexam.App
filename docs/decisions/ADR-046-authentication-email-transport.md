# D-046 — Authentication email transport preparation

Status: awaiting owner choice. Concrete implementation/test scope: F032.

Employee authentication email is required before launch. Provider choice and integration affect credential-bearing messages, cost and data processing. No vendor account or delivery is approved by planning alone.

- **A — Keep local capture and defer integration:** ₹0 extra vendor spending; real employee onboarding stays blocked.
- **B — Recommended: prepare the Resend adapter with fictional mock tests:** implement the provider-neutral transport and Resend candidate without live account/configuration, DNS, API calls, real recipients, changed email constraints or production activation. ₹0 extra vendor spending now. Candidate Free tier is 3,000/month and 100/day; optional Pro begins at $20/month for 50,000, but no paid plan is approved. Actual domain, privacy/retention terms, volume and live tests require a later explicit activation choice. Adapter code is replaceable.
- **C — Specify an existing/preferred SMTP provider first:** ₹0 for discovery; use the owner's provider constraints to design a compatible adapter. Actual provider costs and activation remain unapproved. Merely entering SMTP settings does not preserve the custom proof flow automatically.

Recommendation: B advances required engineering at zero additional vendor cost while leaving account activation and credential-bearing delivery under explicit control. No option authorizes student email, marketing, real data, paid services or production.
