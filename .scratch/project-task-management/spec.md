Status: ready-for-agent

# Project and Task Management

## Problem Statement

DjangoPersonal needs its first useful feature: a person must be able to organize work into projects and manage the tasks belonging to each project. Tasks without a project would be difficult to find, so the application needs a permanent default project, `Inbox`.

## Solution

Provide project and task management across the React interface and Django Ninja API. The first version is for one user and does not include authentication. Every task belongs to exactly one project. `Inbox` is always available as the default project and receives tasks that are created without a selected project, as well as tasks from a deleted project.

## User Stories

1. As the user, I want to open DjangoPersonal without signing in, so that I can use the first version as a single-user application.
2. As the user, I want an `Inbox` project to be available from the start, so that there is always a place for tasks that have not been assigned elsewhere.
3. As the user, I want to create a project with a required name and optional description, so that I can group related tasks.
4. As the user, I want project names to be trimmed and unique without regard to letter case, so that projects such as `Work`, `work`, and ` Work ` are not duplicates.
5. As the user, I want `Inbox` to be a reserved project name, so that a regular project cannot conflict with the default project.
6. As the user, I want to see all projects with `Inbox` first and the remaining projects in alphabetical order, so that I can find a project consistently.
7. As the user, I want to edit a project's name and description, so that I can keep its information current.
8. As the user, I want `Inbox` to keep its name and remain available, so that default task assignment always has a destination.
9. As the user, I want to delete a regular project after confirming the action, so that I can remove projects I no longer need.
10. As the user, I want to be told that a project's tasks will move to `Inbox` before confirming its deletion, so that I understand what will happen to them.
11. As the user, I want tasks from a deleted project to be deleted along with it, so that a removed project leaves no orphaned tasks behind.
12. As the user, I want to create a task with a required title and optional description, so that I can record work to do.
13. As the user, I want a task created from a project's view to belong to that project, so that it is grouped with related work.
14. As the user, I want a task created without a selected project to be assigned to `Inbox`, so that every task has a project.
15. As the user, I want every task to belong to exactly one project, so that tasks are never unassigned or ambiguously grouped.
16. As the user, I want to see the tasks for the selected project, so that I can focus on that project's work.
17. As the user, I want open tasks shown before completed tasks, so that unfinished work is easy to see.
18. As the user, I want to mark a task complete and reopen it later, so that its state reflects current progress.
19. As the user, I want to edit a task's title, description, completion state, and project, so that I can correct or reorganize it.
20. As the user, I want to move a task between projects, so that its grouping can change as my work changes.
21. As the user, I want to permanently delete a task after confirming the action, so that I can remove tasks I no longer need while avoiding accidental deletion.

## Implementation Decisions

- Deliver a complete vertical slice: React user interface backed by Django Ninja endpoints with Pydantic schemas.
- Version application endpoints under `/api/v1/`.
- Generate the OpenAPI schema from Django Ninja; generate the TypeScript Fetch client with OpenAPI Generator CLI and use that client from React.
- Keep Project and Task behavior in one Django app named `work`, because their invariants and lifecycle are closely related.
- The first version is single-user and has no authentication flow.
- A Project has a required name and optional description. Names are trimmed and unique case-insensitively; `Inbox` is reserved.
- `Inbox` is a permanent, non-renamable default Project and is available from the first use of the feature.
- A Task has a required title, optional description, and an open or completed state. Its Project relationship is required.
- Creating a Task without an explicitly selected Project assigns it to `Inbox`. Tasks can be moved to another Project.
- Deleting a regular Project deletes all of its Tasks along with it. The operation must not leave orphaned Tasks. (Tasks protected by recorded Time entries cannot be deleted; the request is rejected in that case.)
- Deleting a Task is permanent. The UI asks for confirmation before deletion.
- Project deletion also requires confirmation and explains that its Tasks will move to `Inbox`.
- List Projects with `Inbox` first and remaining Projects alphabetically. Within a Project, list open Tasks before completed Tasks; completed Tasks remain visible and can be reopened.

## Testing Decisions

- Tests should verify externally observable behavior, not internal implementation details.
- Backend: use `pytest` with `pytest-django` and Django's test client for API integration tests that exercise requests, responses, and persisted data. Cover project and task CRUD, name normalization and uniqueness, required project assignment, Inbox behavior, project deletion, and task movement/completion.
- Frontend: add Vitest and React Testing Library and test user-visible project/task flows. Mock HTTP at the network boundary rather than testing component internals.
- The repository has no existing application tests or frontend test runner; these test seams and their supporting tools are new.

## Out of Scope

- Multiple users, accounts, and authentication.
- A global task list across all projects; tasks are listed in the selected Project.
- Due dates, priorities, labels, subtasks, recurring tasks, comments, attachments, and task history.
- Soft deletion, trash, or restoration of deleted Projects or Tasks.
- Manual ordering of Projects or Tasks.
- Customization, deletion, or renaming of `Inbox`.
- A browser end-to-end test environment.

## Further Notes

- The domain terms `Project`, `Task`, and `Inbox` are recorded in the repository glossary.
- This spec does not prescribe concrete API URLs or response payload formats; those should be designed while implementing the API seam.
