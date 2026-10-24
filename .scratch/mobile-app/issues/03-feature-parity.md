Status: done

# 03: Feature parity with the web (except Notatki)

**What to build:** Everything the web app does, on the phone, except the whiteboard (Notatki).

**Blocked by:** 02

- [x] Five tabs: Projekty, Czas, Wydatki, Liczniki, Konto.
- [x] Register, and an account screen with sign out and account deletion.
- [x] Projects: create, edit (statuses with up/down reordering, terminal status), delete (not the Inbox).
- [x] Tasks: grouped by status; add, edit, delete, reorder within a status (up/down), start a timer.
- [x] Czas: running timer (stop, discard), start with task-title suggestions, manual entries, edit/delete entries, recent entries by range, today/per-task/7-day summary.
- [x] Wydatki: wallet switcher; create/edit/delete wallets (colour, icon, balance); transactions by day; add/edit/delete transactions; categories (create, edit name and icon, delete).
- [x] Liczniki (from 02's follow-up): list with +1, counter screen with entries, entry editor.
- [x] `tsc --noEmit`, `expo export` and `just check` pass.

## Implementation notes

- Moved to `@personal/shared`: `walletColors`, `walletIcons`, `categoryIcons`, `iconSuggestion` and the new `timeFormat` (date keys, clock, elapsed and duration formatting, entry minutes), now used by the web Timer page too. The package exports any root module through `"./*"`.
- Drag and drop (projects order, task order, status order) is replaced by up/down buttons; reordering Projects themselves is web-only for now.
- Icons use `lucide-react-native` with the full icon map, so any icon set on the web shows on the phone. That puts the bundle at ~4.8 MB.
- Every screen action sits in the screen body, not the native header (header buttons can miss taps on Android).
- Not yet run on a device; no React Native test runner yet.
