# Working offline and syncing later

Research for the task "Jak uruchamiać licznik nawet bez internetu i synchronizować później". The ask: start the timer without a connection and sync it later, using a general approach that later also covers adding and editing Tasks offline.

Status: step 1 (timer offline) implemented 2026-11-05, with the open questions settled as: an `at` up to 7 days old, a refused queued write is dropped with a message, Discard is queued too, and the web gets the same code as mobile. Written 2026-11-04.

## Where the app is today

- **Reads already survive offline.** Both clients persist the TanStack Query cache for 24 h (`packages/shared/src/queries/persist.ts`). A cold start without a network paints the last data.
- **Writes do not.** Every mutation is a plain `useMutation` that calls the generated client. Offline it fails (or, under TanStack Query's default `networkMode: "online"`, pauses until the process dies). Paused mutations are not persisted, there are no mutation keys or `setMutationDefaults`, and nothing resumes them after a restart.
- **The server owns time and ids.** `StartTimer`/`StopTimer` stamp `clock.now()` on the server (`core/work/handlers/timer.py`). `TimerStartRequest` has no start time, and every id is a server-assigned integer (to become a UUIDv7, see `docs/adr/0001-uuid-primary-keys.md`). So a write made offline cannot say *when* it happened, and the client cannot name a Task it created offline.
- **PATCH is already field-level** (`apply_provided`). That is the property that makes "last writer wins per field" an acceptable conflict rule for this app: one user, a few devices, rare concurrent edits.

## The options

### 1. TanStack Query offline mutations (queue in the client)

TanStack Query v5 has built-in support for this:

- `onlineManager`. On the web it follows `navigator.onLine`. On React Native it has to be fed from `@react-native-community/netinfo` (`onlineManager.setEventListener`).
- Mutations with a `mutationKey` and their `mutationFn` registered once through `queryClient.setMutationDefaults(key, …)`. Functions are not serialisable, so a mutation restored from storage finds its function by key.
- `PersistQueryClientProvider` already persists the cache. By default it also dehydrates **paused** mutations. Calling `queryClient.resumePausedMutations()` in its `onSuccess` replays them after a restart.
- `onMutate` writes the optimistic result into the cache, so the UI shows the change at once. `onSettled` invalidates and refetches.

Cost: small, fits the current stack, no new backend concepts. Limits:

- It replays *requests*, not *intent*. A request that depended on the result of an earlier offline request breaks without extra work. For example, "create Task, then start its timer" needs the new Task's id.
- A replayed request still runs on the server at replay time. Without a client-supplied timestamp, an offline timer starts when the phone reconnects, not when the user tapped Start.
- A lost response (request reached the server, phone lost signal before the answer) is retried and runs twice unless the server deduplicates.

### 2. Outbox of operations with idempotency (recommended direction)

This is option 1 with three server-side additions that make replay safe. It is the general pattern behind most "offline first" REST apps:

1. **Client-generated ids.** Each new row gets a UUID made on the device and sent on create. Later operations, such as starting a timer on a Task created offline, refer to the UUID, so the queue needs no id remapping. Decided in `docs/adr/0001-uuid-primary-keys.md`: every primary key is a UUIDv7 (instead of a separate `client_id` column), so what is left for offline work is accepting the client's id in the create contracts.
2. **Idempotency keys.** Every queued write carries an `Idempotency-Key` header, a UUID per operation. The server stores `(user_id, key) → response` for a day and answers a repeat with the stored response, so retries after a lost response are harmless. This is a small table plus one FastAPI dependency. The MCP server does not need it.
3. **Client time for time-based actions.** `TimerStartRequest` and the stop call accept an optional `at` (when the user pressed the button). The handler validates it: not in the future beyond a small skew, not before the previous entry's end, not older than e.g. 24 h. The existing `serverOffset` already gives the client its offset from the server clock to correct `at`. For the timer this is the crucial change: start offline at 9:00, sync at 9:40, and the entry still starts at 9:00.

Conflict rule: per-field last-writer-wins, as today's PATCH already behaves. Optionally reject a PATCH whose `If-Unmodified-Since`/`updated_at` is older than the row's, to surface a conflict instead of overwriting silently. This is only worth it for long text fields (Task description, Notatki).

What the client gains:

- An **outbox** (the persisted paused mutations from option 1), drained in order when `onlineManager` reports online and on app start.
- A visible **"N zmian czeka na wysłanie"** indicator, so the user knows the phone holds unsynced work.
- An optimistic cache that already shows the offline Task or running timer.

Timer-specific notes:

- The running timer is already a single server row. Offline Start creates it optimistically in the `timerQuery` cache with `start = now + serverOffset`. Offline Stop sets `end`. If both are queued, they replay as start(at) then stop(at), or they could collapse into one create of a closed entry.
- The limit notification (`TimerNotificationSync`) and the running-timer notification work from the cache, so they keep working offline.
- If two devices both start a timer offline, the later `at` wins on sync and the earlier one is closed at the later start, which is what `switch` already does.

### 3. A sync engine with a local database

Products: PowerSync (SQLite on the device, sync from Postgres), ElectricSQL, Zero/Replicache, WatermelonDB, RxDB, Triplit. The client reads and writes a local database, and the engine syncs changes in both directions.

- Pros: full offline for every screen, live queries, conflict handling designed in.
- Cons: a second data layer next to the generated API client. Each read hook would move from the REST API to local queries. Most engines need a sync service or a write-back endpoint, and some want logical replication from Postgres. The per-user scoping rules that now live in repositories must be expressed again as sync rules. This rewrites the client data layer, which is a lot for one user's organizer.

### 4. CRDTs (Yjs, Automerge)

These merge concurrent edits of one document without conflicts. They fit the **Whiteboards and Notatki** (free text, edited from two devices), not rows like Tasks or time entries. If offline note editing ever matters, a Yjs document per Notatka synced through a small endpoint would sit next to option 2, not replace it.

## Recommendation

Go with **option 2, built on option 1's machinery**, in small steps:

1. **Timer offline (first slice).** Add `onlineManager` + NetInfo on mobile. Give the timer start/stop/discard mutations keys, defaults and optimistic `onMutate`. Accept an optional `at` in the timer endpoints. Add the `Idempotency-Key` table and dependency. Show the pending count in the timer card.
2. **Tasks offline.** Accept the client's UUID on Task create, plus create/update/move/toggle through the outbox. Field-level PATCH stays last-writer-wins.
3. **The rest as needed.** Transactions and counter entries follow the same recipe (each create accepts the client's UUID).
4. Revisit a sync engine (option 3) only if most screens need to work offline. Revisit CRDTs (option 4) only for offline Notatki.

Open questions before step 1:

- How old an offline `at` should the server accept (24 h?), and what should a queued operation do when it is refused (drop it with a message, or keep it for manual review)?
- Web too, or mobile only? The web gets the same code through `packages/shared`, but going offline matters mostly on the phone.
- Should Delete be queued offline as well? It is the riskiest one to replay late.

## Sources

- TanStack Query v5 docs: "Network Mode", "Mutations → Persisting Offline mutations", `onlineManager`, `persistQueryClient` (`resumePausedMutations`).
- Stripe's and the IETF draft "The Idempotency-Key HTTP Header Field" for idempotency keys.
- PowerSync, ElectricSQL, Zero, WatermelonDB documentation, for the local-database sync engines.
- Yjs and Automerge documentation, for CRDT documents.
