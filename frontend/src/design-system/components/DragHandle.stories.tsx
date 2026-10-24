import type { Meta, StoryObj } from "@storybook/react-vite";

import { DragHandle } from "./DragHandle";

const meta = {
  title: "Design System/DragHandle",
  component: DragHandle,
  tags: ["autodocs"],
  args: {
    "aria-label": "Przeciągnij zadanie: Kupić mleko",
  },
} satisfies Meta<typeof DragHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
