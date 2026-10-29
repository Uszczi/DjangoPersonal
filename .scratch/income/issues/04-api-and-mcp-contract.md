# API and MCP contract

Status: resolved
Type: grilling
Blocked by: 02, 03

## Question

What changes on the wire?

- The Category request and response: the name of the kind field, its values, and how PUT/PATCH reject an attempt to change it (the kind is fixed at creation, Expense by default; see the Income categories ticket).
- Does the Transaction response carry its derived direction, so clients need not join to the Category?
- Can a Wallet's Transaction list be filtered by direction?
- Which MCP tool parameters and outputs change (`create_category`, `update_category`, `list_categories`, the transaction tools)?
- How the rejections from the balance-rule ticket surface: a create or edit into the System category, and an edit of a System entry (error message and status; DELETE stays allowed).
- Does a persisted query-cache shape change, so that `CACHE_VERSION` needs a bump?

## Answer

Resolved with the user (2026-10-30):

- **Category `kind`:** `"expense" | "income"`. It is optional in `CategoryRequest` (default `"expense"`) and always present in `CategoryResponse`, where the System category has `null`.
- **Changing the kind:** PUT and PATCH accept `kind`. The same value passes, and a different one is a 400 `The kind of a category cannot be changed.` This guards against PUT's default silently turning an Income category into an Expense one.
- **`TransactionResponse.kind`:** read-only, `"expense" | "income" | null`, derived from the Category. No Category gives `"expense"`. System gives `null`, and its signed amount tells the direction.
- **No `kind` filter** on `GET /transactions/`. It can be added later without breaking the contract.
- **MCP:** `create_category` gains `kind: "expense" | "income" = "expense"`, while `update_category` gains no `kind`. Category and transaction outputs carry `kind`. `create_transaction` gains no parameter, and its docstring becomes "Record an expense or an income; the direction follows from the category's kind".
- **System rejections (400, `DomainError`):** creating or moving a Transaction into System gives `Transactions cannot be filed under the System category.` Any PUT/PATCH of a System entry gives `System entries can only be deleted.` DELETE is unchanged.
- **`CACHE_VERSION` bumped to `"2"`** (`packages/shared/src/queries/persist.ts`). This is the TanStack Query cache both apps persist for 24 h: `localStorage` on the web, AsyncStorage on mobile. It is used as the `buster`, so an older saved copy (categories without `kind`) is discarded instead of being painted until the refetch lands.
