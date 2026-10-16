import { Fragment } from "react";

import { useModalStore } from "@/stores/modal";

/** Renders the modals opened through `ShowModal`. Mount it once in the app shell. */
export function ModalHost() {
  const entries = useModalStore((state) => state.entries);
  const remove = useModalStore((state) => state.remove);

  return (
    <>
      {entries.map((entry) => (
        <Fragment key={entry.id}>{entry.render(() => remove(entry.id))}</Fragment>
      ))}
    </>
  );
}
