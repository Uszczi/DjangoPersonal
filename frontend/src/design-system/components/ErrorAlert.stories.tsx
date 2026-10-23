import type { Meta, StoryObj } from "@storybook/react-vite";

import { ErrorAlert } from "./ErrorAlert";

const meta = {
  title: "Design System/ErrorAlert",
  component: ErrorAlert,
  tags: ["autodocs"],
  args: {
    children: "Podaj tytuł zadania.",
  },
} satisfies Meta<typeof ErrorAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
