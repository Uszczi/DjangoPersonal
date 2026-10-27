import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { Button } from "./Button";
import { Drawer } from "./Drawer";

const meta = {
  title: "Design System/Drawer",
  component: Drawer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // A modal <dialog> sits in the top layer over the whole page, so each docs story gets
    // its own iframe instead of stacking over the docs page.
    docs: { story: { inline: false, iframeHeight: 520 } },
  },
  args: {
    title: (
      <span className="text-[15px] font-bold tracking-[-0.03em]">Menu</span>
    ),
    label: "Menu",
    onClose: fn(),
    children: (
      <>
        <nav className="flex flex-col gap-1" aria-label="Nawigacja">
          {["Start", "Zadania", "Projekty", "Czas"].map((item) => (
            <a
              key={item}
              href="#"
              className="rounded-[5px] px-[14px] py-2 text-[13px] text-ink-soft no-underline hover:bg-wash"
            >
              {item}
            </a>
          ))}
        </nav>
        <Button variant="secondary">Wyloguj</Button>
      </>
    ),
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Left: Story = { args: { side: "left" } };
