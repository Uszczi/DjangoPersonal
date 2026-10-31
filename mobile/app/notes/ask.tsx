import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@personal/shared/api";
import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  ResponseError,
  type NoteSource,
  type NotesAnswer,
} from "@personal/shared/generated/api";

import { Button } from "@/ui/Button";
import { common, form } from "@/ui/classes";
import { MarkdownView } from "@/features/notes/MarkdownView";

const UNAVAILABLE =
  "Model nie jest teraz dostępny. Sprawdź, czy działa Ollama i czy w .env jest ustawiony LLM_MODEL.";

type Asking =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; answer: NotesAnswer }
  | { status: "error"; message: string; detail?: string };

const CITATION = /\[(\d+)\]/g;

/** The answer with each cited [n] in the accent colour, like the web's links to sources. */
function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: NoteSource[];
}) {
  const numbers = new Set(sources.map((source) => source.number));
  const parts: (string | number)[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    const n = Number(match[1]);
    if (!numbers.has(n)) continue;
    parts.push(text.slice(last, match.index), n);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return (
    <Text className="text-[15px] leading-6 text-ink">
      {parts.map((part, index) =>
        typeof part === "number" ? (
          <Text key={index} className="text-[12px] font-bold text-accent">
            [{part}]
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function SourceCard({ source }: { source: NoteSource }) {
  return (
    <View className="gap-2 rounded-lg border border-line bg-surface p-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-[12px] font-bold text-accent">
          [{source.number}]
        </Text>
        <Text className="flex-1 text-[13px] font-semibold text-ink-soft">
          {source.heading}
        </Text>
      </View>
      <MarkdownView markdown={source.text} />
      <Pressable
        accessibilityRole="link"
        hitSlop={8}
        onPress={() =>
          router.push({
            pathname: "/notes/[id]",
            params: { id: source.whiteboardId },
          })
        }
        className="self-start active:opacity-60"
      >
        <Text className="text-[13px] font-semibold text-accent">
          Otwórz notatkę
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Questions about the Notatki, answered from their Chunks: the server finds
 * the fragments and the model writes the answer, citing them as [1], [2]; the
 * cited fragments are listed under it with a way to their Notatka.
 */
export default function AskNotesScreen() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState<Asking>({ status: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function ask() {
    const q = question.trim();
    if (q === "" || asking.status === "loading") return;
    setAsking({ status: "loading" });
    try {
      const answer = await api.notesAsk({ askNotesRequest: { question: q } });
      if (mounted.current) setAsking({ status: "done", answer });
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
    <KeyboardAvoidingView
      className={common.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="gap-3 p-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-xs text-muted">
          Odpowiedź powstaje tylko z Twoich Notatek, z odnośnikami do
          fragmentów, z których pochodzi.
        </Text>
        <TextInput
          className={form.multiline}
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={1000}
          placeholder="Np. kiedy kończy się ubezpieczenie samochodu?"
          placeholderTextColorClassName="accent-hint"
          accessibilityLabel="Pytanie"
        />
        <View className="flex-row">
          <Button
            label="Zapytaj"
            className="flex-none"
            disabled={question.trim() === ""}
            isBusy={asking.status === "loading"}
            onPress={() => void ask()}
          />
        </View>
        {asking.status === "loading" && (
          <View className="flex-row items-center gap-2 pt-2">
            <ActivityIndicator colorClassName="accent-muted" />
            <Text className="flex-1 text-xs text-muted">
              Szukam w Notatkach i piszę odpowiedź… Lokalny model może
              potrzebować nawet kilku minut.
            </Text>
          </View>
        )}
        {asking.status === "error" && (
          <Text className={common.alert}>
            {asking.message}
            {asking.detail ? `\n${asking.detail}` : ""}
          </Text>
        )}
        {asking.status === "done" && (
          <View className="gap-4 pt-2">
            <AnswerText
              text={asking.answer.answer}
              sources={asking.answer.sources}
            />
            {asking.answer.sources.length > 0 && (
              <View className="gap-3">
                <Text className="font-display text-[15px] font-bold text-ink">
                  Źródła
                </Text>
                {asking.answer.sources.map((source) => (
                  <SourceCard key={source.number} source={source} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
