# 04: Delete Tasks and Projects safely

**What to build:** The user can permanently delete Tasks and regular Projects with clear confirmation. Deleting a Project transfers its Tasks to `Inbox` instead of deleting them or leaving them unassigned.

**Blocked by:** 02: Create and browse Tasks in a Project.

**Status:** ready-for-agent

- [ ] The user must confirm before permanently deleting a Task.
- [ ] The user must confirm before deleting a regular Project and is told its Tasks will move to `Inbox`.
- [ ] Deleting a Project moves all its Tasks to `Inbox` before removing the Project.
- [ ] Deleting an empty Project succeeds; deleting `Inbox` is not allowed.
- [ ] The operation never leaves a Task without a Project and does not delete Tasks when their Project is deleted.
- [ ] Backend API integration and frontend interaction tests cover Task deletion, Project deletion, confirmation, and Task transfer.
