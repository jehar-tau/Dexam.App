# Cost Model

Status: Planning estimate
Last reviewed: 2026-09-26

This document estimates external software and infrastructure costs. It does not include taxes, payment-processing fees, the product owner's existing domain or AI subscriptions, salaries for hired developers/designers, legal/accounting costs, content production, advertising, or hardware.

Prices change. Verify current vendor pricing before every paid commitment. No agent may start a paid plan or disable a spend cap without explicit owner approval.

## Cost principle

Use free, open-source, or usage-based services while validating Dexam, provided they preserve a safe migration path. Do not choose a fragile free service when it creates expensive lock-in. The durable core is React/TypeScript plus PostgreSQL migrations, which can move between hosts if Dexam eventually outgrows the initial vendors.

## Phase estimates

| Phase                                          |                             Expected platform cost | What it covers                                                                         | Important limitations                                                                     |
| ---------------------------------------------- | -------------------------------------------------: | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local design and development                   |                                        USD 0/month | GitHub Free, local app, local PostgreSQL/Supabase, tests                               | Uses the owner's computer; AI subscriptions are separate                                  |
| Internal demo                                  |                                        USD 0/month | Cloudflare static hosting and local/free backend                                       | No real student records required                                                          |
| Closed pilot                                   |                                     USD 0–25/month | One free hosted Supabase project, free static hosting and basic email                  | Free database can pause, has small quotas, and lacks production backup/support guarantees |
| First paid/public launch                       |                        About USD 25/month plus tax | One Supabase Pro production project; frontend and normal CI remain free                | Video, high-volume email, payments and unusual usage are separate                         |
| Early operation, roughly 1,000 active learners |     Roughly USD 25–150/month plus transaction fees | Database/auth, ordinary files, email and light analytics within mostly free allowances | Video consumption and large student uploads can raise cost materially                     |
| Growth, roughly 10,000 active learners         | Roughly USD 100–1,000+/month plus transaction fees | Larger compute, storage, email, analytics and media usage                              | Usage behavior matters more than user count; video is usually the largest variable        |

The upper growth estimates are deliberately broad. We cannot responsibly promise a precise figure before knowing monthly active learners, lesson/video hours watched, assignment file sizes, email/WhatsApp volume, and payment revenue.

## Foundation services

### Source control and continuous integration

- GitHub Free: USD 0, private repositories included.
- Current allowance: 2,000 GitHub Actions minutes per month for private repositories.
- Control: run fast checks on pull requests, reserve full browser suites for relevant changes, use Linux runners, and stop rather than automatically paying when the allowance is exhausted.

### Frontend hosting

- Cloudflare Pages static assets: USD 0 within current platform rules; static asset requests are currently free and unlimited.
- Control: do not add Cloudflare Pages Functions by default. Trusted backend code belongs in Supabase Edge Functions, avoiding a second backend billing surface.

### Database, authentication and basic storage

- Supabase Free: USD 0; currently two free active projects, 500 MB database and 1 GB file storage per free project, with projects eligible to pause after inactivity.
- Supabase Pro: starts at USD 25/month; currently includes one default project, 8 GB database disk, 100 GB file storage, 100,000 monthly active users, 250 GB egress, and daily backups.
- Additional paid project: currently starts around USD 10/month in compute beyond the plan's included compute credit.
- Control: local environment for daily work, one free staging project, and no paid production project until launch readiness. Keep spend cap on.

User capacity cannot be inferred from the advertised monthly-active-user quota alone. Database queries, realtime use, file transfer, and media consumption may become limiting first.

### Transactional email

- Start with Supabase's local mail capture during development.
- Resend Free currently includes 3,000 emails/month with a 100-email daily limit.
- Resend Pro currently starts at USD 20/month for 50,000 emails.
- Control: send only essential transactional messages, add notification preferences, and do not use transactional infrastructure for marketing campaigns without a separate decision.

### Analytics

- PostHog currently includes the first 1,000,000 product-analytics events each month for free.
- Control: begin with a small event taxonomy, never track sensitive student content, and set a billing limit before enabling overage.

## Later variable services

These are not approved by D-002; they are included only so total cost is visible.

### Large files

- Cloudflare R2 currently includes 10 GB-month storage, 1 million writes and 10 million reads per month free.
- Beyond that, standard storage is currently USD 0.015/GB-month with no direct Internet egress fee.
- Use only when Supabase Storage is no longer the best fit. Private access architecture and malware/file validation require a separate decision.

### Video

- Video cost depends on stored hours, resolution and viewing traffic, not just student count.
- Bunny Stream currently advertises storage from USD 0.01/GB, delivery from USD 0.005/GB, and a USD 1 monthly minimum; regional delivery rates can differ.
- Example only: 1,000 learners watching substantial video every month can create several terabytes of delivery, making video a larger bill than the database.

### Payments

- Razorpay currently has no setup or annual maintenance fee for its standard gateway and charges a percentage only on successful transactions.
- Its published standard headline is around 2% plus applicable GST; exact method and account pricing must be verified when commerce is implemented.
- Payment fees scale with revenue and should be reported separately from infrastructure. At INR 5,00,000 monthly processed revenue, a 2% platform fee is approximately INR 10,000 before GST.

### WhatsApp and SMS

Not estimated yet. Pricing varies by message category, country, provider and Meta policy. This requires its own Decision Gate before integration.

## Cost to create the first milestone

Mandatory new software/infrastructure spending: **USD 0**.

The planned tools have free local or open-source paths. The existing Mac and Internet connection are assumed. The owner's current Codex, Claude, or other AI subscription/API charges are not included because they are not application infrastructure and depend on the chosen plans.

Before admitting paying students, the recommended minimum becomes approximately **USD 25/month plus tax** for Supabase Pro. Everything else can initially remain inside free allowances, assuming Dexam does not launch video-heavy delivery or high-volume messaging in the first milestone.

## Cost controls

- No credit card or paid upgrade without an owner-approved Decision Gate.
- Keep provider spend caps or zero-dollar budgets enabled where available.
- Configure alerts at 50%, 80%, and 100% of included quotas where supported.
- Review usage monthly once real users exist.
- Attribute storage, email, media, analytics, and AI costs by feature.
- Prefer usage-based services without annual commitments during validation.
- Negotiate volume pricing only after measured usage demonstrates a benefit.
- Re-evaluate self-hosting only when projected managed-service savings exceed the operational cost and risk of owning infrastructure.

## Current pricing sources

- GitHub pricing: https://github.com/pricing
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare Pages pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Supabase pricing: https://supabase.com/pricing
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Resend pricing: https://resend.com/pricing
- PostHog product analytics: https://posthog.com/product-analytics
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Bunny Stream pricing: https://bunny.net/pricing/stream/
- Razorpay pricing: https://razorpay.com/pricing/
