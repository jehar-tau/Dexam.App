# F036 — Isolated authentication email connection probe

Status: preparation authorized 2026-10-21. Offline implementation verified; independent review found no concrete blockers. Required PR CI remains the merge gate. Not deployed or activated; no real key consumed and no email sent.

## Scope and authority

Following D-047 B sender verification, the owner created a provider key and confirmed private custody. The owner then authorized engineering preparation of the connection, explicitly leaving real key use, live sending and production disabled. This slice implements only a fixed non-credential connection probe. It does not replace F032, relax fictional email constraints, create administrators or integrate invitations/recovery with Resend. Subsequent read-only metadata inspection confirms Sending access restricted to `auth.designexam.com`, with zero uses; the secret was not revealed.

## Implementation

`supabase/functions/_shared/resend-connection-probe.mjs` is server-only and unconnected to any handler or CLI. It performs no environment lookup, import-time request, automatic send or global configuration change. A missing/false enable flag returns disabled with zero attempts. Enabling requires a supplied server-side key and one operator-configured recipient. No recipient, sender, content, endpoint or key can be supplied through a browser request; there is no public endpoint in this slice.

The sender is fixed to `Dexam <accounts@auth.designexam.com>`. The fixed plain-text test says no account was created/changed and contains no sign-in link. There is no custom body, OTP, invitation, attachment, HTML, tracking pixel, CC/BCC or recipient list. The configured address is snapshotted and never returned. The only per-call input is a UUID used for the idempotency header. Real private recipient addresses and keys must never be committed.

The executor uses the fixed HTTPS Resend send endpoint, rejects redirects, omits ambient credentials and has a ten-second request/body deadline. Responses are bounded to 2 KB. A strict success identity returns `accepted`, meaning accepted by the provider, not delivered to a mailbox. Initial definite 4xx rejections exclude timeout/conflict; network failure, redirects, timeout, malformed success and server errors stay `uncertain`. No raw body, key, address or provider error is exposed in results/errors/logs. Each probe instance permits only one attempt, including concurrent calls; this is per-instance protection, not durable or cross-process deduplication. No automatic retry or restart guarantee is claimed. A future runner must persist the same delivery UUID for the same logical probe, not generate a new identity on uncertain retries. Provider idempotency has a bounded window, not indefinite duplicate prevention.

## Validation

All new tests inject fake fetch implementations and fictional addresses/keys, never actual network transport. Cover disabled defaults, injection/expanded configuration, accessor refusal, configuration mutation, fixed request, identity validation, concurrent calls, rejection/uncertainty, malformed/oversized replies, secret-safe exceptions and timeout/abort. All 33 new cases and 75 F032/local-capture regressions passed (108 focused cases). Full verification passed 479 application tests, formatting, lint, typecheck, synthetic-fixture validation, production build and bundle budget. Independent read-only security review found no concrete blockers; its clarification on per-instance deduplication and future runner freshness/authority is incorporated above. No schema, worker or UI change; actual network/browser delivery is deliberately not claimed. Required CI precedes merge.

## Next activation boundary

Before a real probe, review the actual scoped key without disclosing it, configure the secure execution path/secret custody, confirm the exact recipient and one-message permission, verify tracking disabled and required TLS, and review provider-side retention/processing terms. The isolated helper does not enforce a human approval token or approval expiry; any future live runner must enforce explicit authority/freshness and stable delivery identity before invoking it. No API key is currently installed in Supabase, Cloudflare, GitHub or the repository. Do not add one to fictional staging merely because that is the existing deployment.

Real authentication remains separate work: choose/approve the actual app callback origin/environment, real-address constraints and worker policies; bind the existing request/expiry/cancellation/session/MFA proof; implement a reviewed transport and rate/failure controls; and prove authorized delivery before administrator onboarding. A successful non-credential probe does not satisfy these gates or authorize public launch.

Provider contract checked 2026-10-21 against the [send-email API](https://resend.com/docs/api-reference/emails/send-email) and [idempotency guidance](https://resend.com/docs/dashboard/emails/idempotency-keys). No paid service or live call was used for this slice.
