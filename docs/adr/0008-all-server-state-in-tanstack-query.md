# All server state in TanStack Query, on the web and on mobile

ADR 0005 moved one domain, a Wallet's transactions, to TanStack Query on the web and left the rest for later. Every other domain still had a hand-written Zustand store in `@personal/shared` with its own load guard, `isLoading`/`pageError` pair and post-write list surgery, and stores reached into each other (`tasks` read `useProjectsStore.getState()`, `wallets` reloaded `useTransactionsStore`).

Now all server state lives in TanStack Query, in both clients. The hooks are in `packages/shared/src/queries/<domain>.ts` (categories, projects, tasks, timer, wallets, transactions, counters), imported as `@personal/shared/queries/<domain>`; the Notatnik's (folders, whiteboards) are web-only, in `frontend/src/queries/`. Each module exports a `queryOptions` definition, a `useX()` read hook and one mutation hook per write. Every query key is in `queries/keys.ts`, so a write in one domain can invalidate another's cache (a deleted Category invalidates the transactions and the wallets) without the modules importing each other. `createQueryClient()` (`queries/client.ts`) sets the shared defaults and clears the cache when the signed-in user changes; each app makes one client from it and provides it at its root.

Status: accepted

Considered Options:

- **Keep the stores in `@personal/shared` and move only the web**: rejected. The ADR 0004 rule is one implementation of the domain logic for both clients; a web-only move would have duplicated every domain.
- **Refetch after every write**: used only where the client cannot know the result: a stopped timer and manual entries (the server decides the recorded entry), a reordered Project or Task (the server renumbers the neighbours), a Wallet balance correction, a Counter's totals. Elsewhere the mutation writes the server's answer into the cached list, as the stores did.
- **Order lists in `select`**: done for Projects and Tasks, whose order depends on other data (the Inbox flag, the Project's statuses); the cache holds the list as the server sent it.

Consequences:

- Zustand keeps only client state: `auth`, the web's `layout`, `modal` and `projectSelection` (restore the remembered Project once per session), and the shared `walletSelection` (the Wallet `/expenses` shows). Page-level action errors and the timer's entry editor are component state.
- `staleTime` is 30 s: a page shown again within it reuses the cache instead of asking the server. The stores refetched on every mount; tests that counted those requests were updated.
- Load-failure wording is in `@personal/shared/loadErrors`, since a query only reports `isError`.
- Mobile refetches on returning to the app through `focusManager` + `AppState` (`mobile/src/queryClient.ts`), and on returning to a tab through `useRefreshOnFocus` where the screen used to reload in `useFocusEffect`. Its transaction list is the shared infinite query; "Pokaż więcej" calls `fetchNextPage`.
- The whiteboard editor still loads and autosaves one board by hand (`useLoadedBoard`, `useAutosave`, `useLoadGuard`); only the Notatnik's list is a query.
