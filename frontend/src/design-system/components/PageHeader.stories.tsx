import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { PageHeader } from "./PageHeader";

const meta = {
  title: "Design System/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  args: {
    title: "Liczniki",
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="primary">
        <span aria-hidden="true">+</span>
        Nowy licznik
      </Button>
    ),
  },
};

export const WithEyebrow: Story = {
  args: { eyebrow: "KONTO", title: "jan" },
};

export const ClickableTitle: Story = {
  args: {
    eyebrow: "← LICZNIKI",
    title: "Kawa",
    subtitle: "12 wpisów",
    onTitleClick: () => {},
    titleClickLabel: "Zmień nazwę licznika: Kawa",
    actions: (
      <p className="font-display text-[44px] leading-none font-bold text-ink">
        12
      </p>
    ),
  },
};
