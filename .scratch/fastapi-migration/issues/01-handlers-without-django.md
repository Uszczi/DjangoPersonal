# 01: Handlers without Django imports

**What to build:** The `handlers/` layer of every app stops importing `django.*` and `ninja_jwt`. API behavior is unchanged and the app still runs on Django. This step is worth doing regardless of the migration (a cleaner boundary), so it ships to production as a normal refactor.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] Handlers return `list[...]`/`Sequence[...]` instead of `QuerySet` (repositories materialize results).
- [x] `transaction.atomic()` leaves the handlers — the repository offers an atomic operation or an `infra` `unit_of_work()` context manager.
- [x] `AbstractUser` in handler signatures is replaced by the `User` type from `apps.infra.models`.
- [x] Accounts: password hashing/verification, password validation, and token issuing/refreshing sit behind ports (`PasswordHasher`, `PasswordPolicy`, `TokenService`) in `apps/accounts/`; the Django/ninja_jwt implementations are injected in `deps.py`.
- [x] `apps/work/clock.py` without `django.utils.timezone` (`datetime.now(UTC)`).
- [x] `grep -rn "django\|ninja" backend/apps/*/handlers` returns nothing.
- [x] `just check` green (152 backend tests).

## Comments

**2026-10-23 (agent):** Implemented, awaiting review/commit.

- Repositories materialize lists (`list_all`, `list_for_*` → `list[...]`; `TimeEntryRepository.list` → `Sequence[...]`).
- `apps.infra.repo.unit_of_work()` replaces `transaction.atomic()` in handlers (register, `seed_base_categories`).
- `ProjectRepository.delete` raises the new `ProjectHasTimeEntries` instead of leaking `ProtectedError`.
- Accounts: ports in `apps/accounts/ports.py`, Django/ninja_jwt adapters in `apps/accounts/adapters.py`, injected via `deps.py`. `UserRepository.create` takes `password_hash`. `LoginUser` replicates `ModelBackend` (is_active check, dummy hash for unknown usernames, rehash of outdated hashes).
- `clock.now()` = `datetime.now(UTC)`.
- `just check`: mypy clean, 152 backend tests pass, `manage.py check` clean; frontend has the 4 known jsdom failures (gate stops there, so lint/build did not run — no frontend changes).
