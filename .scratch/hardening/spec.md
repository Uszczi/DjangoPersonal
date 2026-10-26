Status: needs-triage

# Hardening

## Problem Statement

The app works feature-wise, but lacks things a production service with real data needs: deploys are not gated by tests, login can be brute-forced and there is no password reset, list endpoints return every row at once, and the observability stack (Tempo, Alloy) receives no traces from the backend.

## Solution

Four independent tickets, in suggested order:

1. `01-ci-gate` — run `just check` on every PR and push; deploy only after it passes.
2. `02-login-rate-limit-and-password-reset` — throttle login with Redis, add a password-reset flow.
3. `03-transactions-pagination-tanstack-query` — keyset pagination for transactions, TanStack Query on the web for that one domain.
4. `04-opentelemetry-tracing` — instrument FastAPI and SQLAlchemy, ship traces through Alloy to Tempo.

## Out of Scope

- Rewriting other domains to TanStack Query (follow-up after ticket 03 proves the pattern).
- Async SQLAlchemy.
