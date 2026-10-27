import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { IconPicker } from "./IconPicker";

const suggestions = [
  { value: "tag", label: "Etykieta" },
  { value: "utensils", label: "Jedzenie" },
  { value: "car", label: "Samochód" },
  { value: "house", label: "Dom" },
  { value: "plane", label: "Podróże" },
];

// Plain `Meta`: the props are a union (required vs optional icon), which args
// cannot express, so every story renders a stateful wrapper instead.
const meta: Meta<typeof IconPicker> = {
  title: "Design System/IconPicker",
  component: IconPicker,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[420px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof IconPicker>;

function RequiredIcon({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <IconPicker
      label="Ikona kategorii"
      value={value}
      onChange={setValue}
      suggestions={suggestions}
    />
  );
}

function OptionalIcon() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <IconPicker
      label="Ikona portfela"
      noneLabel="Bez ikony"
      value={value}
      onChange={setValue}
      suggestions={suggestions}
    />
  );
}

export const Default: Story = { render: () => <RequiredIcon initial="tag" /> };

/** A chosen icon outside the suggestions still shows first when the search is empty. */
export const ChosenOutsideSuggestions: Story = {
  render: () => <RequiredIcon initial="rocket" />,
};

/** With `noneLabel` the icon is optional: "no icon" leads the list and `null` means none. */
export const Optional: Story = { render: () => <OptionalIcon /> };
