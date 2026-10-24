import type { CounterEntryInput } from "@personal/shared/stores/counters";

/** The quick "+1" entry, stamped with the moment of the tap. */
export function plusOneEntry(): CounterEntryInput {
  return { value: 1, occurredAt: new Date(), note: "" };
}
