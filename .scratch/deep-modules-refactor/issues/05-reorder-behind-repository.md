# 05: Reorder pozycji za szwem repozytorium

**What to build:** Zmiana `position` przez API nadal działa (clamp, gapless, Inbox poza zakresem, scope per Project i per stan ukończenia), ale przez metodę repozytorium wewnątrz transakcji. Fix: nowy Task ląduje za ostatnim otwartym Taskiem, nie za ostatnim cokolwiek.

**Blocked by:** 04 (Jedno źródło reguły nazw Project).

**Status:** ready-for-agent

- [ ] Reorder Projectów i Tasków odbywa się przez metodę repozytorium w `transaction.atomic`.
- [ ] Indeks clampowany na obu końcach; pozycje pozostają gapless po każdym reorder.
- [ ] Scope siblingów: projekty `is_inbox=False`, taski `project_id` + `is_completed`.
- [ ] `index=None` oznacza dopnięcie na koniec (absorbuje istniejący append-path z `Max`).
- [ ] Fix: nowy Task ląduje za ostatnim otwartym (next_position filtruje `is_completed=False`).
- [ ] Handlery straciły inline zapytania ORM, oba jednoelementowe loop-y `position_aliases` i martwą zmienną.
- [ ] Testy repozytorium: clamp, gapless po wyciągnięciu środka, insert na krawędziach, `index=None` = koniec, oba zakresy siblingów.
- [ ] Testy HTTP: update z `position` → kolejność w liście; project i task.
- [ ] `just typecheck + pytest` zielone.
