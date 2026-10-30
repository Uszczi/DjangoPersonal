# MCP tools: category kind

Status: resolved
Blocked by: 07

Spec: [../spec.md](../spec.md), section "Contract".

## What to build

In `backend/personal/entrypoints/mcp/tools/expenses.py`:

- `create_category` gains `kind: Literal["expense", "income"] = "expense"`, and its docstring explains the kind is fixed at creation.
- `update_category` stays without `kind`.
- `create_transaction` docstring: "Record an expense or an income; the direction follows from the category's kind." Mention that the System category is refused.
- Check that `serialization.category` / `transaction` emit `kind`. They should if they go through the response contracts.

## Acceptance criteria

- [ ] `tests/entrypoints/mcp/tools/test_expenses.py` covers creating an Income category, the default kind, and a transaction's `kind` in the output.
- [ ] `just check` passes.

## Answer

Done (2026-10-30) on `feat/income` (commit `2d98b0d`). `create_category` gained `kind: Literal["expense", "income"] = "expense"` with its docstring noting the kind is fixed; `update_category` stays without `kind`; `create_transaction`'s docstring now reads "Record an expense or an income…" and mentions System is refused. Category and transaction outputs carry `kind` via the response contracts. A new test covers the Income kind, the default, and the transaction's `kind`. `just check` passes.
