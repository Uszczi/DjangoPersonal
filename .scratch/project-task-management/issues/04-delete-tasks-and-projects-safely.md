# 04: Delete Tasks and Projects safely

**What to build:** The user can permanently delete Tasks and regular Projects with clear confirmation. Deleting a Project transfers its Tasks to `Inbox` instead of deleting them or leaving them unassigned.

**Blocked by:** 02: Create and browse Tasks in a Project.

**Status:** done

- [x] The user must confirm before permanently deleting a Task.
- [x] The user must confirm before deleting a regular Project and is told its Tasks will move to `Inbox`.
- [x] Deleting a Project moves all its Tasks to `Inbox` before removing the Project.
- [x] Deleting an empty Project succeeds; deleting `Inbox` is not allowed.
- [x] The operation never leaves a Task without a Project and does not delete Tasks when their Project is deleted.
- [x] Backend API integration and frontend interaction tests cover Task deletion, Project deletion, confirmation, and Task transfer.

## Implementation notes

- API: `DELETE /api/v1/tasks/{id}/` returns 204; a Task with recorded Time entries is rejected (400) because Time entries `PROTECT` their Task.
- API: `DELETE /api/v1/projects/{id}/` moves all Tasks to `Inbox` in one transaction, then deletes the Project; `Inbox` itself is rejected (400).
- Frontend: task rows gain a `Usuń` action and the project header gains `Usuń projekt` (hidden for `Inbox`); both open a confirmation dialog. After a Project is deleted, the view switches to `Inbox` and reloads its task list with the transferred Tasks.
- Timer page: the running entry is no longer offered as an editable row; it can only be stopped or discarded (`Odrzuć timer`, which deletes the running entry).
