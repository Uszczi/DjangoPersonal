# 01: Wallets — CRUD + list

**What to build:** The user can create, browse, rename, and delete named Wallets from the "Wydatki" tab. Deleting a wallet also deletes its transactions (cascade). The wallet list shows each wallet's name and transaction count. A header select switches the active wallet.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A "Wydatki" tab in the navbar opens the wallet list
- [ ] The user can create a wallet with a required name (modal)
- [ ] The user can rename a wallet inline or via modal
- [ ] The user can delete a wallet after confirming (cascade warning)
- [ ] The list shows each wallet's name and transaction count
- [ ] A header select switches the active wallet
- [ ] Wallet names are trimmed and unique case-insensitively per user
- [ ] Backend API endpoints under `/api/v1/wallets/` with full CRUD
- [ ] TypeScript client regenerated from the schema
- [ ] Backend tests cover CRUD, name validation, cascade delete, and per-user isolation
- [ ] Frontend tests cover the wallet list, create modal, rename, delete, and select
