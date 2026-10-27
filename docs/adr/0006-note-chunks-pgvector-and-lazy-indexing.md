# Note chunks: embedded with a local model, ranked by pgvector, indexed lazily

Answering questions about Notatki needs their Chunks embedded and the ones closest to a question found. The pieces are libraries, the shape is ours: `langchain-text-splitters` cuts the Markdown (`core/notes_qa/chunking.py`), but there is no LangChain or LlamaIndex pipeline. The use cases see an `Embedder` port (`core/notes_qa/ports.py`) and `NoteChunkRepository`, like every other feature.

- **Embedding model**: EmbeddingGemma 2 (`embeddinggemma-2:270m` by default, `EMBEDDING_MODEL`) served by Ollama (`OLLAMA_URL`), through `infra/ollama.py` over `httpx2`. It runs on a CPU, has an 8192-token window and is Apache 2.0. The model is trained with prefixes (`title: {heading} | text: {chunk}` for Chunks, `task: search result | query: {question}` for questions); the adapter adds them, so the core never sees them. Polish quality is not documented by Google; the evaluation set decides between this, its bigger variants and `bge-m3`.
- **Storage**: table `note_chunks` (migration `0013`), one row per Chunk with its `content_hash`, `embedding_model` and `embedding`. The embedding is a pgvector `vector` on Postgres and JSON on SQLite. Postgres ranks in the database (`ORDER BY embedding <=> :query LIMIT k`), so only the `k` best Chunks leave it. SQLite has no vector type; local dev and the tests load the user's Chunks and compute the same cosine in numpy (`NoteChunkRepository.search`).
- **No fixed dimension, no approximate index**: the column is `vector`, not `vector(768)`, so switching models needs re-indexing, not a migration. HNSW requires a fixed dimension, so Postgres compares every Chunk of the user: exact, and fast enough at the size of one person's Notatki. `search` filters by `embedding_model` first, because vectors from different models are not comparable and `<=>` fails on different dimensions.
- **Lazy indexing**: `IndexNote` runs before a question, not when a Notatka is saved. The editor autosaves on every pause, so indexing on save would embed text that is about to change again. The common case, nothing changed, costs one query for the stored hashes (`hashes_for`, no vectors). When something did change, only Chunks with a new hash are embedded. The hash covers the heading, so renaming a Notatka re-embeds it, because the name is part of every Chunk's title.

Status: accepted

Considered Options:

- **A RAG framework (LangChain, LlamaIndex)**: rejected. It would own the pipeline, its storage and its prompts. Here the steps are small, the project's ports and repositories already give the seams, and learning how retrieval works is part of the point.
- **Vectors in JSON everywhere, cosine in numpy**: the first version. It loads every Chunk of the user into memory for each question. That is fine for a few hundred Chunks, but pgvector costs one extension and keeps the work in the database.
- **One code path, tests on Postgres**: rejected for now. The suite runs on throwaway SQLite databases and CI has no Postgres. The repository tests run on both databases when `TEST_POSTGRES_HOST` is set; CI does not set it yet.
- **Indexing on save (in `UpdateWhiteboard`)**: rejected because of autosave, see above. It would also make every save wait for the model, or fail when Ollama is down.
- **A hosted embedding API**: not now. Notatki are private, and a local model costs nothing per call. The `Embedder` port allows one later.

Consequences:

- The Postgres image is `pgvector/pgvector:pg17-trixie`, not `postgres:17`. The `-trixie` tag matches the Debian (and glibc) of the current `postgres:17`. A different glibc under an existing data volume can change text collation and silently break indexes. Check the Debian of the running container before deploying (`grep PRETTY /etc/os-release` inside it); if it is bookworm, use `pgvector/pgvector:pg17`.
- `CREATE EXTENSION vector` needs a superuser. The image's `POSTGRES_USER` is one.
- The deployed stack has no Ollama yet. Questions need one reachable at `OLLAMA_URL`.
