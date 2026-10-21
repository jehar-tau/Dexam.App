# D-051 — First actual email connection test

Status: Option A approved 2026-10-21. This is not authentication activation or production approval.

Following F036 offline preparation and verified sender/key-scope metadata, the owner chose:

- **A — Recommended, approved:** prepare an isolated local interactive runner, then send exactly one fixed non-sensitive connection-test email from `accounts@auth.designexam.com` to the owner's privately designated test inbox. The owner enters the saved sending-only key in a hidden terminal prompt; it is not saved to disk/chat or added to hosted secrets. No account links, real onboarding, production changes or paid plan.
- **B — Defer:** retain offline preparation and do not send a real test.
- **C — Plan hosted testing first:** separately review deployment, secrets and environment scope before a hosted test.

All options add ₹0 vendor spending within the existing Free plan. The approved recipient is kept out of public documentation/source control. The operator must confirm the actual destination and single send in the local terminal. No bulk send, contact import, recurring send, live auth invitation or automatic retry is authorized.

The runner has no daemon, deployment, environment-secret reading or persistent key store. `--check` is offline; no flag/default sends automatically. `--send` requires a real interactive TTY, typed recipient and `SEND ONCE` confirmation, followed by hidden key entry. Provider acceptance must be distinguished from inbox delivery. A rejected/uncertain result ends the run; investigate provider activity before a separately authorized next attempt. The delivery UUID is printed without message contents or key for investigation; it is not durable deduplication across new invocations.

The owner handles secret entry. Do not observe/capture the screen, clipboard, terminal history or raw stdin during that step. No agent should ask for a key in chat. JavaScript strings cannot guarantee zeroization; private custody and no persistence/output minimize exposure but do not claim hardware-backed memory erasure.

Future real authentication still requires reviewed callback/environment/real-address/worker policy, tracking/TLS/retention requirements, rate controls, session/MFA proof preservation and explicit activation. The local test changes no account or grant. Reverting the runner removes future execution capability; an email already sent cannot be recalled.
