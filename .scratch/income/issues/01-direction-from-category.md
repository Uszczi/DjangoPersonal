# Direction comes from the Category

Status: resolved
Type: grilling

## Question

How is an Income modelled: as a direction on the Transaction, as a separate entity, or through its Category? And is it shown separately from Expenses?

## Answer

Resolved with the user while charting (2026-10-30):

- An Income is a Transaction (it is not a separate entity) and it lives in the same Wallet ledger.
- **Every Category has a kind, Expense or Income.** A Transaction's direction follows from its Category's kind. The Transaction has no direction field of its own.
- Expenses and Incomes are shown together on one list of a Wallet's Transactions.
- The "Wydatki" section and tab keep their name.
- `GLOSSARY.md` was updated (Category kind, Expense, Income, Transaction, Wallet balance).
