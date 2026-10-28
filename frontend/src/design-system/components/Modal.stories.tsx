import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "./Button";
import { Field } from "./Field";
import { Modal, ModalFooter } from "./Modal";
import { TextInput } from "./TextInput";

const meta = {
  title: "Design System/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // A modal <dialog> sits in the top layer over the whole page, so each docs story gets
    // its own iframe instead of stacking over the docs page.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
  args: {
    kicker: "POTWIERDŹ USUNIĘCIE",
    title: "Usunąć projekt?",
    titleId: "modal-story-title",
    onClose: fn(),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirm: Story = {
  args: {
    size: "md",
    children: (
      <>
        <p className="m-0 mt-5 text-[13px] leading-relaxed text-body-soft break-words">
          Projekt zostanie trwale usunięty wraz ze wszystkimi jego zadaniami.
        </p>
        <ModalFooter>
          <Button variant="secondary">Anuluj</Button>
          <Button variant="danger">Usuń projekt</Button>
        </ModalFooter>
      </>
    ),
  },
};

export const Editor: Story = {
  args: {
    size: "lg",
    kicker: "NOWE ZADANIE",
    title: "Dodaj do Inbox",
    children: (
      <>
        <Field label="Tytuł zadania">
          <TextInput placeholder="Co trzeba zrobić?" />
        </Field>
        <ModalFooter>
          <Button variant="secondary">Anuluj</Button>
          <Button variant="primary" type="submit">
            Utwórz zadanie
          </Button>
        </ModalFooter>
      </>
    ),
  },
};

/** An editor of an existing item before the pencil is pressed: fields disabled, no footer. */
export const ReadOnlyEditor: Story = {
  args: {
    size: "lg",
    kicker: "ZMIANA SZCZEGÓŁÓW",
    title: "Edytuj zadanie",
    onEdit: fn(),
    children: (
      <fieldset disabled className="contents">
        <Field label="Tytuł zadania">
          <TextInput defaultValue="Kupić mleko" />
        </Field>
      </fieldset>
    ),
  },
};
