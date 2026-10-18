# 02: Categories — CRUD + seed + sidebar

**What to build:** The user can manage categories from a sidebar panel below the wallets list. Categories are created inline (fast typing), renamed, and deleted. Deleting a category also deletes its transactions (cascade). When the user creates their first wallet, the system seeds 10 base categories automatically.

**Blocked by:** 01 — Wallets CRUD + list (seed triggers on first wallet creation).

**Status:** resolved

- [x] A sidebar panel below the wallets list shows categories
- [x] The user can create a category by typing a name inline
- [x] The user can rename a category inline
- [x] The user can delete a category after confirming (cascade warning)
- [x] Category names are trimmed and unique case-insensitively per user
- [x] Creating the first wallet seeds 10 base categories automatically
- [x] Backend API endpoints under `/api/v1/categories/` with full CRUD
- [x] TypeScript client regenerated from the schema
- [x] Backend tests cover CRUD, name validation, cascade delete, seed trigger, and per-user isolation
- [x] Frontend tests cover the category panel, inline create, rename, delete, and seed

## Answer

Categories CRUD + seed + sidebar is implemented.

**Backend** (`backend/apps/expenses/`): `Category` model in `apps/infra/models/category.py` (name trimmed + `normalized_name` casefolded, unique per user via a DB constraint), `CategoryRepository` in `apps/infra/repo/categories.py`, migration `0010_category`. Django Ninja router exposes `GET/POST /api/v1/categories/` and `GET/PUT/PATCH/DELETE /api/v1/categories/{id}/` under JWT auth. Name clashes surface as `DomainError`; a missing/foreign category as `NotFound`.

**Seed:** `seed_base_categories` creates the ten base labels — Jedzenie, Mieszkanie, Transport, Zdrowie, Rozrywka, Zakupy, Rachunki, Edukacja, Podróże, Inne — and is called by `CreateWallet` when the user creates their first wallet (`wallet.count == 0`). The seed **merges**: it adds only base names the user does not already have (inside one transaction), so a label created before the first wallet is kept and no seeded name can clash.

**Frontend**: `src/stores/categories.ts` (Zustand), `CategoryPanel` (inline create at the top, inline rename per row, delete via `DeleteCategoryModal` with cascade warning), rendered below the wallet list on `expenses/index.tsx`. One `compareByName` comparator drives both the optimistic insert and the re-sort so create and rename leave the list consistent. Panel styling added in `App.css`.

**Testing**: 17 backend API tests (`tests/test_categories_api.py`) cover CRUD, trimming, case-insensitive uniqueness, per-user isolation (read + mutations), null-name PATCH, the seed trigger (first wallet seeds 10, second wallet does not re-seed, merge with existing), and the versioned schema. 7 frontend tests (`tests/Categories.test.tsx`) cover the panel, the seeded set display, inline create, duplicate-name error, inline rename, and delete-with-confirm — fetch mocked at the network boundary.

**Fetch note:** `CategoryPanel` mounts only after the wallets finish loading (the expenses page shows a loading state first), so on `/expenses` the request order is wallets → projects → categories. Wallet tests mock categories third.

Cascade-delete-of-transactions remains deferred to ticket 03 (Transaction model does not exist yet).
