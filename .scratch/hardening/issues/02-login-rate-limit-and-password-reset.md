Type: task
Status: needs-info
Blocked by: none

# Login rate limiting and password reset

## Problem

- `POST /api/v1/auth/login/` (`auth_login`) has no throttling, so passwords can be guessed without limit (also the MCP `/login` page).
- A user who forgets their password has no way back into the account.
- Redis runs in `deployment/docker-compose.yml` but nothing uses it.

## What to build

### Part A — rate limiting

- A `RateLimiter` port in core (e.g. `core/accounts/ports.py`) with a Redis implementation in `infra/` and an in-memory one for tests / local SQLite runs (selected in `wiring.py` by a `REDIS_URL` setting).
- Limit failed logins per (IP, username), e.g. 5 per 15 minutes; on exceed return 429 with `Retry-After`. Map it via a `DomainError` with explicit `status` in `entrypoints/http/errors.py`.
- Apply the same limiter to the MCP `/login` route.

### Part B — password reset

- `POST /auth/password-reset/` (email/username) — always 204, no account enumeration; creates a single-use, expiring (e.g. 30 min) token, stored hashed.
- `POST /auth/password-reset/confirm/` (token + new password) — goes through `SimplePasswordPolicy`, invalidates the token and existing refresh tokens.
- `Mailer` port with an SMTP implementation and a console/in-memory one for dev and tests. Sending happens in the background (FastAPI `BackgroundTasks` is enough at first; a Redis queue such as ARQ is a stretch goal).
- Web: "Nie pamiętasz hasła?" link on `/login`, two new routes for request + confirm. Polish UI strings.
- Alembic migration for the token table; regenerate the client with `just generate-api`; update the API contract snapshot.

## Open questions (resolve before `ready-for-agent`)

- Does `User` have an email address? If not, add one (migration + registration form) or reset by another channel.
- Which SMTP provider on the VPS (own server, Resend, Mailgun, …)? Needs `SMTP_*` settings in `deployment/.env.example`.

## Acceptance criteria

- [ ] 6th failed login within the window returns 429; a successful login is not blocked by earlier successes.
- [ ] Reset request for an unknown user returns the same response as for a known one.
- [ ] Token works once, expires, and is stored hashed.
- [ ] After reset, old refresh tokens no longer work.
- [ ] Tests for handlers, repository, HTTP routes and the frontend flow; `just check` green.

## Learning goals

Ports/adapters with a real external dependency, Redis, single-use token design, background work, brute-force protection.

## Comments

- 2026-10-26 (agent): Part A (rate limiting) built on branch `hardening-02-rate-limit`. Failed logins counted per (client IP, case-folded username), 5 per 15 min; while blocked even the right password gets 429 + `Retry-After`; a success clears the count. Applied to `auth_login`, the MCP `/login` page and the MCP `login_user` tool (not the admin panel). Part B (password reset) deferred until the email/SMTP questions are answered.

- 2026-10-26 (agent): Part A merged into `hardening` with review fixes (attempt counted atomically before the password check; app/mcp ports bound to loopback so `X-Forwarded-For` cannot be spoofed). Status set to `needs-info`: Part B (password reset) waits on the open questions above (email on `User`, SMTP provider). Part A acceptance criterion 1 is met.
