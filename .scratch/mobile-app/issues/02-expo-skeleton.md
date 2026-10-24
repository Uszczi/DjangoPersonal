Status: done

# 02: Expo app skeleton

**What to build:** An Expo (Expo Router) app in `mobile/` that signs in, lists Projects, shows a Project's Tasks, toggles a Task's status, and signs out, all through `@personal/shared`.

**Blocked by:** 01

- [x] `just mobile` starts the Expo dev server; `just backend-lan` serves the API on the LAN.
- [x] Sign in and stay signed in across restarts (tokens in `expo-secure-store`).
- [x] Projects list (Inbox first) and a Project's Tasks list.
- [x] Toggling a Task's status from the list.
- [x] Sign out.
- [x] `tsc --noEmit` passes and `expo export` bundles the app.

## Implementation notes

- Verified: `tsc --noEmit`, `expo install --check`, `expo export` for Android and iOS. The shared stores were also run end to end against a temporary backend outside a browser (login, persisted tokens, projects, task toggle, token refresh after a 401, rehydrate, logout). Not yet run on a device.
- The auth gate uses `Stack.Protected` on `user`, like the web guard.
- `npm audit` reports 5 high advisories, all in the Expo CLI dev tooling (`node-forge`, `zod` under `@expo/cli`); nothing in the app bundle. The suggested fix downgrades Expo, so it was not applied.
