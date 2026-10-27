# Answering questions about Notatki: any OpenAI-compatible model, two guards against making things up

`POST /api/v1/notes/ask/` (`notes_ask`) and the MCP tool `ask_notes` answer a question from the user's Notatki. `AskNotes` (`core/notes_qa/handlers/ask.py`) indexes the Notatki first (ADR 0006), finds the 5 closest Chunks, drops those scoring below `NOTES_MIN_SCORE`, and asks the answer model. The reply carries `sources`, the Chunks it cites as `[n]`.

- **Any OpenAI-compatible chat API**: the `AnswerGenerator` port has one adapter, `infra/llm.py`, for `/chat/completions`. `LLM_BASE_URL` (default Ollama's `http://localhost:11434/v1`), `LLM_MODEL` and `LLM_API_KEY` pick the model, local or hosted, without a code change. No model is built in. With `LLM_MODEL` unset, questions fail with 503 and everything else keeps working.
- **Guard 1, a score threshold**: Chunks below `NOTES_MIN_SCORE` (0.65) never reach the model. With none left, the answer is "Nie znalazłem tego w Notatkach." and the model is not called. 0.65 was measured with `embeddinggemma-2:270m` on the seeded Notatki. Questions they answer scored 0.68–0.82 on their best Chunk, and questions they do not answer scored 0.59–0.63. The exception is "Jak skonfigurować Kubernetes?", which scored 0.705 against the VPS Notatka. Hence:
- **Guard 2, the prompt** (`core/notes_qa/prompt.py`): answer only from the fragments, cite them, and reply exactly "Nie znalazłem tego w Notatkach." when they do not hold the answer. The prompt lives in the core, not in the adapter, so the rules stay the same for every model.
- **Fragments are data**: each Chunk goes inside `<fragment numer=… tytul=…>`, with `<`, `&` and `"` escaped so a Chunk cannot close its tag. The system prompt says that instructions inside fragments are not to be followed. This lowers the risk of prompt injection through pasted text. It does not remove it.
- **Sources are the cited Chunks**: only the Chunks the answer cites as `[n]` are returned, under the same numbers. An answer without citations gets no sources. Bielik often declines in its own words ("Nie znalazłem informacji na temat konfiguracji Kubernetes w podanych fragmentach.") instead of the exact phrase, and listing the fragments it rejected would present them as the answer's grounds.

Status: accepted

Considered Options:

- **The native Ollama `/api/chat`**: rejected. It is local models only, so a hosted model would need a second adapter. Ollama serves the OpenAI-compatible API too.
- **A provider SDK (Anthropic, OpenAI)**: not now. It would tie the code to one vendor. The port allows a native adapter later, if a provider's own features (prompt caching, say) become worth it.
- **Only a threshold, or only the prompt**: rejected. The score says "close", not "contains the answer", and a model told to refuse still has to see something to refuse.
- **Threshold per question (relative to the best score)**: not yet. Decide it with the evaluation set, together with the model and `k`.

Consequences:

- The request holds its database transaction (and connection) while the model writes, which can take minutes for a local model on a CPU (`LLM_TIMEOUT_SECONDS`, default 300). Nginx proxies `/api/` with its default 60 s read timeout, so a slow model behind the deployed API would time out at the proxy. Raise `proxy_read_timeout` for `/api/notes/` when a model is deployed.
- `NOTES_MIN_SCORE` belongs to the embedding model. Changing `EMBEDDING_MODEL` means measuring it again.
- Chunks that are only code (the Git and Docker commands in the seed) clear the threshold for unrelated questions about servers. They cost prompt space, not correctness. The evaluation set should track this.
- No web UI yet: the generated client has `notesAsk`, nothing calls it.
