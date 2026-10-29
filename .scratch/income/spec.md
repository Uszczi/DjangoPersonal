# Spec: Income in expenses

Status: ready-for-agent

The decisions behind this spec are on the [map](map.md); each section links the ticket that holds the detail. Domain terms (Transaction, Category, Expense, Income, System category, Wallet balance) are defined in `GLOSSARY.md`, already updated for this change.

## Problem

Every Transaction is spending: its positive amount is subtracted from the Wallet balance. Money can only come in through the hidden System category (the opening balance and "Korekta stanu"). The user cannot record a salary, a sale or a gift.

## Solution in one paragraph

Every Category gets a **kind**, Expense or Income, and a Transaction's direction follows from its Category. Incomes and Expenses share one Wallet list. The "Wydatki" section keeps its name. The balance becomes Income − Expense, plus the System entries with their own sign. The user enters only positive amounts.

## Domain rules

From [Direction comes from the Category](issues/01-direction-from-category.md), [Income categories](issues/02-income-categories.md) and [Balance rule and the System category](issues/03-balance-rule-and-system-category.md):

1. **Category kind:** `expense` or `income`. It is chosen at creation, defaults to `expense`, and never changes. The System category has no kind.
2. **Transaction direction:** Expense when its Category is an Expense one or it has no Category. Income when its Category is an Income one. A System entry carries its own sign.
3. **Balance:** `Σ(System amount, signed) + Σ(Income amount) − Σ(Expense amount, incl. uncategorized)`.
4. **Amounts the user enters are positive**, as today.
5. **System is written only by the system** (the opening balance and balance corrections). The handlers reject a user's create or update that puts a Transaction in System, and any update of an existing System entry. Delete stays allowed.
6. **Names stay unique per user across both kinds**, as today.
7. **Seeding:** registration seeds the ten Expense base categories plus four Income ones: Wynagrodzenie (`banknote`), Sprzedaż (`store`), Prezenty (`gift`), Inne przychody (`circle-plus`). The implementer may pick other lucide icons from `CATEGORY_ICON_SUGGESTIONS` or the icon set if these do not exist.
8. **Existing data:** the migration gives every existing Category the `expense` kind (System included in the column, but the System's kind is ignored and read as none). It seeds **no** Income categories for existing users, who add them by hand. Transactions are not touched. User-made Transactions already in System stay and keep counting as `+amount`.

## Contract

From [API and MCP contract](issues/04-api-and-mcp-contract.md):

- `CategoryRequest.kind: "expense" | "income"`, optional, default `"expense"`. `PatchedCategoryRequest.kind` is optional. On PUT/PATCH, a `kind` equal to the current one passes, and a different one is a 400 `The kind of a category cannot be changed.`
- `CategoryResponse.kind: "expense" | "income" | null` (`null` for System).
- `TransactionResponse.kind: "expense" | "income" | null`, read-only and derived (no Category gives `expense`, System gives `null`).
- New 400s: `Transactions cannot be filed under the System category.` (create, or update moving into System), and `System entries can only be deleted.` (PUT/PATCH of a System entry).
- No `kind` filter on `GET /transactions/`.
- MCP: `create_category(kind="expense"|"income", default "expense")`. `update_category` gets no kind. Category and transaction outputs carry `kind`. The `create_transaction` docstring reads "Record an expense or an income; the direction follows from the category's kind."
- `CACHE_VERSION` in `packages/shared/src/queries/persist.ts` goes from `"1"` to `"2"`.

## UI

From [Form and list prototype](issues/05-form-and-list-prototype.md) (variant A, red/green; prototype on branch `prototype/income-ui`, commit `c2dfaac`, for reference only, never merge):

- **Wallet list:** Income `+500.00` in green, Expense `−42.00` in red. A System entry is muted, shows its own sign and has the subtitle "Wpis systemowy".
- **Transaction form:** one "+ Nowa transakcja" entry point. The category picker is grouped **Wydatki** / **Przychody**, with "Bez kategorii (wydatek)" first, and the System category is never offered. Kicker, title and submit button follow the selected category's kind ("NOWY PRZYCHÓD" / "Nowy przychód" / "Dodaj przychód", "Edytuj przychód", and the same for wydatek).
- **System entry:** opens read-only with the note "Ten wpis zapisał system (stan początkowy lub korekta stanu). Nie można go edytować, tylko usunąć. Saldo poprawisz w ustawieniach portfela." The only actions are **Usuń** and **Zamknij**.
- **Category panel:** two sections, **Wydatki** and **Przychody**, each with its own create form. The section decides the kind.
- **Colours:** new semantic tokens for the two directions (e.g. `income` / `expense`) in every palette in `packages/shared/src/themes.ts` and in the `@theme` block of `frontend/src/index.css` (`tests/theme.test.ts` keeps them in step). No hard-coded hex values or Tailwind palette colours.
- **Mobile:** the same rules. Category choices are grouped under "Wydatki" / "Przychody" headers, since React Native has no `<optgroup>`. The categories screen has two sections, each with its own add action that opens the category editor for that kind.

## Out of scope

Transfers between Wallets. Summaries or statistics. A `kind` filter on the transaction list. Seeding Income categories for existing accounts. Renaming "Wydatki".

## Implementation tickets

In order. Each leaves `just check` green.

1. [Backend: Category kind, balance rule and System guards](issues/07-backend-category-kind.md)
2. [MCP tools: category kind](issues/08-mcp-category-kind.md): blocked by 1
3. [Web: Incomes on the list, form and category panel](issues/09-web-income-ui.md): blocked by 1
4. [Mobile: Incomes on the list, form and categories](issues/10-mobile-income-ui.md): blocked by 1 and 3 (it reuses the colour tokens 3 adds to `themes.ts`)
