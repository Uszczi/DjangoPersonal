# DjangoPersonal

DjangoPersonal organizes a person's work into projects and the tasks that belong to them, and tracks the expenses a person incurs.

## Language

**Project**:
A named space that groups tasks.

**Task**:
An action item with a title, optional description, and a status drawn from its project's ordered list of statuses. Every task belongs to exactly one project.

**Comment** (Komentarz):
A note left on a Task: optional text plus any number of Attachments. A Task's comments read oldest first, like a conversation. Deleting a Task deletes its comments.

**Attachment** (Załącznik):
A file attached to a Comment, kept byte for byte as uploaded (original name, type and size). Pictures (JPEG, PNG, GIF, WebP — recognised from the file's bytes) are shown in place; any other file is only downloaded. At most 25 MB each. Deleting a Comment deletes its Attachments.
_Avoid_: Image (it may be any file), Upload

**Project status**:
A named state a Task can be in, defined per Project as an ordered list. The list order is the order statuses and their tasks are displayed in. One status in the list is the Project's terminal status — its "done" status.

**Inbox**:
The permanent, non-renamable default project. Tasks created without an explicitly selected project, and tasks from a deleted project, are assigned to the Inbox.

**Time entry**:
A record of time spent on a Task. Has a start timestamp and an end timestamp; the time between them is the entry's duration. Created by stopping a timer or by manual logging.

**Running timer**:
The single Time entry that has a start but no end. At most one running timer exists at a time; starting a timer on another task ends the previous entry.

**Timer limit**:
An optional length chosen when starting a timer (stored as the entry's planned end). When it passes, the timer stops by itself and the Time entry ends exactly at the planned end, even if nobody is watching.

**Whiteboard**:
A named space that holds one freeform drawing — freehand strokes, shapes, and sticky notes. A user may keep several Whiteboards. Its name is trimmed and unique (case matters: "Plan" and "plan" are different names) among the Whiteboards and Notatki in the same Folder (or at the top level); a new one without a name becomes "Bez tytułu", numbered ("Bez tytułu 2", …) when that is taken.

**Notatki** (Notes):
A Whiteboard whose content is a Markdown document instead of a drawing. Shares the Whiteboard API and editor; only the payload differs.

**Chunk**:
A piece of a Notatka small enough to be compared with a question: the text under one heading (or a part of it, when the section is long), titled with the Notatka's name and the path of headings above it. Answers to questions about Notatki are drawn only from Chunks. A Notatka's Chunks are rebuilt from its current content before a question is answered.
_Avoid_: Fragment, Segment, Passage

**Folder**:
A named group of Whiteboards, Notatki and other Folders (subfolders). Has a required name: trimmed, with no spaces and no "/", and unique among the Folders that share a parent (case matters, so "Praca" and "praca" are different names). Each Whiteboard, Notatka and Folder sits in at most one Folder; one without a Folder stays at the top level of the Notatnik. A Folder can't be moved into itself or one of its subfolders. Deleting a Folder cascades to its subfolders and every Whiteboard and Notatka in them.
_Avoid_: Directory, Katalog, Group, Grupa, Tag

**Notatnik**:
The section of the app that holds a user's Whiteboards, Notatki and Folders.
_Avoid_: Notatki (for the section — Notatki are the Markdown documents in it)

**Wallet**:
A named purse a user creates to separate money by purpose. Has a required name (trimmed, unique case-insensitively per user) and owns its Transactions. There is no default wallet — the user creates the first one. A Wallet's balance is the sum of its ledger: the opening balance it was created with, plus later corrections and its Incomes, minus its Expenses. The balance is never stored; it is computed from the Transactions.

**Transaction**:
A record of money moving through a Wallet: an Expense or an Income, as the kind of its Category decides; one without a Category is an Expense. Has a required title, a required positive Decimal amount (at most two decimal places), a required date, an optional description, an optional Category, and a required Wallet. Deleting a Wallet cascades to its Transactions. Transactions the system writes against the System category — the opening balance and later balance corrections — may carry a negative amount, since they add to the balance rather than spend from it.

**Category**:
A per-user label for classifying Transactions. Has a required name (trimmed, unique case-insensitively per user) and a kind, Expense or Income, which decides the direction of every Transaction filed under it. The kind is chosen when the Category is created (Expense unless stated) and never changes. The system seeds ten base Expense categories, four base Income categories and the System category when the user registers. Deleting a Category cascades to its Transactions.

**Expense** (Wydatek):
A Transaction filed under an Expense Category: money that leaves its Wallet and lowers the balance.
_Avoid_: Cost, Koszt

**Income** (Przychód):
A Transaction filed under an Income Category: money that comes into its Wallet and raises the balance.
_Avoid_: Revenue, Wpływ, Deposit

**System category**:
The reserved Category (`is_system`) that holds a Wallet's balance ledger — the opening balance on creation and the difference recorded whenever the current balance is set. It has no kind: its entries carry their own sign. Only the system files Transactions under it; the user can delete such an entry but not edit it, nor file their own Transactions there. It is seeded with the base categories, cannot be renamed or deleted, and the interface keeps it out of the category list.


**Counter** (Licznik):
A named tally a user keeps of anything countable — coffees, push-ups, days without sugar. Has a required name (trimmed), a colour (`#RRGGBB`, default teal, shown with it in the lists) and owns its Counter entries. A Counter's total is the sum of its entries' values; like a Wallet balance it is never stored, only computed. Deleting a Counter cascades to its entries.

**Counter entry**:
One change to a Counter: a non-zero whole-number value (default 1; negative values subtract), the moment it happened (date and time, stored in UTC), and an optional note. An entry stays in the Counter it was added to.

**Bibliografia**:
The section of the app where a user keeps track of the films they watch and the books they read, as Pozycje.
_Avoid_: Bibliografia for a single film or book (that is a Pozycja)

**Pozycja** (Item):
One film or one book a user tracks in the Bibliografia. Has a kind (film or book) and a title; optionally a creator (author or director, as written), a year, a length (pages for a book, minutes for a film) and one note. Films and books are the same concept, differing only in kind. Watching or reading it again is a new Podejście on the same Pozycja, never a new Pozycja.
_Avoid_: Entry, Wpis (a Counter entry is something else), Bibliografia

**Podejście** (Attempt):
One time a user watches or reads a Pozycja: in progress, finished or abandoned, with its dates (day precision, no time of day). A Pozycja has any number of Podejścia but at most one in progress; returning to a finished or abandoned Pozycja starts a new Podejście.
_Avoid_: Seans, Lektura (one word per kind), Wpis (that is a Counter entry)

**Pozycja status**:
Where a Pozycja stands for its user: to watch/read (Do obejrzenia / Do przeczytania), in progress (W trakcie), finished (Ukończone), or abandoned (Porzucone). Never set directly: it follows from the Pozycja's latest Podejście (none yet means to watch/read), like a Wallet balance follows from its Transactions.
