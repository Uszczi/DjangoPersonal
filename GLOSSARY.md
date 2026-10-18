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
