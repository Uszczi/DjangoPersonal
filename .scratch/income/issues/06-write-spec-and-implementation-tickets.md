# Write the spec and the implementation tickets

Status: resolved
Type: task
Blocked by: 01, 02, 03, 04, 05

## Question

This is the destination of the map. Turn the closed decisions (01–05) into `.scratch/income/spec.md` and numbered implementation tickets under `.scratch/income/issues/`, each `Status: ready-for-agent`. Likely slices: the backend (Category kind, migration, seeding, balance rule, System guards, contract and tests), regenerating the API client plus `CACHE_VERSION`, the MCP tools, the web UI (list, form, category panel, colour tokens), and mobile. Decide the slice boundaries and their order (each must leave `just check` green).

## Answer

Done (2026-10-30). [spec.md](../spec.md) plus four implementation tickets, all `ready-for-agent`:

- [07 Backend: Category kind, balance rule and System guards](07-backend-category-kind.md). It includes the API client regeneration and `CACHE_VERSION`, because CI checks the generated client is in sync.
- [08 MCP tools: category kind](08-mcp-category-kind.md), after 07.
- [09 Web: Incomes on the list, form and category panel](09-web-income-ui.md), after 07. It adds the colour tokens.
- [10 Mobile: Incomes on the list, form and categories](10-mobile-income-ui.md), after 07 and 09 (it reuses the tokens).

08 and 09 can run in parallel.
