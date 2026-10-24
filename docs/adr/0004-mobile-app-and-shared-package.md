# A React Native (Expo) app sharing one package with the web frontend

The web SPA is the only client. A native phone app was wanted, partly to learn React Native. The frontend's stores and API client hold most of the client logic (ordering, optimistic updates, the JWT refresh middleware), and none of it touches the DOM except two spots: `api.ts` used relative URLs (the Vite proxy / nginx), and the auth store persisted to `localStorage`. We turned the repository into an npm workspaces monorepo with three workspaces:

```
packages/shared/   @personal/shared: generated API client, `api`, `platform`, domain stores, pure helpers (TS sources, no build)
frontend/          the web SPA (Vite) — imports @personal/shared, keeps its own UI and web-only stores
mobile/            the Expo (Expo Router) app — imports @personal/shared, its own React Native UI
```

`configurePlatform({ apiBaseUrl, storage })` in `packages/shared/src/platform.ts` is the only seam: the web keeps the defaults (same origin, `localStorage`); the mobile app sets the backend origin and an `expo-secure-store` adapter at startup, then rehydrates the auth store.

Status: accepted

Considered Options:

- **A separate Expo project with its own copy of the client and stores**: rejected; the store logic would drift between two copies.
- **One codebase with react-native-web replacing the web frontend**: rejected; Tailwind, the design system, dnd-kit, Konva and Storybook do not carry over, so it is a rewrite of a working app.
- **Capacitor / PWA around the existing SPA**: rejected; cheapest, but not native UI, and learning React Native is a goal.
- **Vanilla (`zustand/vanilla`) stores bound per app**: not done; the web code uses the hook stores everywhere, and pinning one React version gives a single React copy anyway.

Consequences:

- One root `package-lock.json`; `npm install` runs at the repository root. `overrides` live in the root `package.json` (npm ignores them in workspaces).
- React is pinned to the exact version the Expo SDK requires (`19.3.0` for SDK 58) in both apps, so the workspace has one React copy. An Expo SDK upgrade bumps React for the web too.
- The generated client lives in `packages/shared/src/generated/api/`; `just generate-api` writes there.
- The frontend Docker image installs only the `frontend` workspace (`npm ci --workspace frontend`), so the Expo toolchain stays out of it; it still needs every workspace's `package.json` in the build context.
- Web-only code stays in `frontend/`: the layout and modal stores, the whiteboard store (Konva has no React Native renderer), and anything using `localStorage` directly or the router.
