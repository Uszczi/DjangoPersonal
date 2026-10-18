# 06: Jeden DomainError + jeden adapter HTTP

**What to build:** Statusy błędów bez zmian (400 walidacja, 401 login, 404 braki, kształt `{ "detail": ... }`). Trzy hierarchie błędów domenowych i trzy adaptery HTTP skonsolidowane w jeden moduł i jeden adapter.

**Blocked by:** 05 (Reorder pozycji za szwem repozytorium).

**Status:** done

- [x] Jeden `DomainError` z podklasą `NotFound` i taksonomią kodów `invalid` / `not_found`.
- [x] Precedencja zachowana: jawny `status` wygrywa, potem mapa kodów, potem `400`.
- [x] Jeden adapter z `status_for(error)` i `register_error_handlers(api)`, zarejestrowany raz w konfiguracji API.
- [x] Odpowiedź błędu ma kształt `{ "detail": error.message }`.
- [x] Trzy moduły błędów i trzy adaptery per-app usunięte; ~20 raise site'ów przepiętych na wspólny moduł.
- [x] Handlery accounts zachowują jawne `status=` (400/401 bez zmian).
- [x] Martwe importy w `mcp_server/server.py` usunięte (ciało dalej spłaszcza do `ValueError`).
- [x] Testy: `status_for` (mapa, precedencja status, fallback 400), kształt odpowiedzi `{detail}`, pierwszy test accounts — login złym hasłem → 401.
- [x] `just typecheck + pytest` zielone.

## Comments

Implementacja gotowa. Jeden moduł `apps/shared/errors.py` (`DomainError(message, *,
code=None, status=None)` + `NotFound`, taksonomia `invalid`/`not_found`, bez
zależności frameworkowych — MCP może mapować te kody później) i jeden adapter
`apps/shared/http_errors.py` (`status_for` z precedencją: jawny `status` → mapa
kodów → 400; `register_error_handlers` z kształtem `{detail}`), zarejestrowany
raz w `config/api.py`. Usunięte: `apps/{work,accounts,whiteboard}/errors.py` oraz
`apps/{work,accounts,whiteboard}/api/errors.py` (6 plików). 21 raise site'ów
przepiętych na wspólny moduł; handlery accounts zachowują jawne `status=`
(400/401 bez zmian — potwierdza nowy test HTTP). Martwe importy błędów w
`mcp_server/server.py` usunięte; spławdocstringowane odniesienia do starych
modułów (`apps/work/handlers/__init__.py`, `apps/infra/repo/errors.py`).

Zweryfikowano: `uv run mypy .` (90 plików, czysto), `uv run pytest` (73, +5 nowych),
`uv run python manage.py check` (0 issues).
