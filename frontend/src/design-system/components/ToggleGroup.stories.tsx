import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { ToggleGroup } from "./ToggleGroup";

const MODES = ["rows", "tiles"] as const;
type Mode = (typeof MODES)[number];
const LABELS: Record<Mode, string> = { rows: "Wiersze", tiles: "Kafelki" };

function Demo() {
  const [value, setValue] = useState<Mode>("rows");
  return (
    <ToggleGroup
      label="Widok"
      options={MODES}
      labels={LABELS}
      value={value}
      onChange={setValue}
    />
  );
}

const meta = {
  title: "Design System/ToggleGroup",
  component: Demo,
  tags: ["autodocs"],
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
