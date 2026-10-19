# DjangoPersonal

DjangoPersonal organizes a person's work into projects and the tasks that belong to them, and tracks the expenses a person incurs.

## Language

**Project**:
A named space that groups tasks.

**Task**:
An action item with a title, optional description, and an open or completed state. Every task belongs to exactly one project.

**Inbox**:
The permanent, non-renamable default project. Tasks created without an explicitly selected project, and tasks from a deleted project, are assigned to the Inbox.

**Time entry**:
A record of time spent on a Task. Has a start timestamp and an end timestamp; the time between them is the entry's duration. Created by stopping a timer or by manual logging.

**Running timer**:
The single Time entry that has a start but no end. At most one running timer exists at a time; starting a timer on another task ends the previous entry.

**Whiteboard**:
A named space that holds one freeform drawing — freehand strokes, shapes, and sticky notes. A user may keep several Whiteboards.

**Notatki** (Notes):
A Whiteboard whose content is a Markdown document instead of a drawing. Shares the Whiteboard API and editor; only the payload differs.

**Wallet**:
A named purse a user creates to separate money by purpose. Has a required name (trimmed, unique case-insensitively per user) and owns its Transactions. There is no default wallet — the user creates the first one. A Wallet's balance is the sum of its ledger: the opening balance it was created with, plus later corrections, minus its spending. The balance is never stored; it is computed from the Transactions.

**Transaction**:
A record of money spent. Has a required title, a required positive Decimal amount (at most two decimal places), a required date, an optional description, an optional Category, and a required Wallet. Deleting a Wallet cascades to its Transactions. Transactions the system writes against the System category — the opening balance and later balance corrections — may carry a negative amount, since they add to the balance rather than spend from it.

**Category**:
A per-user label for classifying Transactions. Has a required name (trimmed, unique case-insensitively per user). The system seeds ten base categories plus the System category when the user creates their first Wallet. Deleting a Category cascades to its Transactions.

**System category**:
The reserved Category (`is_system`) that holds a Wallet's balance ledger — the opening balance on creation and the difference recorded whenever the current balance is set. It is seeded with the base categories, cannot be renamed or deleted, and the interface keeps it out of the category list.

