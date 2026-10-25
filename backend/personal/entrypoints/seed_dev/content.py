"""The hand-written demo content the dev seed draws from.

``demo`` gets all of it; the other seeded accounts get random samples. Only
dates, durations and amounts are random, so the text always makes sense.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

#: The account to show the app with; it gets every piece of content below.
DEMO_USER = 'demo'
#: Accounts with randomly sampled content, e.g. for checking per-user isolation.
RANDOM_USERS = ('alice', 'bob')
USERS = (DEMO_USER, *RANDOM_USERS)

STANDARD_STATUSES = ('Todo', 'W trakcie', 'Zrobione')


@dataclass(frozen=True)
class TaskSeed:
    title: str
    #: The status ``demo`` gets; the random accounts draw one from the project.
    status: str
    description: str = ''


@dataclass(frozen=True)
class ProjectSeed:
    name: str
    description: str
    tasks: tuple[TaskSeed, ...]
    #: Ordered statuses; the last one is the terminal ("done") status.
    statuses: tuple[str, ...] = STANDARD_STATUSES


PROJECTS: tuple[ProjectSeed, ...] = (
    ProjectSeed(
        name='Strona firmowa',
        description='Nowa wersja strony dla klientów: makiety, treści i wdrożenie.',
        tasks=(
            TaskSeed(
                'Przygotować makiety strony głównej',
                'Zrobione',
                'Wersja desktop i mobile, z sekcją opinii klientów.',
            ),
            TaskSeed('Zebrać treści od działu sprzedaży', 'Zrobione'),
            TaskSeed(
                'Zakodować szablon strony głównej',
                'W trakcie',
                'Komponenty z makiet; zacząć od nagłówka i stopki.',
            ),
            TaskSeed('Poprawić RWD w stopce', 'W trakcie'),
            TaskSeed('Podpiąć formularz kontaktowy', 'Todo', 'Wysyłka na adres biura + kopia do CRM.'),
            TaskSeed('Skonfigurować analitykę', 'Todo'),
            TaskSeed('Przenieść stronę na nowy hosting', 'Todo', 'Najpierw sprawdzić limity planu.'),
        ),
    ),
    ProjectSeed(
        name='Aplikacja mobilna',
        description='Aplikacja do rezerwacji wizyt — MVP do końca kwartału.',
        statuses=('Pomysły', 'W trakcie', 'Testy', 'Gotowe'),
        tasks=(
            TaskSeed('Logowanie przez Google', 'Pomysły'),
            TaskSeed('Tryb ciemny', 'Pomysły', 'Użytkownicy pytają o to w ankiecie.'),
            TaskSeed(
                'Ekran kalendarza wizyt',
                'W trakcie',
                'Widok tygodnia, przeciąganie wizyt między dniami.',
            ),
            TaskSeed('Powiadomienia push o wizycie', 'Testy', 'Przypomnienie 24 h i 1 h przed.'),
            TaskSeed('Rejestracja i logowanie', 'Gotowe'),
            TaskSeed('Skonfigurować CI z buildem na Androida', 'Gotowe'),
        ),
    ),
    ProjectSeed(
        name='Remont mieszkania',
        description='Kuchnia i łazienka, start w listopadzie.',
        tasks=(
            TaskSeed('Wymierzyć kuchnię pod nowe szafki', 'Zrobione'),
            TaskSeed('Wybrać płytki do łazienki', 'Zrobione', 'Szare 60×60 na podłogę, białe na ściany.'),
            TaskSeed('Zebrać trzy oferty od ekip', 'W trakcie'),
            TaskSeed('Zamówić blat kuchenny', 'Todo', 'Konglomerat albo drewno — porównać ceny.'),
            TaskSeed('Wybrać firmę do wywozu gruzu', 'Todo'),
            TaskSeed('Ustalić budżet z zapasem 15%', 'Todo'),
        ),
    ),
    ProjectSeed(
        name='Nauka niemieckiego',
        description='Cel: poziom B1 do czerwca.',
        tasks=(
            TaskSeed('Przerobić rozdział 4 podręcznika', 'Zrobione'),
            TaskSeed('Powtórzyć słownictwo z rozdziału 4', 'W trakcie', 'Fiszki w aplikacji, 20 dziennie.'),
            TaskSeed('Rozmowa z native speakerem', 'Todo', 'Umówić się na czwartek wieczorem.'),
            TaskSeed('Napisać wypracowanie o wakacjach', 'Todo'),
            TaskSeed('Obejrzeć serial z napisami po niemiecku', 'Todo'),
        ),
    ),
    ProjectSeed(
        name='Wakacje 2026',
        description='Tydzień w Portugalii w maju.',
        tasks=(
            TaskSeed('Kupić bilety lotnicze', 'Zrobione', 'Lot do Lizbony, bagaż podręczny.'),
            TaskSeed('Zarezerwować nocleg w Lizbonie', 'Zrobione'),
            TaskSeed('Ułożyć plan zwiedzania', 'W trakcie', 'Sintra, Belém, jeden dzień na plaży.'),
            TaskSeed('Wykupić ubezpieczenie podróżne', 'Todo'),
            TaskSeed('Wymienić euro', 'Todo'),
        ),
    ),
)

#: Loose tasks waiting in the Inbox (default statuses).
INBOX_TASKS: tuple[TaskSeed, ...] = (
    TaskSeed('Oddać książkę do biblioteki', 'Todo'),
    TaskSeed('Zadzwonić do dentysty', 'Todo', 'Przegląd co pół roku.'),
    TaskSeed('Przedłużyć abonament telefonu', 'Zrobione'),
)

#: Where ``demo``'s timer is running: (project name, task title).
DEMO_RUNNING_TASK = ('Strona firmowa', 'Zakodować szablon strony głównej')


#: Folder paths in the Notatnik; a parent comes before its subfolders.
FOLDERS: tuple[str, ...] = ('Praca', 'Praca/Spotkania', 'Dom')


@dataclass(frozen=True)
class NoteSeed:
    name: str
    markdown: str
    #: Folder path from :data:`FOLDERS`; ``None`` keeps it at the top level.
    folder: str | None = None


NOTES: tuple[NoteSeed, ...] = (
    NoteSeed(
        name='Witaj w Notatniku',
        markdown="""# Witaj w Notatniku

To jest **Notatka** — dokument w Markdownie. Obok niej możesz trzymać
*Whiteboardy* do rysowania i porządkować wszystko w **Folderach**.

## Co tu działa

- nagłówki, **pogrubienie**, *kursywa* i `kod w linii`
- listy, także zagnieżdżone
  - jak ta
- [x] checkboxy
- [ ] i to, czego jeszcze nie zrobiłem

## Skróty

| Akcja | Gdzie |
| --- | --- |
| Nowa notatka | przycisk „+” w pasku bocznym |
| Szukanie w tekście | pole wyszukiwania nad drzewem |
| Przenoszenie | przeciągnij na folder |

> Wskazówka: wyszukiwanie przeszukuje treść wszystkich notatek.
""",
    ),
    NoteSeed(
        name='Książki do przeczytania',
        markdown="""# Książki do przeczytania

## W kolejce

1. *Projekt Hail Mary* — Andy Weir
2. *Sapiens* — Yuval Noah Harari
3. *Atomowe nawyki* — James Clear

## Przeczytane w tym roku

- [x] *Solaris* — Stanisław Lem
- [x] *Diuna* — Frank Herbert
- [x] *Czysty kod* — Robert C. Martin
""",
    ),
    NoteSeed(
        name='Plan sprintu',
        folder='Praca',
        markdown="""# Sprint 42

**Cel:** wypuścić nową stronę główną na staging.

## Zadania

- [x] Makiety zaakceptowane przez klienta
- [ ] Szablon strony głównej
- [ ] Formularz kontaktowy
- [ ] Testy na telefonach

## Ryzyka

- Treści od sprzedaży mogą się spóźnić.
- Hosting: sprawdzić limit transferu.
""",
    ),
    NoteSeed(
        name='Komendy terminala',
        folder='Praca',
        markdown="""# Komendy, które ciągle zapominam

## Git

```bash
git switch -c feature/nazwa
git rebase -i origin/master
git log --oneline --graph -20
```

## Docker

```bash
docker compose logs -f app
docker compose exec db psql -U postgres
```

## Python

```bash
uv run pytest -x -k nazwa_testu
```
""",
    ),
    NoteSeed(
        name='Retro październik',
        folder='Praca/Spotkania',
        markdown="""# Retrospektywa — październik

**Obecni:** cały zespół

## Co poszło dobrze

- Szybkie code review, większość PR-ów w ciągu dnia
- Nowy pipeline CI skrócił build o połowę

## Co poprawić

- Za dużo spotkań w środy
- Brak opisów w zadaniach

## Ustalenia

- [ ] Środy bez spotkań do 13:00
- [ ] Szablon opisu zadania w trackerze
""",
    ),
    NoteSeed(
        name='Lista zakupów',
        folder='Dom',
        markdown="""# Lista zakupów

## Spożywcze

- [ ] mleko
- [ ] chleb
- [x] jajka
- [ ] pomidory
- [ ] kawa ziarnista

## Remont

- [ ] taśma malarska
- [ ] wałek do farby
- [ ] fuga szara
""",
    ),
)


_NOTE_COLOR = '#fef3c7'
_INK = '#1f2937'


def _note(id: str, x: int, y: int, text: str) -> dict[str, Any]:
    return {
        'id': id,
        'kind': 'note',
        'x': x,
        'y': y,
        'width': 200,
        'height': 140,
        'text': text,
        'color': _NOTE_COLOR,
    }


@dataclass(frozen=True)
class BoardSeed:
    name: str
    content: dict[str, Any] = field(hash=False)
    folder: str | None = None


#: A drawing in the format of ``frontend/src/whiteboard/boardDocument.ts``.
BOARD = BoardSeed(
    name='Plan remontu',
    folder='Dom',
    content={
        'version': 1,
        'viewport': {'x': 0, 'y': 0, 'zoom': 1},
        'elements': [
            {'id': 'title', 'kind': 'text', 'x': 40, 'y': 20, 'text': 'Plan remontu', 'color': _INK},
            {
                'id': 'kitchen',
                'kind': 'rectangle',
                'x': 40,
                'y': 80,
                'width': 320,
                'height': 220,
                'color': '#3d6fb6',
            },
            {'id': 'kitchen-label', 'kind': 'text', 'x': 56, 'y': 92, 'text': 'Kuchnia', 'color': _INK},
            {
                'id': 'bathroom',
                'kind': 'rectangle',
                'x': 480,
                'y': 80,
                'width': 220,
                'height': 220,
                'color': '#477c7c',
            },
            {'id': 'bathroom-label', 'kind': 'text', 'x': 496, 'y': 92, 'text': 'Łazienka', 'color': _INK},
            {
                'id': 'order',
                'kind': 'arrow',
                'from': [360, 190],
                'to': [480, 190],
                'color': _INK,
            },
            _note('note-kitchen', 60, 340, 'Kuchnia: szafki na wymiar, blat do zamówienia'),
            _note('note-bathroom', 480, 340, 'Łazienka: płytki wybrane, czekamy na ekipę'),
            _note('note-budget', 270, 520, 'Budżet: 45 000 zł + 15% zapasu'),
        ],
    },
)


@dataclass(frozen=True)
class CounterSeed:
    name: str
    #: Range of one entry's value.
    min_value: int
    max_value: int
    #: Chance that a given day has entries at all.
    daily_chance: float
    #: Most entries on one day.
    max_per_day: int
    #: Notes handed out in order to the counter's entries (oldest first).
    notes: tuple[str, ...] = ()


COUNTERS: tuple[CounterSeed, ...] = (
    CounterSeed('Kawa', 1, 1, daily_chance=0.95, max_per_day=3),
    CounterSeed('Pompki', 10, 30, daily_chance=0.6, max_per_day=2),
    CounterSeed(
        'Przeczytane książki',
        1,
        1,
        daily_chance=0.12,
        max_per_day=1,
        notes=('Solaris', 'Diuna', 'Czysty kod', 'Lalka', 'Mistrz i Małgorzata'),
    ),
    CounterSeed('Szklanki wody', 1, 2, daily_chance=0.95, max_per_day=6),
)

#: A negative entry showing that a mistaken tally can be taken back.
CORRECTION_COUNTER = 'Kawa'
CORRECTION_NOTE = 'Pomyłka — wpisane dwa razy'


@dataclass(frozen=True)
class SpendingSeed:
    title: str
    category: str
    min_amount: Decimal
    max_amount: Decimal


@dataclass(frozen=True)
class WalletSeed:
    name: str
    color: str
    icon: str
    initial_balance: Decimal
    #: ``demo`` gets each of these exactly once, on a random date.
    spending: tuple[SpendingSeed, ...]


def _spend(title: str, category: str, low: str, high: str) -> SpendingSeed:
    return SpendingSeed(title, category, Decimal(low), Decimal(high))


EVERYDAY_SPENDING: tuple[SpendingSeed, ...] = (
    _spend('Biedronka', 'Jedzenie', '35', '180'),
    _spend('Biedronka', 'Jedzenie', '35', '180'),
    _spend('Lidl', 'Jedzenie', '40', '220'),
    _spend('Lidl', 'Jedzenie', '40', '220'),
    _spend('Piekarnia', 'Jedzenie', '8', '25'),
    _spend('Obiad na mieście', 'Jedzenie', '35', '90'),
    _spend('Pizza z dostawą', 'Jedzenie', '45', '85'),
    _spend('Kawa na wynos', 'Jedzenie', '12', '22'),
    _spend('Czynsz', 'Mieszkanie', '650', '650'),
    _spend('Środki czystości', 'Mieszkanie', '25', '70'),
    _spend('Bilet miesięczny', 'Transport', '110', '110'),
    _spend('Paliwo', 'Transport', '180', '300'),
    _spend('Uber', 'Transport', '20', '55'),
    _spend('Apteka', 'Zdrowie', '18', '90'),
    _spend('Siłownia', 'Zdrowie', '139', '139'),
    _spend('Kino', 'Rozrywka', '32', '70'),
    _spend('Netflix', 'Rozrywka', '43', '43'),
    _spend('Spotify', 'Rozrywka', '24', '24'),
    _spend('Buty do biegania', 'Zakupy', '250', '420'),
    _spend('Allegro — ładowarka', 'Zakupy', '40', '120'),
    _spend('Prąd', 'Rachunki', '140', '220'),
    _spend('Internet', 'Rachunki', '70', '70'),
    _spend('Telefon', 'Rachunki', '45', '45'),
    _spend('Kurs niemieckiego', 'Edukacja', '180', '180'),
    _spend('Prezent urodzinowy', 'Inne', '60', '150'),
)

SAVINGS_SPENDING: tuple[SpendingSeed, ...] = (
    _spend('Bilety lotnicze do Lizbony', 'Podróże', '900', '1300'),
    _spend('Nocleg w Lizbonie', 'Podróże', '1400', '2100'),
    _spend('Zaliczka dla ekipy remontowej', 'Mieszkanie', '2000', '3000'),
    _spend('Płytki do łazienki', 'Mieszkanie', '1200', '1800'),
)

WALLETS: tuple[WalletSeed, ...] = (
    WalletSeed('Codzienny', '#477c7c', 'wallet', Decimal('4500.00'), EVERYDAY_SPENDING),
    WalletSeed('Oszczędności', '#c2922b', 'piggy-bank', Decimal('12000.00'), SAVINGS_SPENDING),
)
