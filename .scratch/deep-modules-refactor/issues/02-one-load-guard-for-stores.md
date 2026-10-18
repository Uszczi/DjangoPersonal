# 02: Jeden guard ładowania dla storów

**What to build:** Przeładowanie list Projects, Tasks, Running timer, Whiteboards oraz edytora tablicy odrzuca nieaktualne odpowiedzi przez jeden mechanizm request-id. Szybka nawigacja nigdy nie pozwala starej odpowiedzi nadpisać nowszych danych, a spinner znika po najnowszym żądaniu. Stan ładowania i komunikaty błędów bez zmian.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Wszystkie cztery stor-y oraz edytor tablicy używają jednego guarda (factory dla storów, hook dla route).
- [x] Przeplot dwóch ładowań odrzuca odpowiedź pierwszego, gdy drugie już ruszyło.
- [x] Stor tasks nadal kluczuje `loadError` po `projectId`.
- [x] `finally` podlega temu samemu guardowi (nie kasuje spinnera nowszego żądania).
- [x] Nowy test jednostkowy guarda na przeplocie dwóch ładowań.
- [x] `resetStores` w testach resetuje też `useWhiteboardsStore`.
- [x] `npm test && npm run lint && npm run build` zielone.
