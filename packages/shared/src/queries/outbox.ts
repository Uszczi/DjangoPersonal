/**
 * The Outbox: writes made without a connection, kept on the device and sent
 * in order once it is back online (see `docs/research/offline-sync.md`).
 *
 * An Outbox write is a TanStack Query mutation registered once per key with
 * `setMutationDefaults` (so a write restored after a restart finds its
 * function again), with a `scope` (writes in one scope go one at a time, in
 * the order they were made) and an `Idempotency-Key` in its variables (so a
 * write the server got but whose answer was lost is not applied twice).
 * Its `onMutate` updates the cache at once, so the screen shows the change
 * before the server has it.
 *
 * Pending writes are saved under their own storage key rather than with the
 * query cache, which is dropped after 24 hours: a phone may stay offline for
 * days, and the server accepts a timer action up to 7 days late.
 */
import {
  dehydrate,
  hydrate,
  MutationObserver,
  useMutationState,
  useQueryClient,
  type DehydratedState,
  type Mutation,
  type MutationKey,
  type QueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { apiErrorMessage } from "../apiErrorMessage";
import { FetchError, type InitOverrideFunction } from "../generated/api";
import { platformCacheStorage } from "../platform";
import { useOutboxErrorsStore } from "../stores/outboxErrors";
import { deserializeCache, serializeCache } from "./persist";

/** What every Outbox write carries besides its own fields. */
export type OutboxVariables = {
  /** Sent as the `Idempotency-Key` header, the same on every retry. */
  idempotencyKey: string;
};

/** Whether the request never got an answer (offline, server unreachable). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof FetchError;
}

/** The longest wait between two tries of a write the server did not answer. */
const MAX_RETRY_DELAY_MS = 30_000;

/** The options every Outbox write shares; spread into its `setMutationDefaults`. */
export function outboxOptions(scope: string) {
  return {
    scope: { id: scope },
    meta: { outbox: true },
    // Unanswered requests are tried again until they get an answer (TanStack
    // Query pauses the retries while offline); a refusal is final.
    retry: (_failureCount: number, error: unknown) => isNetworkError(error),
    retryDelay: (attempt: number) =>
      Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
  };
}

/**
 * The request options that send a write's `Idempotency-Key`. A function, so
 * the header joins the generated client's own (`Content-Type`) instead of
 * replacing them.
 */
export function idempotent(variables: OutboxVariables): InitOverrideFunction {
  return async ({ init }) => ({
    headers: {
      ...init.headers,
      "Idempotency-Key": variables.idempotencyKey,
    },
  });
}

/** Writes whose screen is still waiting for the answer, by idempotency key. */
const awaited = new Set<string>();

/**
 * Show why the server refused a write, unless its screen is still waiting
 * for it (that screen shows the error itself). Call from `onError`.
 */
export async function reportRefusal(
  error: unknown,
  variables: OutboxVariables,
): Promise<void> {
  if (awaited.has(variables.idempotencyKey)) return;
  const reason = await apiErrorMessage(error);
  useOutboxErrorsStore
    .getState()
    .report(`Zmiana wysłana później nie została zapisana: ${reason}`);
}

/** How a write left: answered by the server, or kept to be sent later. */
export type Delivery = "sent" | "queued";

/**
 * Run the Outbox write registered under `mutationKey`. Resolves once the
 * server has answered ("sent") or once the write is waiting for a connection
 * ("queued"); rejects when the server refuses it before that.
 */
export function sendWrite<TVariables extends OutboxVariables>(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  variables: TVariables,
): Promise<Delivery> {
  const observer = new MutationObserver<unknown, Error, TVariables>(
    queryClient,
    { mutationKey },
  );
  const key = variables.idempotencyKey;
  awaited.add(key);
  return new Promise<Delivery>((resolve, reject) => {
    let isSettled = false;
    const settle = (finish: () => void) => {
      if (isSettled) return;
      isSettled = true;
      awaited.delete(key);
      unsubscribe();
      finish();
    };
    const unsubscribe = observer.subscribe((result) => {
      if (
        result.isPaused ||
        (result.failureCount > 0 && isNetworkError(result.failureReason))
      )
        settle(() => resolve("queued"));
    });
    observer.mutate(variables).then(
      () => settle(() => resolve("sent")),
      (error: unknown) => settle(() => reject(error)),
    );
  });
}

/**
 * An Outbox write as a hook: `mutateAsync(input)` turns the screen's input
 * into the write's variables with `prepare` and sends it (see `sendWrite`).
 * `isPending` is true only while the screen waits, not while it is queued.
 */
export function useOutboxWrite<TInput, TVariables extends OutboxVariables>(
  mutationKey: MutationKey,
  prepare: (queryClient: QueryClient, input: TInput) => TVariables,
) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  async function mutateAsync(input: TInput): Promise<Delivery> {
    setIsPending(true);
    try {
      return await sendWrite(
        queryClient,
        mutationKey,
        prepare(queryClient, input),
      );
    } finally {
      setIsPending(false);
    }
  }
  return { mutateAsync, isPending };
}

function isWaiting(mutation: Mutation<unknown, Error, unknown, unknown>) {
  return (
    mutation.state.status === "pending" &&
    (mutation.state.isPaused || mutation.state.failureCount > 0)
  );
}

/** How many writes in `scope` are waiting to be sent. */
export function useOutboxBacklog(scope: string): number {
  return useMutationState({
    filters: {
      predicate: (mutation) =>
        mutation.options.scope?.id === scope && isWaiting(mutation),
    },
    select: (mutation) => mutation.mutationId,
  }).length;
}

/** "1 zmiana czeka na wysłanie", "3 zmiany …", "5 zmian …". */
export function backlogLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const noun =
    count === 1
      ? "zmiana czeka"
      : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
        ? "zmiany czekają"
        : "zmian czeka";
  return `${count} ${noun} na wysłanie`;
}

const STORAGE_KEY = "personal-outbox";

function isQueued(mutation: Mutation) {
  return mutation.meta?.outbox === true && mutation.state.status === "pending";
}

const restoredClients = new WeakSet<QueryClient>();

/**
 * Put back the writes saved by the last run, keep saving them from now on,
 * and send what can be sent. Call once the query cache is restored (the
 * persist provider's `onSuccess`); later calls for the same client do nothing.
 * Does not wait for the sending, which waits for a connection.
 */
export async function restoreOutbox(queryClient: QueryClient): Promise<void> {
  if (restoredClients.has(queryClient)) return;
  restoredClients.add(queryClient);

  let saved: string | null = null;
  try {
    const text = await platformCacheStorage.getItem(STORAGE_KEY);
    if (typeof text === "string") {
      const state = deserializeCache<DehydratedState>(text);
      hydrate(queryClient, {
        queries: [],
        // A write cut off mid-request comes back paused, so resuming sends it
        // again; its idempotency key keeps that harmless.
        mutations: state.mutations.map((mutation) => ({
          ...mutation,
          state: { ...mutation.state, isPaused: true, failureReason: null },
        })),
      });
      saved = text;
    }
  } catch {
    // An unreadable copy is dropped; the next save overwrites it.
  }

  queryClient.getMutationCache().subscribe(() => {
    const next = serializeCache(
      dehydrate(queryClient, {
        shouldDehydrateQuery: () => false,
        shouldDehydrateMutation: isQueued,
      }),
    );
    if (next === saved) return;
    saved = next;
    void platformCacheStorage.setItem(STORAGE_KEY, next);
  });

  void queryClient.resumePausedMutations();
}
