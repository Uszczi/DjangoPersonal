import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextInput } from "./TextInput";

const meta = {
  title: "Design System/TextInput",
  component: TextInput,
  tags: ["autodocs"],
  args: {
    placeholder: "Np. Nowy portfel",
  },
} satisfies Meta<typeof TextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: { defaultValue: "Oszczędności" },
};
