import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { MarkdownPreview } from "@/components/MarkdownPreview";

describe("MarkdownPreview", () => {
  afterEach(() => cleanup());

  test("renders headings at their level", () => {
    render(<MarkdownPreview markdown={"# Plan\n## Etap 1\n###### Drobne"} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Etap 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 6, name: "Drobne" }),
    ).toBeInTheDocument();
  });

  test("groups list items into one list", () => {
    render(<MarkdownPreview markdown={"- mleko\n- chleb\n\n3. raz\n4. dwa"} />);
    const [bullets, numbered] = screen.getAllByRole("list");
    expect(bullets.tagName).toBe("UL");
    expect(bullets.querySelectorAll("li")).toHaveLength(2);
    expect(numbered.tagName).toBe("OL");
    expect(numbered).toHaveAttribute("start", "3");
  });

  test("splits paragraphs on blank lines and keeps single line breaks", () => {
    const { container } = render(
      <MarkdownPreview markdown={"raz\ndwa\n\ntrzy"} />,
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelectorAll("br")).toHaveLength(1);
  });

  test("renders inline formatting", () => {
    const { container } = render(
      <MarkdownPreview
        markdown={"**gruby** i *pochyły* i ~~skreślony~~ i `kod`"}
      />,
    );
    expect(container.querySelector("strong")).toHaveTextContent("gruby");
    expect(container.querySelector("em")).toHaveTextContent("pochyły");
    expect(container.querySelector("del")).toHaveTextContent("skreślony");
    expect(container.querySelector("code")).toHaveTextContent("kod");
  });

  test("leaves the contents of code blocks unformatted", () => {
    const { container } = render(
      <MarkdownPreview markdown={"```\n# nie nagłówek\n**x**\n```"} />,
    );
    expect(container.querySelector("pre")).toHaveTextContent(
      "# nie nagłówek **x**",
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.querySelector("strong")).toBeNull();
  });

  test("renders quotes and rules", () => {
    const { container } = render(
      <MarkdownPreview markdown={"> cytat\n\n---"} />,
    );
    expect(container.querySelector("blockquote")).toHaveTextContent("cytat");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  test("links only to safe targets", () => {
    render(
      <MarkdownPreview
        markdown={"[strona](https://example.com) [zło](javascript:alert(1))"}
      />,
    );
    expect(screen.getByRole("link", { name: "strona" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(screen.queryByRole("link", { name: "zło" })).not.toBeInTheDocument();
  });

  test("shows HTML in the note as text", () => {
    const { container } = render(
      <MarkdownPreview markdown={"<img src=x onerror=alert(1)>"} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
