Status: ready-for-agent

# Mobile App (React Native)

## Problem Statement

DjangoPersonal can only be used from a browser. On a phone the web SPA works, but it is not a native app: no home-screen app with native navigation, and the browser layout is built for a desktop sidebar. The user also wants to learn React Native on a real project, the way `cpp_backend/` is used for learning C++.

## Solution

Add a third client, a React Native app built with Expo, in `mobile/`. The web frontend and the mobile app share one TypeScript package, `packages/shared`, which holds everything that does not touch the DOM: the generated API client, the configured client with the JWT middleware, the domain Zustand stores, and pure helpers. Each app writes its own UI. The repository becomes an npm workspaces monorepo (`frontend`, `mobile`, `packages/*`).

## User Stories

1. As the user, I want to sign in on my phone with my existing account, so that I see the same data as on the web.
2. As the user, I want to stay signed in after closing the app, so that I do not log in every time.
3. As the user, I want my tokens kept in the phone's secure storage, so that they are not stored as plain text.
4. As the user, I want to see my Projects, with the Inbox first, so that I can pick one.
5. As the user, I want to see a Project's Tasks, so that I can check what is left.
6. As the user, I want to mark a Task done (or reopen it) from the phone.
7. As the user, I want to sign out on the phone.
8. As the developer, I want one copy of the API client and the store logic, so that the web and mobile apps cannot drift apart.

## Implementation Decisions

- npm workspaces at the repository root; one root `package-lock.json`. The frontend Docker build installs only the `frontend` workspace and its dependencies.
- `packages/shared` (`@personal/shared`) ships TypeScript sources (no build step); Vite, Vitest, `tsc` and Metro read them directly through the package `exports`.
- The generated client moves to `packages/shared/src/generated/api/`; `just generate-api` writes there.
- `configurePlatform({ apiBaseUrl, storage })` is the single seam between the shared code and its host. The web app keeps the defaults (relative URLs, so the Vite proxy applies; `localStorage`). The mobile app sets the backend URL and an `expo-secure-store` storage, then rehydrates the auth store.
- Shared: generated client, `api`, `apiErrorMessage`, `money`, `counterFormat`, `loadGuard`, and the stores `auth`, `projects`, `tasks`, `timer`, `categories`, `counters`, `transactions`, `wallets`. Web-only (they depend on the DOM, the router or the whiteboard): `layout`, `modal`, `whiteboards`, `counterViewMode`, `lastProject`, `projectSearch`, the icon and colour maps.
- The mobile app uses Expo Router (file-based, like TanStack Router on the web) and plain `StyleSheet` for now; a mobile design system is a later step.
- React is pinned to the version Expo SDK requires, in both apps, so the workspace has one React copy.
- The backend needs no changes. During development the phone reaches it over the LAN (`just backend-lan`, with the machine's IP in `ALLOWED_HOSTS`).

## Out of Scope (for now)

- Whiteboards (Konva has no React Native renderer), expenses, counters and the timer screens on mobile.
- Store builds (EAS), push notifications, offline mode.
