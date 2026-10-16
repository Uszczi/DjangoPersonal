import { createElement, type ComponentType, type ReactNode } from "react";
import { create } from "zustand";

/** Every modal component receives `onClose`; calling it unmounts the modal. */
export type ModalProps = {
  onClose: () => void;
};

type ModalEntry = {
  id: number;
  render: (onClose: () => void) => ReactNode;
};

type ModalState = {
  entries: ModalEntry[];
  push: (entry: ModalEntry) => void;
  remove: (id: number) => void;
};

let nextModalId = 0;

export const useModalStore = create<ModalState>((set) => ({
  entries: [],
  push: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  remove: (id) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    })),
}));

/**
 * Opens `Component` in the modal host. Call it from an event handler, e.g.
 * `ShowModal(DeleteProjectModal, { project })`.
 */
export function ShowModal<P extends ModalProps>(
  Component: ComponentType<P>,
  props?: Omit<P, "onClose">,
) {
  const id = nextModalId++;
  useModalStore.getState().push({
    id,
    render: (onClose) =>
      createElement(Component, { ...(props ?? {}), onClose } as P),
  });
  return id;
}
