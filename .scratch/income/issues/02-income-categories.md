# Income categories

Status: resolved
Type: grilling
Blocked by:

## Question

How do Income categories come to exist, and how do they behave?

- Which base Income categories, if any, are seeded at registration (e.g. Wynagrodzenie, Inne przychody)? Do existing accounts get them too?
- Do all existing Categories become Expense categories?
- Can a Category's kind change after Transactions are filed under it? If so, they all silently flip direction and the balance changes.
- Is a name unique per user across both kinds, or within one kind? (Today it is unique per user.)
- How does the category panel present the two kinds: grouped, filtered, or marked?

## Answer

Resolved with the user (2026-10-30):

- **Existing Categories:** every current Category (base and user-made) becomes an Expense category. The System category is decided in the balance-rule ticket.
- **Base Income categories**, seeded at registration next to the ten Expense ones: **Wynagrodzenie**, **Sprzedaż**, **Prezenty**, **Inne przychody** (icons picked from lucide, e.g. `banknote`, `store`, `gift`, `circle-plus`). "Inne przychody" because "Inne" is taken by an Expense category.
- **Existing accounts get no Income categories from a migration.** The user adds them by hand. The migration only gives existing Categories the Expense kind.
- **Names stay unique per user across both kinds**, as today, so one list never shows two categories with the same name.
- **The kind is fixed at creation and never changes.** The user saw no need to change it. So no Transaction ever changes direction behind the balance's back.
- **Default kind is Expense** when a Category is created without one (old clients, MCP).
- The question of how the category panel presents the two kinds belongs to the form and list prototype ticket.
- `GLOSSARY.md` updated (Category: kind fixed at creation, seeded base categories).
