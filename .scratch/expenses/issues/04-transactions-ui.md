Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

Design the transaction UI: a transaction list (grouped by date? sorted?), create/edit/delete flows (modal? inline?), wallet and category pickers, amount/date/description inputs, and mobile behaviour. Work with the human through the grilling skill.

## Answer

- Transaction list grouped by date.
- Create/edit: modal with title, amount, date, description, category, wallet fields.
- Amount: Decimal without currency (single global currency for now).
- Mobile: same responsive list, no separate mobile UI.
- No pagination for now — add later when there is a lot of data.
