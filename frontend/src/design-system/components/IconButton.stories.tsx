import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { IconButton } from "./IconButton";

const meta = {
  title: "Design System/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: {
    "aria-label": "Zamknij",
    onClick: fn(),
    children: <span aria-hidden="true">×</span>,
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
