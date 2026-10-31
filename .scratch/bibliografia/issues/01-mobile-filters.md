# Mobile Bibliografia: compact filters

Status: resolved

On a phone the Bibliografia tab showed every control at once (view mode, year
actions, search, kind chips, status chips): five rows before the first item.

## Answer

Prototyped four layouts on the real tab (branch `prototype/bibliography-filters`,
commit `c13dc57`, `?variant=A|B|C|D`):

- A: today's five rows (baseline)
- B: search + one row of dropdown chips (Widok / Rodzaj / Status)
- C: search + a Filtry button with a count badge; everything else in one sheet,
  the filters in force as removable pills under the search
- D: nothing in the body; kind picked from the header title, search and filters
  behind header icons

Verdict (2026-10-31): **C**. One row by default, and what is filtered stays
visible as pills. Folded into `mobile/app/(tabs)/bibliography.tsx` and
`mobile/src/features/bibliography/BibliographyFiltersSheet.tsx`; the prototype branch keeps all four.
