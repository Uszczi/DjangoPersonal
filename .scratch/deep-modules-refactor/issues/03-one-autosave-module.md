# 03: Jeden moduł autosave dla edytora

**What to build:** Autosave 500 ms, `Ctrl+S`, wskaźnik zapisu i przycisk „Zapisz" działają identycznie dla Whiteboarda i Notatek. Fix: unmount-flush obejmuje oba rodzaje dokumentów (markdown go nie miał). Toolbar renderuje się dokładnie raz, tylko w trybie rysowania.

**Blocked by:** 02 (Jeden guard ładowania dla storów).

**Status:** done

- [x] Jeden hook autosave nad unią payloadów (content / markdown / name); format wire pozostaje w route.
- [x] Autosave 500 ms, `Ctrl+S` i przycisk „Zapisz" działają identycznie dla Whiteboarda i Notatek.
- [x] Unmount-flush obejmuje oba rodzaje dokumentów (naprawia brak flusha dla Notatek).
- [x] Wskaźnik zapisu saved/saving/failed bez zmian.
- [x] Zmiana nazwy zapisuje się natychmiast.
- [x] Toolbar renderuje się dokładnie raz, tylko w trybie rysowania (naprawia podwójny render).

## Comments

Implementacja (C4) gotowa. Nowy hook `frontend/src/whiteboard/useAutosave.ts`:
unia `SavePayload` = whiteboard doc | markdown | name, debounce 500 ms (`options.delay`),
`saveNow` (name — natychmiast), `flush()` (Ctrl+S i przycisk „Zapisz"), wskaźnik
saved/saving/failed (typ `SaveState` w hooku, re-eksport ze store), unmount-flush obejmuje oba
rodzaje dokumentów. Format wire (`content` / `content.markdown` / `name`) pozostawił w route
jako `save(payload)`. Usunięte: `saveTimer`/`latestBoard`/`markdownTimer`/`latestMarkdown`,
`saveNow`, `saveMarkdown` i unmount-flush effect w route. Undo/redo schedule'uje autosave
po zmianie dokumentu. Po code-review API hooka dostosowane do spec (schedule/saveNow/options.delay).

Zweryfikowano: `npm test` (71, +8 nowych `useAutosave`), `npm run lint` (tylko wcześniej
istniejące ostrzeżenia), `npm run build` zielony. `GLOSSARY.md` ma teraz termin **Notatki**.

Częściowo wykonane po zgłoszeniu z QA (2026-10-18): **zduplikowany toolbar jest już usunięty** —
zawsze-renderowana kopia (przed przełącznikiem markdown/whiteboard) skasowana, zostaje dokładnie
jedna kopia w gałęzi whiteboard. Reszta ticketu (moduł autosave) pozostaje do zrobienia.
- [x] Test hooka `useAutosave` (renderHook + fake timers): debounce, flush zapisuje latest, przejścia saved→saving→saved/failed, unmount-flush.
- [x] `GLOSSARY.md` ma termin dla rodzaju markdown (Notatki).
- [x] `npm test && npm run lint && npm run build` zielone.
