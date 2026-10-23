import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";
import { Select } from "./Select";
import { TextInput } from "./TextInput";

const meta = {
  title: "Design System/Field",
  component: Field,
  tags: ["autodocs"],
  args: {
    label: "Nazwa projektu",
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTextInput: Story = {
  args: {
    children: <TextInput placeholder="Np. Strona firmowa" />,
  },
};

export const WithSelect: Story = {
  args: {
    label: "Status",
    children: (
      <Select defaultValue="Todo">
        <option value="Todo">Todo</option>
        <option value="Zrobione">Zrobione</option>
      </Select>
    ),
  },
};

export const WithHint: Story = {
  args: {
    hint: "Nazwa Inbox jest stała.",
    children: <TextInput defaultValue="Inbox" readOnly />,
  },
};

export const WithError: Story = {
  args: {
    label: "Stan początkowy",
    error: "Podaj kwotę z najwyżej dwoma miejscami po przecinku.",
    children: <TextInput defaultValue="12,345" inputMode="decimal" />,
  },
};
