# 06: Jeden DomainError + jeden adapter HTTP

**What to build:** Statusy błędów bez zmian (400 walidacja, 401 login, 404 braki, kształt `{ "detail": ... }`). Trzy hierarchie błędów domenowych i trzy adaptery HTTP skonsolidowane w jeden moduł i jeden adapter.

**Blocked by:** 05 (Reorder pozycji za szwem repozytorium).

**Status:** ready-for-agent

- [ ] Jeden `DomainError` z podklasą `NotFound` i taksonomią kodów `invalid` / `not_found`.
- [ ] Precedencja zachowana: jawny `status` wygrywa, potem mapa kodów, potem `400`.
- [ ] Jeden adapter z `status_for(error)` i `register_error_handlers(api)`, zarejestrowany raz w konfiguracji API.
- [ ] Odpowiedź błędu ma kształt `{ "detail": error.message }`.
- [ ] Trzy moduły błędów i trzy adaptery per-app usunięte; ~20 raise site'ów przepiętych na wspólny moduł.
- [ ] Handlery accounts zachowują jawne `status=` (400/401 bez zmian).
- [ ] Martwe importy w `mcp_server/server.py` usunięte (ciało dalej spłaszcza do `ValueError`).
- [ ] Testy: `status_for` (mapa, precedencja status, fallback 400), kształt odpowiedzi `{detail}`, pierwszy test accounts — login złym hasłem → 401.
- [ ] `just typecheck + pytest` zielone.
