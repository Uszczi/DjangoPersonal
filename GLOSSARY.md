# DjangoPersonal

DjangoPersonal organizes a person's work into projects and the tasks that belong to them, and tracks the expenses a person incurs.

## Language

**Project**:
A named space that groups tasks.

**Task**:
An action item with a title, optional description, and a status drawn from its project's ordered list of statuses. Every task belongs to exactly one project.

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
A named space that holds one freeform drawing — freehand strokes, shapes, and sticky notes. A user may keep several Whiteboards.

**Notatki** (Notes):
A Whiteboard whose content is a Markdown document instead of a drawing. Shares the Whiteboard API and editor; only the payload differs.

**Folder**:
A named group of Whiteboards, Notatki and other Folders (subfolders). Has a required name (trimmed, unique case-insensitively among the Folders that share a parent). Each Whiteboard, Notatka and Folder sits in at most one Folder; one without a Folder stays at the top level of the Notatnik. A Folder can't be moved into itself or one of its subfolders. Deleting a Folder cascades to its subfolders and every Whiteboard and Notatka in them.
_Avoid_: Directory, Katalog, Group, Grupa, Tag

**Notatnik**:
The section of the app that holds a user's Whiteboards, Notatki and Folders.
_Avoid_: Notatki (for the section — Notatki are the Markdown documents in it)

**Wallet**:
A named purse a user creates to separate money by purpose. Has a required name (trimmed, unique case-insensitively per user) and owns its Transactions. There is no default wallet — the user creates the first one. A Wallet's balance is the sum of its ledger: the opening balance it was created with, plus later corrections, minus its spending. The balance is never stored; it is computed from the Transactions.

**Transaction**:
A record of money spent. Has a required title, a required positive Decimal amount (at most two decimal places), a required date, an optional description, an optional Category, and a required Wallet. Deleting a Wallet cascades to its Transactions. Transactions the system writes against the System category — the opening balance and later balance corrections — may carry a negative amount, since they add to the balance rather than spend from it.

**Category**:
A per-user label for classifying Transactions. Has a required name (trimmed, unique case-insensitively per user). The system seeds ten base categories plus the System category when the user registers. Deleting a Category cascades to its Transactions.

**System category**:
The reserved Category (`is_system`) that holds a Wallet's balance ledger — the opening balance on creation and the difference recorded whenever the current balance is set. It is seeded with the base categories, cannot be renamed or deleted, and the interface keeps it out of the category list.


**Counter** (Licznik):
A named tally a user keeps of anything countable — coffees, push-ups, days without sugar. Has a required name (trimmed) and owns its Counter entries. A Counter's total is the sum of its entries' values; like a Wallet balance it is never stored, only computed. Deleting a Counter cascades to its entries.

**Counter entry**:
One change to a Counter: a non-zero whole-number value (default 1; negative values subtract), the moment it happened (date and time, stored in UTC), and an optional note. An entry stays in the Counter it was added to.
