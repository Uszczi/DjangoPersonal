import type { Meta, StoryObj } from "@storybook/react-vite";

import { Select } from "./Select";

const meta = {
  title: "Design System/Select",
  component: Select,
  tags: ["autodocs"],
  args: {
    defaultValue: "Todo",
    children: (
      <>
        <option value="Todo">Todo</option>
        <option value="Zrobione">Zrobione</option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
