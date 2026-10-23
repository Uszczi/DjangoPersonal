import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button, buttonVariants } from "./Button";

const meta = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Zapisz",
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: "select",
      options: buttonVariants,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Anuluj" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Usuń projekt" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Nowy portfel" },
};

export const GhostDanger: Story = {
  args: { variant: "ghostDanger", children: "Usuń" },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Zapisywanie…" },
};

export const DisabledGhost: Story = {
  args: { variant: "ghost", disabled: true, children: "Nowy portfel" },
};

export const DisabledGhostDanger: Story = {
  args: { variant: "ghostDanger", disabled: true, children: "Usuń" },
};
