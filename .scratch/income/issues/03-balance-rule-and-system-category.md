# Balance rule, uncategorized Transactions and the System category

Status: resolved
Type: grilling
Blocked by:

## Question

With direction coming from the Category, what is the balance rule in full?

- The Category is optional today. Is an uncategorized Transaction an Expense, or does a Category become required?
- The System category has no kind and stores money coming in as negative amounts. Does it stay a special case (signed amounts), get split into an Income and an Expense System category, or does something else happen?
- Does every amount the user enters stay positive, with the sign coming only from the kind?
- How do the existing rows (System entries, uncategorized Transactions) carry over?

## Answer

Resolved with the user (2026-10-30):

- **Balance rule:** System entry → `+amount` (signed, as stored); Income → `+amount`; Expense or no Category → `−amount`.
- **The Category stays optional.** A Transaction without one is an Expense, as today. Nothing to migrate.
- **The System category stays the single exception:** it has no kind and keeps signed amounts. It is not split into two categories, so the ledger needs no data migration.
- **Every amount the user enters stays positive.** The sign comes only from the Category's kind.
- **Only the system writes into System.** The handlers reject a user's create or edit that would put a Transaction in the System category. This covers the API and MCP, which today the UI filter alone guards.
- **Existing System entries can only be deleted.** Any edit is rejected, and the balance is corrected through "set current balance", which adds a new correction. (Today the editor reopens them, and a negative correction cannot even be re-saved.)
- **Any user-made Transactions already in System stay as they are** and keep counting `+amount`. No migration.
- Consequence for the map: the only migration is giving existing Categories the Expense kind (see the Income categories ticket). The ledger data stays untouched.
- `GLOSSARY.md` updated (Transaction without a Category; System category rules).
