# Mobile: move all styling to Uniwind

Status: done (awaiting a check on a phone)

Rewrite every mobile screen and component from `StyleSheet`/`makeStyles` to Uniwind `className` (Tailwind 4 for React Native), then delete `makeStyles` and the `common`/`card`/`form` style sheets. Nothing should look or behave differently.

Load the `uniwind` skill (`.agents/skills/uniwind/`) before you start. Its Critical Rules apply throughout. The `migrate-nativewind-to-uniwind` skill does not apply: this app never used NativeWind.

## Where things stand

- Branch `feat/uniwind`, cut from `proto/uniwind`. Commit `ff4e058` is the prototype and works on a phone.
- `mobile/themeCss.js` builds `mobile/global.css` from `packages/shared/src/themes.ts`. Each theme becomes an `@variant <name>` with one `--color-*` variable per palette token, named like the web's (`signalPale` → `--color-signal-pale`). So the utilities match the web: `bg-canvas`, `text-ink`, `border-row-line`, `bg-danger-pale`. Fonts are `font-display` and `font-utility`, registered in `@theme` and set per platform with `@variant ios` / `@variant android`.
- `mobile/metro.config.js` writes `global.css` on every Metro start and passes every non-light/dark theme to `extraThemes`. `global.css` is gitignored; never edit it. To change it, edit `themeCss.js` or `themes.ts`.
- `mobile/src/uniwind-types.d.ts` is Uniwind's generated typing. It is committed so `tsc` passes without Metro. Uniwind rewrites it when Metro runs; it only changes when the theme list changes.
- `useUniwindTheme` (`src/theme.ts`, mounted in `app/_layout.tsx`) passes the theme preference to `Uniwind.setTheme`. It passes `"system"` through unchanged: forcing light or dark would pin `Appearance` and break `useColorScheme`.
- `app/(tabs)/counters.tsx` is already converted. Use it as the reference.

## Decisions

1. **Shared class strings replace `common`, `card` and `form`.** Create `src/ui/classes.ts` exporting plain objects of string literals with the same keys (`common.screen`, `card.section`, `form.input`, …), so `style={common.row}` becomes `className={common.row}`. Tailwind scans every file under `mobile/`, so string literals in a `.ts` module are compiled.
2. **Non-style colour props keep JS colours.** Ionicons and lucide `color`, `RefreshControl`, `ActivityIndicator`, `Switch`, `DateTimePicker`, react-navigation `headerStyle`/`headerTintColor`/tab bar options in `app/(tabs)/_layout.tsx`, `headerOptions`, and `StatusBar` all keep reading `useTheme().colors` (the palette from `themes.ts`, correct for every theme). For core RN components that have an `*ClassName` prop, prefer it with an `accent-` class, e.g. `placeholderTextColorClassName="accent-hint"`.
3. **Colours from data stay in `style`**, e.g. a Counter's, Project's or Wallet's colour: `style={{ borderTopColor: counter.color }}` next to `className`.
4. **Pressed state uses `active:`** on `Pressable` (`active:opacity-60`, `active:bg-wash`), replacing `style={({ pressed }) => …}`.
5. **Keep `useTheme()`** but trim it to `{ name, scheme, colors, headerOptions }`. Delete `makeStyles`, `useCommon`, `useCard`, `useForm` and the `fonts` export once nothing uses them.
6. **No `tailwind-merge`.** Class order inside `className` does not decide conflicts; the CSS cascade does. Never put two classes for the same property on one element: `text-muted text-signal` gives an undefined result. Where an old `style={[a, b]}` overrode a property, write the full class string for that case, or add a variant to `classes.ts` such as `card.kickerSignal`.
7. **Never build class names dynamically** (`bg-${x}`). Ternaries between complete literals are fine.

## Mapping from the current styles

Sizes follow the prototype. For 12 and 14 px use `text-xs` and `text-sm`; they also set a line height (16 and 20 px), and that was accepted on the phone. Use arbitrary sizes such as `text-[13px]` for everything else. For `TextInput` use `text-[14px]`, not `text-sm`: a line height on inputs changes their height. The spacing unit is 4 px (rem 16).

| Old | Classes |
| --- | --- |
| `common.screen` | `flex-1 bg-canvas` |
| `common.center` | `flex-1 items-center justify-center bg-canvas p-6` |
| `common.error` | `p-4 text-[13px] text-danger` |
| `common.muted` | `text-xs text-muted` |
| `common.row` | `mx-4 min-h-[62px] flex-row items-center gap-[13px] border-b border-row-line px-[3px] py-2.5` |
| `common.rowTitle` | `text-sm font-medium text-ink` |
| `common.rowSubtitle` | `mt-0.5 text-xs text-muted` |
| `common.eyebrow`, `card.kicker` | `font-utility text-[11px] font-semibold tracking-[0.9px] text-muted` |
| `common.pageTitle` | `font-display text-[28px] font-bold tracking-[-0.5px] text-ink` |
| `common.pageHeader` | `gap-1 px-4 pt-5 pb-2` |
| `common.alert` | `border-l-[3px] border-l-signal bg-danger-pale px-[11px] py-[9px] text-xs leading-[18px] text-danger-ink` |
| `card.section` | `mx-4 mt-4 gap-2 rounded-lg border border-card-line bg-paper p-5 shadow-[0_8px_18px_rgba(29,55,57,0.06)]` |
| `card.title` | `font-display text-[22px] font-bold tracking-[-0.4px] text-ink` |
| `form.content` | `gap-2 p-5` |
| `form.label` | `mt-2.5 text-xs font-semibold text-ink-soft` |
| `form.hint` | `text-[11px] text-hint` |
| `form.input` | `rounded border border-control-border bg-input px-[11px] py-2.5 text-[14px] text-ink` |
| `form.multiline` | `min-h-24` + top-aligned text (see open questions) |
| `form.error` | `mt-2 text-xs text-danger-ink` |
| `form.actions` | `mt-[26px] flex-row gap-[9px] border-t border-line-soft pt-[18px]` |
| `fonts.utility` / `fonts.display` | `font-utility` / `font-display` |
| `fontVariant: ["tabular-nums"]` | `tabular-nums` (checked on the phone) |

The card's old shadow was `shadowColor #1d3739`, opacity 0.06, radius 18, offset 0/8, `elevation: 1`. The `shadow-[…]` class above is its `boxShadow` equivalent. Uniwind has a `boxShadow` parser; check it on Android.

## Order of work

One commit per step. Run `npx tsc --noEmit` in `mobile/` after each.

1. `src/ui/classes.ts`.
2. `src/ui/`: `Button`, `ChipGroup`, `Fab`, `Sheet`, `ScreenHeader`, `DateTimeField`, `OptionalDateField`, `IconPicker`, `ColorPicker`, `ColorDot`, `LogoMark`, `NamedIcon`. Every screen uses these, so they go first.
3. `src/features/`: time, bibliography, expenses, tabs, tasks (`ProjectTasks` uses `react-native-reorderable-list` and gesture-handler; check its row and handle styling), accounts (`AuthCard`).
4. `app/(tabs)/` screens, then the stack and modal screens in `app/`. `app/(tabs)/_layout.tsx` and `app/_layout.tsx` keep their navigation colours in JS (decision 2).
5. Clean up: trim `src/theme.ts` (decision 5), then grep that no `makeStyles`, `StyleSheet`, `useStyles` or `fonts.` remains outside `theme.ts`.
6. Docs: in `AGENTS.md`'s mobile section, replace the `StyleSheet`/`makeStyles` description and the prototype note with the Uniwind setup and decisions 1–7.

## Open questions

- **`textAlignVertical: "top"`** for multiline inputs (`form.multiline`): no Uniwind mapping turned up in a quick look. Try `align-top` and check the compiled bundle (below). If it does not map, pass `textAlignVertical="top"` as a prop where RN accepts it, or keep a one-line `style`.
- **Card shadow on Android** (see above).

## Verifying

- `just check` from the repo root. It covers mobile `tsc`, oxlint and `expo export`.
- To check that a class compiled, export a plain JS bundle and search it. A class that compiled appears as a key with its RN style entries:
  `cd mobile && npx expo export --platform android --no-bytecode --output-dir /tmp/uniwind-js`, then search the `.js` under `/tmp/uniwind-js/_expo/static/js/android/` for `"<class>":`. A missing key means Tailwind did not generate the class: a dynamic name, a typo, or an unregistered theme value.
- On a phone (`just backend-lan` + `just mobile`), look at every tab and editor in at least light, dark, one custom theme (e.g. Sepia or Mocha) and "Systemowy". Check that a theme switch repaints at once, pressed states work, and the fonts are right on Android and iOS.

## Comments

- 2026-10-31, agent: done on `feat/uniwind`, one commit per step. Notes:
  - `align-top` compiles to `verticalAlign: top`, React Native's Android equivalent of `textAlignVertical`; `form.multiline` is a full input string with it.
  - The card's `shadow-[0_8px_18px_rgba(29,55,57,0.06)]` compiles; still to check on Android.
  - A theme colour with opacity (`shadow-deep-ink/25`) does not resolve the variable, so the Fab keeps its shadow in `style` with `colors.deepInk`.
  - `Button` takes a `className` (default `flex-1`) instead of `style`; `flex-none` replaces the old `flex: 0`.
  - The tab bar's react-navigation options moved into `src/theme.ts` as `tabOptions`, next to `headerOptions`, so `fonts` stays private there. `useTheme()` returns `{ name, scheme, colors, headerOptions, tabOptions }`.
  - Every class used in `app/` and `src/` was found in the exported Android bundle.

