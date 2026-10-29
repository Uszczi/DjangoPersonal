# Income in expenses (map)

Labels: wayfinder:map

## Destination

A spec (`.scratch/income/spec.md`) with implementation tickets, ready to hand to an agent: a user can record an Income in a Wallet, and the balance counts it, in the API, the web app, the mobile app and the MCP tools.

## Notes

- Domain: expenses (`backend/personal/core/expenses/`, `infra/repo/wallets.py` for the balance rule, `frontend/src/components/{ExpensesPage,WalletView,CategoryPanel}.tsx`, `mobile/app/(tabs)/expenses.tsx`, `entrypoints/mcp/tools/expenses.py`). Terms come from `GLOSSARY.md` (Transaction, Category, Expense, Income, System category).
- For grilling tickets, load the `grilling` and `domain-modeling` skills.
- Code identifiers in English (Expense/Income); UI strings in Polish (Wydatek/Przychód).
- Starting point: today every Transaction is spending (positive amount, subtracted). Money only comes in through the hidden System category (the opening balance and "Korekta stanu"), stored as negative amounts.

## Decisions so far

- [Direction comes from the Category](issues/01-direction-from-category.md): each Category has a kind (Expense/Income) and a Transaction's direction follows from it. Both kinds share one list, and the "Wydatki" tab keeps its name.
- [Income categories](issues/02-income-categories.md): four base Income categories (Wynagrodzenie, Sprzedaż, Prezenty, Inne przychody) are seeded at registration only, and existing accounts add theirs by hand. Existing Categories become Expense ones. The kind defaults to Expense and is fixed at creation. Names stay unique across kinds.
- [Balance rule, uncategorized Transactions and the System category](issues/03-balance-rule-and-system-category.md): Income adds and Expense or no Category subtracts. System stays kind-less with signed amounts. User amounts stay positive. Only the system writes into System, and the user may only delete those entries. No ledger migration.
- [API and MCP contract](issues/04-api-and-mcp-contract.md): `kind` (`expense`/`income`, `null` for System) appears on Category and, read-only, on Transaction. A changed kind or a write into System gives a 400. There is no list filter. `create_category` gets `kind`, and `CACHE_VERSION` goes to 2.
- [Form and list prototype](issues/05-form-and-list-prototype.md): variant A. Income is `+` in green and Expense `−` in red on one list. The form's category picker is grouped Wydatki/Przychody and the direction follows the category. A System entry opens read-only with only Usuń. The category panel has two sections, and mobile follows suit. Prototype on branch `prototype/income-ui`.
- [Write the spec and the implementation tickets](issues/06-write-spec-and-implementation-tickets.md): [spec.md](spec.md) plus four `ready-for-agent` tickets (07 backend, 08 MCP, 09 web, 10 mobile). **Destination reached.**

## Not yet specified

Nothing left: the map is complete.

## Out of scope

- Transfers between Wallets: a separate concept (two linked Transactions), ruled out while charting.
- Summaries and statistics (e.g. income vs spending per month): a separate, later effort, ruled out while charting.
