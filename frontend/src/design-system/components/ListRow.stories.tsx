import type { Meta, StoryObj } from "@storybook/react-vite";
import { Fragment } from "react";
import { fn } from "storybook/test";

import { ListRow, ListRowSubtitle, ListRowTitle } from "./ListRow";
import { DeleteButton, EditButton } from "./RowActionButtons";

const meta = {
  title: "Design System/ListRow",
  component: ListRow,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  args: {
    children: [
      <div key="start" className="min-w-0">
        <ListRowTitle>Kawa</ListRowTitle>
        <ListRowSubtitle>Jedzenie</ListRowSubtitle>
      </div>,
      <Fragment key="end">
        <span className="mr-2 font-utility text-[13px] font-semibold text-ink">12.50</span>
        <EditButton aria-label="Edytuj transakcję: Kawa" onClick={fn()} />
        <DeleteButton aria-label="Usuń transakcję: Kawa" onClick={fn()} />
      </Fragment>,
    ],
  },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithColorDot: Story = {
  args: {
    children: [
      <Fragment key="start">
        <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full bg-accent" />
        <div className="min-w-0">
          <ListRowTitle>Personal</ListRowTitle>
          <ListRowSubtitle>3 transakcje</ListRowSubtitle>
        </div>
      </Fragment>,
      <Fragment key="end">
        <EditButton aria-label="Edytuj portfel: Personal" onClick={fn()} />
        <DeleteButton aria-label="Usuń portfel: Personal" onClick={fn()} />
      </Fragment>,
    ],
  },
};

export const LongTitle: Story = {
  args: {
    children: [
      <Fragment key="start">
        <span className="shrink-0 font-utility text-[11px] text-muted">09:00–10:30</span>
        <ListRowTitle>Przygotować bardzo długi konspekt prezentacji na spotkanie zespołu</ListRowTitle>
      </Fragment>,
      <Fragment key="end">
        <span className="mr-2 font-utility text-[11px] font-semibold text-muted">1 H 30 MIN</span>
        <EditButton aria-label="Edytuj wpis" onClick={fn()} />
        <DeleteButton aria-label="Usuń wpis" onClick={fn()} />
      </Fragment>,
    ],
  },
};
