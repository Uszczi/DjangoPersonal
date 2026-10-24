import type { Meta, StoryObj } from "@storybook/react-vite";

import { LoadingStatus } from "./LoadingStatus";

const meta = {
  title: "Design System/LoadingStatus",
  component: LoadingStatus,
  tags: ["autodocs"],
  args: {
    children: "Wczytywanie projektów…",
  },
} satisfies Meta<typeof LoadingStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = {};

export const Inline: Story = {
  args: { variant: "inline", children: "Wczytywanie zadań…" },
};
