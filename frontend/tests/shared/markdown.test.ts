import { describe, expect, test } from "vitest";

import { parseInline, parseMarkdown } from "@personal/shared/markdown";

describe("parseMarkdown", () => {
  test("reads blocks in order", () => {
    expect(
      parseMarkdown("# Plan\n\nraz\ndwa\n\n- a\n- b\n\n---\n```\nkod\n```"),
    ).toEqual([
      { type: "heading", level: 1, text: "Plan" },
      { type: "paragraph", lines: ["raz", "dwa"] },
      { type: "list", ordered: false, start: 1, items: ["a", "b"] },
      { type: "rule" },
      { type: "code", text: "kod" },
    ]);
  });
});

describe("parseInline", () => {
  test("nests formatting and keeps code unparsed", () => {
    expect(parseInline("**gruby _i pochyły_** `**nie**`")).toEqual([
      {
        type: "strong",
        children: [
          { type: "text", text: "gruby " },
          { type: "em", children: [{ type: "text", text: "i pochyły" }] },
        ],
      },
      { type: "text", text: " " },
      { type: "code", text: "**nie**" },
    ]);
  });

  test("gives an unsafe link no target, only its source text", () => {
    expect(parseInline("[klik](javascript:alert(1))")[0]).toMatchObject({
      type: "link",
      href: null,
      source: "[klik](javascript:alert(1)",
    });
  });
});
