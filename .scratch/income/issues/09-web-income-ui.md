# Web: Incomes on the list, form and category panel

Status: ready-for-agent
Blocked by: 07

Spec: [../spec.md](../spec.md), section "UI". Reference: branch `prototype/income-ui`, commit `c2dfaac` (variant A). Rewrite it properly; do not copy the prototype scaffolding (`fakeKind`, variant switcher).

## What to build

- **Colour tokens** for Income and Expense in every palette in `packages/shared/src/themes.ts` and in the `@theme` block of `frontend/src/index.css`.
- **`WalletView.tsx`:** amounts are `+x` green for Income and `−x` red for Expense, using `transaction.kind`. A System entry (`kind === null`) is muted, keeps its own sign and has the subtitle "Wpis systemowy".
- **`TransactionEditorModal.tsx`:** the category `<Select>` is grouped with `<optgroup>` Wydatki / Przychody, and "Bez kategorii (wydatek)" comes first. System is never offered. Kicker, title and submit label follow the selected category's kind. A System entry opens read-only with the note from the spec and only Usuń / Zamknij.
- **`CategoryPanel.tsx`:** two sections, Wydatki and Przychody, each with its own create form that sends `kind`. The shared `useCreateCategory` / `CategoryInput` carry `kind`.

## Acceptance criteria

- [ ] Tests in `frontend/tests/components/WalletView.test.tsx`, `CategoryPanel.test.tsx` and the transaction editor's tests cover: the sign and colour per kind, the grouped picker, the read-only System entry, and creating an Income category.
- [ ] `tests/theme.test.ts` passes with the new tokens.
- [ ] `just check` passes.
