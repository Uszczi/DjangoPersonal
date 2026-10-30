# Backend: Category kind, balance rule and System guards

Status: resolved
Blocked by:

Spec: [../spec.md](../spec.md), sections "Domain rules" and "Contract".

## What to build

- **Model and migration:** `Category.kind` (`expense` | `income`, not null, default `expense`) and an Alembic revision via `just makemigrations` that sets `expense` on existing rows. No Transaction data changes, and no Income categories for existing users. `tests/test_migrations.py` must stay green.
- **Seeding:** `seed_base_categories` (`core/expenses/handlers/categories.py`) also seeds the four Income base categories with kind `income`, merging by name as it does today. `entrypoints/seed_dev` may add a salary Income per seeded Wallet so the demo shows both directions.
- **Balance rule** (`infra/repo/wallets.py`, `_BALANCE`): System gives `+amount`, an Income Category gives `+amount`, and anything else (Expense, no Category) gives `−amount`. Update the comment that says "every other entry is spending".
- **Category handlers:** create takes `kind`. Replace and update reject a different `kind` with a `DomainError('The kind of a category cannot be changed.')`.
- **Transaction handlers:** create, replace and update reject a target Category that `is_system` (`Transactions cannot be filed under the System category.`). Replace and update of a Transaction already in System are rejected (`System entries can only be deleted.`). Delete is unchanged. The wallet handlers' own System writes are unaffected (they do not go through these handlers).
- **Contracts:** `kind` on `CategoryRequest` / `PatchedCategoryRequest` / `CategoryResponse` (`null` for System), plus a read-only `kind` on `TransactionResponse`, derived from the Category. Avoid an N+1 on the paged list (load the Category with the page, or derive in the query).
- **Generated artifacts:** `just generate-api` (OpenAPI + TypeScript client), update the contract snapshot (`--snapshot-update`) if any status code changes, and set `CACHE_VERSION` to `"2"` in `packages/shared/src/queries/persist.ts`. Add `kind` to the shared `CategoryInput` type (`packages/shared/src/queries/categories.ts`) only if needed to keep the web and mobile builds compiling. The UI work is in later tickets.

## Acceptance criteria

- [ ] An Income Transaction raises the Wallet balance, and an Expense or uncategorized one lowers it. Existing opening balances and corrections are unchanged.
- [ ] A new user has 10 Expense + 4 Income categories + System. An existing user's categories all read `kind: "expense"` (System `null`).
- [ ] Creating a category without `kind` gives `expense`. Changing the kind via PUT or PATCH is a 400.
- [ ] Filing a Transaction under System (create or move) is a 400. Editing a System entry is a 400. Deleting it works.
- [ ] `TransactionResponse.kind` is correct for Income, Expense, uncategorized and System.
- [ ] Tests in `tests/core/expenses/`, `tests/infra/repo/` and `tests/entrypoints/http/routers/` cover the above. `just check` passes.

## Answer

Done (2026-10-30) on `feat/income` (commit `978abf8`). `Category.kind` (`expense`/`income`, non-null, server default `expense`) with the `0019` migration and a check constraint; the four Income base categories seeded at registration; the balance rule (`System` signed, Income `+`, else `−`); create takes `kind` and PUT/PATCH reject a change; transaction handlers refuse writes into `System` and edits of System entries (delete stays); `kind` on both responses (derived on `Transaction.kind`, `joinedload` on the paged list and on `find`). `just generate-api` + `CACHE_VERSION` 2 + the contract snapshot green. `just check` passes.
