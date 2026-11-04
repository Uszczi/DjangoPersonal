# 0001: UUIDv7 primary keys for every table

Status: accepted, 2026-11-04.

## Context

The clients are going to work offline and sync later (`docs/research/offline-sync.md`). An offline client has to name the rows it creates: a Task added on the train has to be the target of the timer started a minute later, before the server has seen either. With integer ids assigned by the database, the client would need temporary ids and a remapping step in its queue and cache, or a second `client_id` column on every table that can be created offline, with every reference accepting both.

## Decision

Every table's primary key is a UUID, and so is every foreign key. This covers all tables: `users`, the settings tables keyed by `user_id`, and `note_chunks` too, so the schema has one kind of id.

- **UUIDv7** (RFC 9562), made with `uuid.uuid7()` from the standard library (Python 3.14). Its leading bits are a millisecond timestamp, so ids sort in creation order. The queries that break ties by `id` (Tasks by `position, id`, Transactions by `date, id`, and others) keep their order, and Postgres's B-tree index stays append-mostly.
- The model assigns the id when it is built (`Base.__init__` fills column defaults), so a new row's id is known before the flush.
- The column type is SQLAlchemy's `Uuid`: native `uuid` on Postgres, `CHAR(32)` on SQLite.
- The API, the MCP tools and the clients carry ids as UUID strings.

Accepting ids chosen by the client on create is the next step of the offline work and is not part of this decision. When it comes, the server must treat such an id as input: a repeat create by the same user returns the existing row, and an id that belongs to another user gets a generic error that does not reveal the row exists.

## Consequences

- One breaking release: API, web and mobile change together. A mobile build from before the change stops working until it is updated. Signed-in sessions end (the JWT `sub` was an integer), and so do MCP OAuth tokens stored with an integer user id.
- The migration (`0025_uuid_primary_keys`) rebuilds the schema: it reads every row, drops the tables, recreates them with UUID keys and writes the rows back with mapped ids. Ids are generated in the old id order, so existing rows keep their relative order. It is irreversible; the pre-deploy dump is the way back. Local SQLite databases can simply be recreated.
- `note_chunks` are not copied. They are derived data: `IndexNote` rebuilds a Notatka's chunks the next time a question is asked about it.
- Clients persist ids (the query cache, the selected Wallet and Project): `CACHE_VERSION` is bumped and the persisted selection stores ignore values that are not UUIDs.
- Ids are longer in URLs (`/projects/0195…`), which nobody types.
