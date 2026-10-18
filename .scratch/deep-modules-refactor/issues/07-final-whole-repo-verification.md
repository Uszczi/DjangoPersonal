# 07: Weryfikacja końcowa całości

**What to build:** Pełny `just check` zielony na całości po wszystkich krokach: mypy, pytest, `manage.py check`, `npm test`, lint, build.

**Blocked by:** 01, 02, 03, 04, 05, 06.

**Status:** done

- [x] Pełny `just check` zielony (mypy + pytest + `manage.py check` + `npm test` + lint + build).
- [x] QA ręczne canvas wg checklisty z ticketu 01.
- [x] Wzrokowo: toolbar renderuje się raz, tylko w trybie whiteboard (ticket 03).
- [x] Bez migracji bazy danych w całym zakresie.
- [x] Bez zmian w `routeTree.gen.ts` / generated API.
- [x] Komentarze i docstringi opisujące stare zachowanie zsynchronizowane (w tym te o „przyszłym" MCP).
