# 01: Browse and manage Projects

**What to build:** The user can create, browse, and edit Projects in the React interface, backed by the Django Ninja API. A permanent `Inbox` is available from the start for Tasks that do not have another Project.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] The user can create a Project with a required name and optional description, and edit its name and description.
- [x] Project names are trimmed and unique without regard to letter case; `Inbox` is reserved for the default Project.
- [x] The user can browse Projects with `Inbox` first and other Projects in alphabetical order.
- [x] `Inbox` is available from the first use and cannot be renamed or deleted.
- [x] Project API endpoints use the `/api/v1/` prefix and are described in the generated OpenAPI schema.
- [x] An OpenAPI Generator CLI command produces the TypeScript Fetch client used by the frontend.
- [x] Backend API integration tests use `pytest` and cover Project behavior and validation.
- [x] Frontend tests use Vitest and React Testing Library to verify the user-visible Project flows.
