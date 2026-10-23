import type { Meta, StoryObj } from "@storybook/react-vite";

import { TextArea } from "./TextArea";

const meta = {
  title: "Design System/TextArea",
  component: TextArea,
  tags: ["autodocs"],
  args: {
    placeholder: "Opisz szczegóły…",
  },
} satisfies Meta<typeof TextArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoResize: Story = {
  args: { resize: "none", rows: 3 },
};
