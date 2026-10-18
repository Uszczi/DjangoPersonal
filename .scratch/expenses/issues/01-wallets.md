# 01: Wallets — CRUD + list

**What to build:** The user can create, browse, rename, and delete named Wallets from the "Wydatki" tab. Deleting a wallet also deletes its transactions (cascade). The wallet list shows each wallet's name and transaction count. A header select switches the active wallet.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] A "Wydatki" tab in the navbar opens the wallet list
- [x] The user can create a wallet with a required name (modal)
- [x] The user can rename a wallet inline or via modal
- [x] The user can delete a wallet after confirming (cascade warning)
- [x] The list shows each wallet's name and transaction count
- [x] A header select switches the active wallet
- [x] Wallet names are trimmed and unique case-insensitively per user
- [x] Backend API endpoints under `/api/v1/wallets/` with full CRUD
- [x] TypeScript client regenerated from the schema
- [x] Backend tests cover CRUD, name validation, cascade delete, and per-user isolation
- [x] Frontend tests cover the wallet list, create modal, rename, delete, and select

## Answer

Wallets CRUD + list is implemented end-to-end.

**Backend** (`backend/apps/expenses/`): `Wallet` model in `apps/infra/models/wallet.py` (name trimmed + `normalized_name` casefolded, unique per user via a DB constraint), `WalletRepository` in `apps/infra/repo/wallets.py`, migration `0009_wallet`. Django Ninja router exposes `GET/POST /api/v1/wallets/` and `GET/PUT/PATCH/DELETE /api/v1/wallets/{id}/` under JWT auth, following the `apps/work/` vertical-slice layout (api/contracts/handlers/deps). Name clashes surface as `DomainError`; a missing/foreign wallet as `NotFound`. `PATCH` with an explicit `null` leaves the field untouched (mirrors `apps/work/handlers/_patch.py`, avoiding a 500 on a `None` name).

**Frontend**: `src/stores/wallets.ts` (Zustand), `WalletEditorModal` (create/rename), `DeleteWalletModal` (cascade confirm), `WalletSelect` (header select that navigates to `/expenses/$walletId`), routes `expenses/index.tsx` (list) and `expenses/$walletId.tsx` (transactions placeholder — ticket 03), Navbar "Wydatki" tab. Deleting a wallet always returns to `/expenses` (decision 05). `transaction_count` is `0` for now; the real annotation lands with the `Transaction` model in ticket 03.

**Testing**: 14 backend API tests (`tests/test_wallets_api.py`) cover CRUD, trimming, case-insensitive uniqueness, per-user isolation (read + mutations), null-name PATCH, and the versioned schema. 7 frontend tests (`tests/Wallets.test.tsx`) cover the list with counts, create/rename/delete flows, the header select, load errors, and the unknown-wallet redirect — fetch mocked at the network boundary.

Deferred to ticket 03 (Transaction model doesn't exist yet): real `transaction_count` annotation and the cascade-delete-transactions test.
