# 05: Reorder pozycji za szwem repozytorium

**What to build:** Zmiana `position` przez API nadal działa (clamp, gapless, Inbox poza zakresem, scope per Project i per stan ukończenia), ale przez metodę repozytorium wewnątrz transakcji. Fix: nowy Task ląduje za ostatnim otwartym Taskiem, nie za ostatnim cokolwiek.

**Blocked by:** 04 (Jedno źródło reguły nazw Project).

**Status:** ready-for-agent

- [x] Reorder Projectów i Tasków odbywa się przez metodę repozytorium w `transaction.atomic`.
- [x] Indeks clampowany na obu końcach; pozycje pozostają gapless po każdym reorder.
- [x] Scope siblingów: projekty `is_inbox=False`, taski `project_id` + `is_completed`.
- [x] `index=None` oznacza dopnięcie na koniec (absorbuje istniejący append-path z `Max`).
- [x] Fix: nowy Task ląduje za ostatnim otwartym (next_position filtruje `is_completed=False`).
- [x] Handlery straciły inline zapytania ORM, oba jednoelementowe loop-y `position_aliases` i martwą zmienną.
- [x] Testy repozytorium: clamp, gapless po wyciągnięciu środka, insert na krawędziach, `index=None` = koniec, oba zakresy siblingów.
- [x] Testy HTTP: update z `position` → kolejność w liście; project i task.
- [x] `just typecheck + pytest` zielone.

## Comments

Implementacja gotowa. TDD: nowy szew repozytorium `tests/test_reorder_repository.py`
(10 testów — RED na brakującym `reorder`, GREEN po implementacji); testy HTTP
(reorder przez PATCH dla project i task + clamp + fix pozycji nowego Taska) jako
characterization przed przepięciem handlerów. Obie metody `reorder` robią clamp,
insert i gapless renumber jednym `bulk_update` w `transaction.atomic`;
`TaskRepository.next_position` liczy tylko po otwartych taskach.
Handlery (`UpdateProject`, `UpdateTask`, `CreateTask`) opisują intencję na szwie
repozytorium — bez inline ORM, bez loopów `position_aliases`, bez martwej
`old_position`; ścieżka append przy zmianie project/completion wchłonięta przez
`reorder(index=None)`.

Zweryfikowano: `uv run mypy .` (92 pliki, czysto), `uv run pytest` (68, +15 nowych),
3 pełne przebiegi stabilne (jedna wcześniejsza flukey awaria `test_seed_dev`,
nietrwała, niezwiązana — przechodzi w izolacji i w kolejnych przebiegach).
