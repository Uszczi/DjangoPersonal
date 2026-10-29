# Mobile: Incomes on the list, form and categories

Status: ready-for-agent
Blocked by: 07, 09

Spec: [../spec.md](../spec.md), section "UI" (the mobile bullet).

## What to build

- **`mobile/app/(tabs)/expenses.tsx`:** amounts are `+x` / `−x` in the Income / Expense colours (the tokens from ticket 09, via `useTheme()` / `makeStyles`). A System entry is muted, keeps its sign and is labelled "Wpis systemowy".
- **`mobile/app/transaction.tsx`:** category choices are grouped under "Wydatki" / "Przychody" headers, with "Bez kategorii" among the Expenses, and System is never offered. The title and save button follow the kind. A System entry opens read-only with the spec's note and only a delete action.
- **`mobile/app/categories.tsx` + `category.tsx`:** two sections, Wydatki and Przychody, each with an add action that opens the editor for that kind (e.g. a `kind` route param). The editor shows the kind without letting it change.

## Acceptance criteria

- [ ] `npm run typecheck` and `npm run export` in `mobile/` pass, as does `just check`.
- [ ] Manually on a phone (`just backend-lan`, `just mobile`; open ports 8081/8000 in ufw first): add an Income and see the balance rise; a System entry can only be deleted.
