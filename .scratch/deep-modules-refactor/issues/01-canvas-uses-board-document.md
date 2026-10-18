# 01: Canvas woła moduł board-document

**What to build:** Przeciąganie, zmiana rozmiaru i zaznaczanie marquee na canvasie działają jak dotychczas, ale geometria (granice elementów, hit-test, przesuwanie, clamp rozmiaru) żyje w czystym module `board-document` i jest tam testowana. Dublujące się bloki hit-testu w canvasie i trzy kopie logiki przesuwania znikają.

**Blocked by:** None (can start immediately).

- [x] `elementBounds` zwraca granice dla każdego rodzaju elementu: stroke, line/arrow, note, rectangle, ellipse, text.
- [x] `elementsInRect` zwraca id elementów przecinających prostokąt (trafienia i mimośrody), z identycznym predykatem AABB co dotychczas.
- [x] Marquee wybiera dokładnie elementy, których dotyka, z zachowanym progiem drag-threshold i pochodzeniem prostokąta.
- [x] Notatki nie kurczą się poniżej minimum przy resizie.
- [x] Przeciąganie notatki, stroke'a i konektora oraz edycja tekstu notatki i etykiety działają jak dotychczas.
- [x] Gumka, undo/redo, pan/zoom nienaruszone.
- [x] Istniejące testy `boardDocument` przechodzą bez zmian; nowe testy pokrywają `elementBounds` per rodzaj, `elementsInRect` (trafienia/mimośrody) i clamp resizowania notatki.
- [x] QA ręczne wg checklisty canvas (jsdom nie renderuje canvasu).
- [x] Pełny `just check` zielony.

## Comments

Implementacja (C4) gotowa. Geometria przeniesiona do `boardDocument.ts`:
`elementBounds`, `elementsInRect`, stałe `TEXT_LABEL_BOUNDS` (60×20) i `NOTE_MIN_SIZE` (40×30);
`resizeElement` clampuje notatkę do minimum. `WhiteboardCanvas.tsx` używa teraz modułu:
marquee → `elementsInRect`, drag/resize notatki → `moveElement`/`resizeElement`,
drag stroke'a/konektora → `moveElement` + reset pozycji węzła, edycja tekstu → `updateElement`;
inline `{...board, elements: map(...)}` i oba zduplikowane bloki hit-testu usunięte.

Zweryfikowano: `npm test` (59 testów, +3 nowe), `npm run lint` (tylko wcześniej istniejące ostrzeżenia),
`npm run build` (tsc + vite) oraz pełny `just check` zielony.

Do zrobienia przez człowieka — QA ręczne na canvasie (checklista):
przeciągnięcie i resize notatki (min 40×30), marquee z progiem, drag stroke'a i konektora,
gumka, edycja tekstu notatki i etykiety, undo/redo, pan/zoom.

### Poprawki po zgłoszeniu z QA (2026-10-18)

- **Notatka przesuwała się za daleko** (regresja z tej implementacji): drag DOM notatki
  przekazywał do `moveElement` *całkowity* delta od startu, a `moveElement` dodaje deltę do
  *bieżącej* pozycji — efekt narastał z każdym `pointermove`. Teraz delta jest przyrostowa
  (`newX - current.x`), czyli krok od ostatniej pozycji.
- **Elipsa przesuwała się za daleko** (bug istniejący wcześniej): Konva pozycjonuje elipsę
  środkiem (`x = el.x + el.width/2`), a handler wpisywał `node.x()` prosto w `el.x` (lewy górny
  róg), przeskakując o połowę rozmiaru. Handler konwertuje teraz środek z powrotem na róg.
- **Toolbar zduplikowany** — część ticketu 03; zawsze-renderowana kopia usunięta, zostaje
  dokładnie jedna, tylko w trybie whiteboard. (Zob. ticket 03.)

Zweryfikowano ponownie: pełny `just check` zielony (mypy 90 plików, pytest 49, frontend 59).
