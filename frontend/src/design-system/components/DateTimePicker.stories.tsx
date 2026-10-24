import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { DateTimePicker } from "./DateTimePicker";
import { Field } from "./Field";

// Plain `Meta`: the value is controlled, so every story renders a stateful wrapper.
const meta: Meta<typeof DateTimePicker> = {
  title: "Design System/DateTimePicker",
  component: DateTimePicker,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

function Controlled({
  initial,
  disabled,
  hint,
  error,
}: {
  initial: Date | null;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState<Date | null>(initial);
  return (
    <div className="max-w-[320px]">
      <Field label="Kiedy" hint={hint} error={error}>
        <DateTimePicker value={value} onChange={setValue} disabled={disabled} />
      </Field>
      <p className="text-[12px] text-muted">
        Wartość: {value ? value.toISOString() : "brak"}
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <Controlled initial={new Date(2026, 9, 24, 14, 30)} />,
};

export const Empty: Story = { render: () => <Controlled initial={null} /> };

export const WithHint: Story = {
  render: () => (
    <Controlled initial={new Date(2026, 9, 24, 8, 0)} hint="Czas lokalny, z dokładnością do minuty." />
  ),
};

export const WithError: Story = {
  render: () => <Controlled initial={null} error="Podaj datę i godzinę." />,
};

/** Read-only, as in an editor opened before the pencil is pressed. */
export const Disabled: Story = {
  render: () => <Controlled initial={new Date(2026, 9, 24, 14, 30)} disabled />,
};
