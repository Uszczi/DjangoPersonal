# 04: Jedno źródło reguły nazw Project

**What to build:** Nazwy Projectów nadal są przycinane, porównywane bez względu na wielkość liter, a `Inbox` pozostaje zastrzeżone. Jedna definicja funkcji zamiast trzech kopii; martwa kopia usunięta. Constraintów bazy nie ruszamy.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Nazwy Projectów nadal przycinane, porównywane case-insensitive, `Inbox` zastrzeżone.
- [x] Obie funkcje (normalizacja + klucz) mają jedną definicję współdzieloną.
- [x] Martwa kopia na modelu Task usunięta.
- [x] Istniejące ścieżki importu w contracts/handlers działają dalej (re-export przez pakiet).
- [x] Constraintów bazy nie ruszamy (safety-net dla seed/MCP).
- [x] Nowy test jednostkowy bez DB: strip, casefold, klucz dla `Inbox`.
- [x] `just typecheck + pytest` zielone.

## Comments

Implementacja (C4) gotowa. TDD: nowy `tests/test_project_name_rule.py` (bez DB) — test
strukturalny failował przed refaktorem, behawioralne (strip, casefold, `INBOX` → `inbox`)
są safety-netem. Jedyna definicja została w `apps/infra/models/project.py`; kopie z
`task.py` usunięte; `__init__.py` re-eksportuje obie funkcje z `.project` (ścieżki
`contracts/projects.py` i `handlers/projects.py` działają bez zmian). Constrainty bazy
nietknięte.

Zweryfikowano: `uv run mypy .` (91 plików), `uv run pytest` (53, +4 nowe),
`uv run python manage.py check`.
