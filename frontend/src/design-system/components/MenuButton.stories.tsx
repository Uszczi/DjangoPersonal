import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pencil, Settings, Trash2 } from "lucide-react";
import { fn } from "storybook/test";

import { MenuButton } from "./MenuButton";

const meta = {
  title: "Design System/MenuButton",
  component: MenuButton,
  tags: ["autodocs"],
  args: {
    label: "Opcje licznika",
    icon: <Settings size={20} aria-hidden="true" />,
    items: [
      {
        label: "Edytuj licznik",
        icon: <Pencil size={16} aria-hidden="true" />,
        onSelect: fn(),
      },
      {
        label: "Usuń licznik",
        icon: <Trash2 size={16} aria-hidden="true" />,
        isDanger: true,
        onSelect: fn(),
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="flex justify-end p-4 pb-32">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
