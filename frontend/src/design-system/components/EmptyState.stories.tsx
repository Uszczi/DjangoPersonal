import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Design System/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    eyebrow: "BRAK LICZNIKÓW",
    title: "Utwórz pierwszy licznik",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    titleAs: "h1",
    eyebrow: "BRAK PROJEKTÓW",
    title: "Utwórz pierwsze miejsce pracy",
    children: <Button variant="primary">Nowy projekt</Button>,
  },
};
