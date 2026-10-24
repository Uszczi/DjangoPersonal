import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorMessage } from "./ErrorMessage";

const meta = {
  title: "Design System/ErrorMessage",
  component: ErrorMessage,
  tags: ["autodocs"],
  args: {
    children: "Nie udało się wczytać projektów.",
  },
} satisfies Meta<typeof ErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
