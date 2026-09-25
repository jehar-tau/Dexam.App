# ADR-002 — Application Stack and Deployment Architecture

Status: Proposed
Date: 2026-09-26
Decision ID: D-002
Risk: Red — architecture, security, recurring cost, and deployment

## Decision required

Approve, modify, or reject the recommended application stack, hosting model, environment strategy, and initial cost boundary described below.

## Context

Dexam Platform is an authenticated learning and operations application, separate from the public marketing website. It needs student, teacher, sales, and admin experiences; strong database authorization; file uploads; repeatable local development; automated tests; preview deployments; and a controlled path from staging to production.

The product owner expects the development agent to lead implementation and maintenance. The architecture should therefore favor a small number of well-supported services, reproducible workflows, visible costs, and technology that future agents and developers can readily understand.

## Recommendation

### 1. Runtime and package management

- Node.js 24 LTS, pinned in the repository and CI.
- pnpm with a committed lockfile and an explicit package-manager version.
- TypeScript in strict mode across application code.

Node 24 is an LTS release as of this decision. Major runtime upgrades should be deliberate maintenance changes rather than silently following `latest`.

### 2. Frontend

- React with Vite and TypeScript as a client-rendered single-page application.
- React Router for application routing and protected route composition.
- TanStack Query for remote/server state; local React state for interface state.
- React Hook Form and Zod for forms and boundary validation.
- Semantic CSS custom properties as design tokens plus CSS Modules for component styles.
- Accessible headless primitives only where they save substantial interaction work; Dexam owns the visual component layer.

The authenticated platform does not initially require server-side rendering. The existing marketing website remains responsible for public SEO pages. This boundary can be revisited if a future platform route has a genuine indexing or server-rendering requirement.

### 3. Backend and data

- Managed Supabase for PostgreSQL, Authentication, Storage, Realtime only when justified, and Edge Functions for trusted server-side operations.
- Row Level Security on every browser-accessible table and storage bucket.
- SQL migrations and fictional seed data committed to Git.
- Authorization-aware domain/service functions so the Dexam UI and future API/MCP surfaces share business rules instead of querying tables independently.
- No separate custom API server in V1 unless a concrete requirement cannot be safely met by PostgreSQL, Supabase APIs, or Edge Functions.

Cloudflare R2, Bunny Stream, Razorpay, messaging vendors, analytics, and AI providers remain separate future decisions. Approval of this ADR does not approve those services or their costs.

### 4. Testing and quality

- ESLint and Prettier for consistent source quality.
- TypeScript strict checking.
- Vitest and Testing Library for unit and component behavior.
- SQL/database integration tests for migrations, constraints, RLS, and storage authorization.
- Playwright for a small, high-value set of Chromium browser journeys initially, expanding to WebKit/Firefox for release-critical paths.
- GitHub Actions for pull-request verification and protected `main` merges.

### 5. Frontend deployment

- Cloudflare Pages connected to GitHub for static frontend hosting, custom domains, automatic production builds from `main`, and pull-request preview deployments.
- Proposed future production hostname: `app.designexam.com`.
- Preview deployments must contain only synthetic/test data and should be access-restricted when they expose unfinished or sensitive product behavior.
- Supabase Edge Functions, not Cloudflare Pages Functions, remain the default server execution surface so backend logic is not split without need.

Cloudflare Pages is selected over Vercel for the initial static application because Dexam is commercial, Vercel Hobby is restricted to non-commercial personal use, and Vercel Pro adds a recurring platform charge that is not currently necessary. Cloudflare's current guidance increasingly favors Workers for broader full-stack use cases; because this decision uses Pages only for static assets and previews, migration to Workers Static Assets remains feasible if Pages becomes a limiting path.

### 6. Environments and release path

#### Local

- Supabase CLI stack running in a Docker-compatible runtime.
- Disposable fictional data only.
- Local email capture rather than sending real messages.

#### Hosted staging

- One Supabase staging project with fictional/test data.
- Cloudflare preview/branch deployments point only to staging.
- Never copy production student data into staging.

#### Production

- A separate Supabase production project and Cloudflare production deployment.
- Production migrations run through a reviewed release workflow.
- Real users are admitted only after authentication, role, RLS, backup, monitoring, and recovery checks pass.
- Production deployment and destructive database operations require explicit owner approval.

### 7. Initial cost boundary

- Local development: no hosting charge; requires a supported container runtime.
- Cloudflare Pages static hosting: begin within the free plan limits.
- Supabase staging: begin on one free project while developing.
- Supabase production: it may be created as the second free project for pre-launch verification, but must move to Supabase Pro before admitting real students.
- Expected initial production baseline: approximately USD 25/month for one Supabase Pro project, excluding tax, domain, email delivery, video, large-file storage, payment fees, messaging, analytics, and usage overages.
- Keep the Supabase spend cap enabled. Any new recurring service or cost increase requires a separate Decision Gate.

Current Supabase pricing grants two free projects and lists Pro from USD 25/month with one default project covered. An additional project in the same paid organization adds compute cost; therefore staging should remain separately free until there is evidence that paid staging is necessary.

## Rejected alternatives

### Next.js or another server-rendered full-stack framework now

Rejected for the first milestone because the authenticated application does not currently need SSR, and it would add server runtime and framework coupling. Reconsider if platform pages require SEO, server rendering, or framework-specific server capabilities.

### Vercel Hobby

Rejected because it is restricted to non-commercial personal use. Vercel Pro remains a valid paid alternative if its workflow later creates enough value to justify the recurring charge.

### Firebase

Rejected because Dexam's courses, enrolments, permissions, submissions, reviews, payments, and reporting fit a relational PostgreSQL model, while Supabase provides PostgreSQL and database-level RLS.

### Self-hosted Supabase

Rejected initially because Dexam would inherit infrastructure security, upgrades, backups, monitoring, availability, and disaster-recovery responsibilities.

### Microservices or a custom Node API server

Rejected until scale or integration evidence demonstrates a real need. Begin with a modular monolith and explicit service boundaries.

### One shared hosted database for staging and production

Rejected because it creates unacceptable risk of test actions affecting real students and makes safe migrations and data handling harder.

## Consequences

### Benefits

- One primary language across the frontend, validation, tests, and Edge Functions.
- Relational data, migrations, and database-enforced authorization suit Dexam's domain.
- Low initial infrastructure cost and no custom server operations.
- Preview deployments and automated tests support a designer-led review workflow.
- The architecture can add specialized media, payment, messaging, or AI services later through explicit boundaries.

### Costs and risks

- Local Supabase requires a container runtime and substantial memory.
- Supabase is a central vendor dependency, though PostgreSQL and SQL migrations reduce data-model lock-in.
- A client-rendered application depends on correct loading, offline, and error-state design.
- Free hosting tiers have limits and no production-grade support commitments.
- Cloudflare frontend and Supabase backend require correct cross-origin, redirect, and environment configuration.

## Security and privacy implications

- All authorization must be verified through RLS and trusted server logic; hiding interface controls is not authorization.
- Production and staging use different projects, keys, redirect URLs, storage, and data.
- Browser-exposed keys are limited to publishable/anonymous credentials; service-role credentials remain server-only.
- Student uploads default to private storage and time-limited access.
- Authentication redirect URLs and custom domains must be allowlisted narrowly.
- Logs, test artifacts, preview deployments, and analytics must not expose student work or personal information.

## Implementation after approval

1. Pin Node 24 and pnpm.
2. Scaffold the React/Vite/TypeScript application.
3. Add routing, design-token foundations, linting, formatting, and strict checks.
4. Initialize the local Supabase configuration and migrations.
5. Install unit/component and browser testing foundations.
6. Add GitHub Actions CI.
7. Create the staging projects only when local foundation checks pass.
8. Create separate feature specifications for authentication and roles before implementing product behavior.

## Sources reviewed

- Node.js release status: https://nodejs.org/en/about/previous-releases
- React build-tool guidance: https://react.dev/learn/creating-a-react-app
- Vite guide and browser targets: https://vite.dev/guide/
- Supabase local development: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase environment workflow: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase pricing: https://supabase.com/pricing
- Cloudflare Pages GitHub integration: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Vercel Hobby restrictions: https://vercel.com/docs/plans/hobby
- Playwright CI: https://playwright.dev/docs/ci

## Approval

Pending product-owner decision.
