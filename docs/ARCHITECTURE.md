# Architecture

Status: provisional; D-002 contains the detailed stack and deployment proposal pending approval.

## Proposed shape

- A TypeScript React web application for student, teacher, sales, and admin experiences.
- Supabase for PostgreSQL, authentication, local development, storage where suitable, server-side functions, and Row Level Security.
- A service/domain layer between interfaces and persistence so future UI or student APIs reuse authorization-aware operations.
- A separate public marketing website. Integration uses explicit APIs/events rather than shared `localStorage`.
- A modular monolith initially. No microservices, Kubernetes, custom authentication, vector database, or custom orchestration platform without demonstrated need.

## Environment boundaries

- Local: disposable developer data and local Supabase.
- Staging: production-like verification with synthetic/test data.
- Production: protected deployment and migrations requiring explicit release approval.

Secrets and credentials are different in every environment.

## Repository boundaries

This repository contains application code and engineering/product documentation. Normalized domain knowledge and original source assets should remain separately governed so large files and academic content do not bloat application history.

## Non-negotiable implementation constraints

- Authorization is enforced server-side and at the database with RLS, never only in the interface.
- Schema changes are versioned migrations.
- External webhooks are authenticated, idempotent, and auditable.
- Consequential background work is retry-safe.
- Observability must not leak student content or credentials.
