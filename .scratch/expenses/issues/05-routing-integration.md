Type: grilling
Status: claimed
Blocked by: none

## Question

How should the expenses route integrate with the existing client-side routing (ADR-0001): URL shape (`/expenses`, `/expenses/$walletId`?), deep-linking, browser back/forward behaviour, and whether the selected wallet appears in the URL (like the selected Project search param). Work with the human through the grilling skill.

## Answer

- URL shape: `/expenses/$walletId` (wallet is part of the main path, like `/whiteboard/$boardId`).
- Deleted wallet in URL → redirect to `/expenses` (list).
- Only the wallet is in the URL; category is internal view state.
- Browser back/forward works when switching wallets (ADR-0001 pattern).
