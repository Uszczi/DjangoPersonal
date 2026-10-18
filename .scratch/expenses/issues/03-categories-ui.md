Type: grilling
Status: resolved
Blocked by: none

## Question

Design the category UI: a category manager (list, create, rename, delete), the 10 seed categories created with the first wallet, and how categories appear when creating/editing a transaction (dropdown? inline add?). Work with the human through the grilling skill.

## Answer

- Category list lives in a sidebar panel below the wallets list.
- Create category: inline input at the top of the list.
- Name validation: trim + case-insensitive uniqueness (like Project).
- 10 seed categories: Jedzenie, Mieszkanie, Transport, Zdrowie, Rozrywka, Zakupy, Rachunki, Edukacja, Podróże, Inne.
- Delete category: **cascade** — its transactions are deleted too (confirmed change from the charting decision that left them uncategorized).
