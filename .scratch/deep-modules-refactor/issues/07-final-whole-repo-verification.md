# 07: Weryfikacja końcowa całości

**What to build:** Pełny `just check` zielony na całości po wszystkich krokach: mypy, pytest, `manage.py check`, `npm test`, lint, build.

**Blocked by:** 01, 02, 03, 04, 05, 06.

**Status:** ready-for-agent

- [ ] Pełny `just check` zielony (mypy + pytest + `manage.py check` + `npm test` + lint + build).
- [ ] QA ręczne canvas wg checklisty z ticketu 01.
- [ ] Wzrokowo: toolbar renderuje się raz, tylko w trybie whiteboard (ticket 03).
- [ ] Bez migracji bazy danych w całym zakresie.
- [ ] Bez zmian w `routeTree.gen.ts` / generated API.
- [ ] Komentarze i docstringi opisujące stare zachowanie zsynchronizowane (w tym te o „przyszłym" MCP).
