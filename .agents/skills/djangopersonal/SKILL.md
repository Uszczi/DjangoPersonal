---
name: djangopersonal
description: >-
  Track work in the DjangoPersonal personal organizer via its MCP server. Use when
  starting a piece of work that changes source code: create a task in the
  DjangoPersonal project with a title, do the work, then update the task with a
  description of what was implemented and mark it done. Also use to inspect or
  manage projects, tasks, time entries, and timers through the djangopersonal MCP.
---

# DjangoPersonal task tracking

DjangoPersonal is the user's personal work organizer (projects, tasks, time
entries, timer, whiteboards, expenses). It is reachable through the
`djangopersonal` MCP server. This skill defines how agent work is recorded
there.

## When to create a task

Create a DjangoPersonal task whenever you start work that requires changing
source code. Pure research, reading, or answering questions does not need a
task.

## Workflow

1. **Create** a task in the `DjangoPersonal` project with a concise title:

   ```
   create_task(title="<short title>", project_id=<DjangoPersonal project id>)
   ```

   Use the project named `DjangoPersonal` (not the Inbox). Keep the title short
   and in the user's language; the description can be filled in later.

2. **Do the work** (implement, test, typecheck).

3. **Update** the task with what was implemented and mark it done. Because the
   `update_task` tool treats an explicit `null` as "set to null" (a 400), pass
   every field you want to keep, not just the changed ones:

   ```
   update_task(task_id=<id>, title=<title>, description=<what was done>,
               project_id=<id>, status="Zrobione", position=<position>)
   ```

   The project's terminal status is `Zrobione` ("Done").

## Conventions

- One task per logical change. If a request spans several independent changes,
  create one task per change.
- Titles are short; descriptions hold the implementation notes (files touched,
  commands run, tests added).
- Never delete a task that has time recorded against it; the server refuses.
- All data is per-user; the MCP resolves the user from the OAuth token or the
  configured default user.

## Available tools (djangopersonal MCP)

Projects: `list_projects`, `get_project`, `create_project`, `update_project`,
`delete_project`. Tasks: `list_tasks`, `create_task`, `update_task`,
`delete_task`. Time: `list_time_entries`, `create_time_entry`,
`update_time_entry`, `delete_time_entry`, `start_timer`, `stop_timer`,
`get_timer`.
"""