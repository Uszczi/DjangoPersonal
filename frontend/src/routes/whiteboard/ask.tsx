import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  Button,
  ErrorAlert,
  Field,
  LoadingStatus,
  PageHeader,
  TextArea,
} from "@/design-system";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  ResponseError,
  type NoteSource,
  type NotesAnswer,
} from "@personal/shared/generated/api";

export const Route = createFileRoute("/whiteboard/ask")({
  component: AskNotesPage,
});

const UNAVAILABLE =
  "Model nie jest teraz dostępny. Sprawdź, czy działa Ollama i czy w .env jest ustawiony LLM_MODEL.";

type Asking =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "done"; question: string; answer: NotesAnswer }
  | { status: "error"; message: string; detail?: string };

/**
 * Questions about the Notatki, answered from their Chunks. The server finds the
 * fragments and the model writes the answer, citing them as [1], [2]; the cited
 * fragments are listed under it with a link to their Notatka.
 */
function AskNotesPage() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState<Asking>({ status: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const q = question.trim();
    if (q === "" || asking.status === "loading") return;
    setAsking({ status: "loading", question: q });
    try {
      const answer = await api.notesAsk({ askNotesRequest: { question: q } });
      if (mounted.current) setAsking({ status: "done", question: q, answer });
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ResponseError && error.response.status === 503) {
        setAsking({
          status: "error",
          message: UNAVAILABLE,
          detail: await apiErrorMessage(error),
        });
      } else {
        setAsking({
          status: "error",
          message: "Nie udało się zadać pytania. Spróbuj ponownie.",
        });
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Zapytaj Notatki"
        subtitle="Odpowiedź powstaje tylko z Twoich Notatek, z odnośnikami do fragmentów, z których pochodzi."
      />
      <form
        className="flex max-w-[720px] flex-col gap-3"
        onSubmit={(e) => void ask(e)}
      >
        <Field label="Pytanie" hint="Enter wysyła, Shift+Enter to nowa linia.">
          <TextArea
            rows={2}
            maxLength={1000}
            placeholder="Np. kiedy kończy się ubezpieczenie samochodu?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask();
              }
            }}
          />
        </Field>
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={question.trim() === "" || asking.status === "loading"}
          >
            Zapytaj
          </Button>
        </div>
      </form>
      <div className="mt-6 max-w-[720px]">
        <Result asking={asking} />
      </div>
    </>
  );
}

function Result({ asking }: { asking: Asking }) {
  if (asking.status === "idle") return null;
  if (asking.status === "loading") {
    return (
      <LoadingStatus variant="inline">
        Szukam w Notatkach i piszę odpowiedź… Lokalny model może potrzebować
        nawet kilku minut.
      </LoadingStatus>
    );
  }
  if (asking.status === "error") {
    return (
      <ErrorAlert>
        {asking.message}
        {asking.detail ? (
          <span className="mt-1 block text-[12px] opacity-80">
            {asking.detail}
          </span>
        ) : null}
      </ErrorAlert>
    );
  }
  const { answer } = asking.answer;
  const sources = asking.answer.sources;
  return (
    <section aria-label="Odpowiedź" className="flex flex-col gap-5">
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">
        <AnswerText text={answer} sources={sources} />
      </p>
      {sources.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-[15px] font-bold text-ink">
            Źródła
          </h2>
          <ol className="flex flex-col gap-3" aria-label="Źródła">
            {sources.map((source) => (
              <SourceCard key={source.number} source={source} />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

const CITATION = /\[(\d+)\]/g;

/** The answer with each cited [n] as a button that brings its source into view. */
function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: NoteSource[];
}) {
  const numbers = new Set(sources.map((s) => s.number));
  const parts: (string | number)[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1]);
    if (!numbers.has(n)) continue;
    parts.push(text.slice(last, match.index), n);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));

  return parts.map((part, i) =>
    typeof part === "number" ? (
      <button
        key={i}
        type="button"
        className="mx-px cursor-pointer align-super text-[11px] font-bold text-accent hover:underline"
        aria-label={`Źródło ${part}`}
        onClick={() =>
          document
            .getElementById(sourceId(part))
            ?.scrollIntoView?.({ behavior: "smooth", block: "nearest" })
        }
      >
        [{part}]
      </button>
    ) : (
      part
    ),
  );
}

function sourceId(n: number) {
  return `zrodlo-${n}`;
}

function SourceCard({ source }: { source: NoteSource }) {
  return (
    <li
      id={sourceId(source.number)}
      className="rounded-lg border border-line bg-surface p-3"
    >
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[12px] font-bold text-accent">
          [{source.number}]
        </span>
        <span className="mr-auto text-[13px] font-semibold text-ink-soft">
          {source.heading}
        </span>
        <Link
          to="/whiteboard/$boardId"
          params={{ boardId: String(source.whiteboardId) }}
          className="shrink-0 text-[13px] text-accent hover:underline"
        >
          Otwórz notatkę
        </Link>
      </div>
      <MarkdownPreview
        markdown={source.text}
        className="text-[14px] text-ink"
      />
    </li>
  );
}
