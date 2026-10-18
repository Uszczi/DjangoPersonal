# 02: Categories — CRUD + seed + sidebar

**What to build:** The user can manage categories from a sidebar panel below the wallets list. Categories are created inline (fast typing), renamed, and deleted. Deleting a category also deletes its transactions (cascade). When the user creates their first wallet, the system seeds 10 base categories automatically.

**Blocked by:** 01 — Wallets CRUD + list (seed triggers on first wallet creation).

**Status:** ready-for-agent

- [ ] A sidebar panel below the wallets list shows categories
- [ ] The user can create a category by typing a name inline
- [ ] The user can rename a category inline
- [ ] The user can delete a category after confirming (cascade warning)
- [ ] Category names are trimmed and unique case-insensitively per user
- [ ] Creating the first wallet seeds 10 base categories automatically
- [ ] Backend API endpoints under `/api/v1/categories/` with full CRUD
- [ ] TypeScript client regenerated from the schema
- [ ] Backend tests cover CRUD, name validation, cascade delete, seed trigger, and per-user isolation
- [ ] Frontend tests cover the category panel, inline create, rename, delete, and seed
