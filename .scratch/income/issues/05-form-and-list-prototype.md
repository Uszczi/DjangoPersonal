# Form and list prototype

Status: resolved
Type: prototype
Blocked by: 02

Note: the clients get the direction from `TransactionResponse.kind` (`expense`/`income`/`null` for System); see the API and MCP contract ticket.

## Question

How do Incomes look and feel on the web and on mobile?

- In the Transaction form, the Category picker decides the direction. How does the user see which kind they are choosing (grouped picker, a filter toggle first, colour)?
- How does an Income stand out on the shared Wallet list (sign, colour), and how does an Expense look next to it?
- How does a System entry (Stan początkowy, Korekta stanu) look on the list and in the editor, now that it can only be deleted? It can be shown read-only with just "Usuń", or not opened at all.
- In the category panel, how is a Category's kind set when it is created and how is it shown?

## Answer

Resolved with the user (2026-10-30). **Variant A ("Znak i grupy"), with red/green colouring.**

- **Wallet list:** an Income shows `+500.00` in green and an Expense `−42.00` in red. One list, as decided. A System entry shows its own sign (`+`/`−` from the stored amount), muted grey, with a "Wpis systemowy" subtitle.
- **Transaction form:** one "+ Nowa transakcja" button and one form. The category picker groups the categories under **Wydatki** and **Przychody**, and "Bez kategorii (wydatek)" comes first. The direction follows the chosen category. The heading and the submit button follow the kind ("Nowy przychód" / "Dodaj przychód", "Nowy wydatek" / "Dodaj wydatek"). An edit says "Edytuj przychód" / "Edytuj wydatek".
- **System entry:** clicking it opens the editor read-only, with the note "Ten wpis zapisał system (stan początkowy lub korekta stanu). Nie można go edytować, tylko usunąć. Saldo poprawisz w ustawieniach portfela." The only actions are **Usuń** and **Zamknij**.
- **Category panel:** two sections, **Wydatki** and **Przychody**, each with its own create form. The section sets the new category's kind, so there is no kind control.
- **Colours:** the real version adds semantic tokens for the two directions (in `packages/shared/src/themes.ts` for every theme, and in the `@theme` block of `frontend/src/index.css`) instead of the prototype's Tailwind emerald and `text-danger-ink`.
- **Mobile** follows the same choices. React Native has no `<optgroup>`, so the category chips/list are grouped under "Wydatki" and "Przychody" headers.
- Rejected: B (a kind switch in the form, arrow pills, tabs) and C (two add buttons, a stripe, kind chips).

Prototype (primary source, never merged): branch `prototype/income-ui`, commit `c2dfaac` (`frontend/src/prototype/income/`, plus edits to `WalletView`, `TransactionEditorModal` and `CategoryPanel`).
