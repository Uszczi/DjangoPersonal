import { cloneElement, isValidElement, type ReactNode } from "react";

import {
  parseInline,
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInline,
} from "@personal/shared/markdown";
import { findMatches } from "@personal/shared/textSearch";

/**
 * The web's renderer for Notatki previews. The text is parsed by the shared
 * `@personal/shared/markdown` (the mobile app renders the same blocks); this
 * builds React elements from it, never an HTML string, so note text can
 * never inject markup.
 */

function renderRuns(runs: MarkdownInline[], keyPrefix: string): ReactNode[] {
  return runs.map((run, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (run.type) {
      case "text":
        return run.text;
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-md-code-bg px-1 font-utility text-[0.9em] text-accent"
          >
            {run.text}
          </code>
        );
      case "link": {
        if (!run.href) return run.source;
        const external = /^https?:/i.test(run.href);
        return (
          <a
            key={key}
            href={run.href}
            className="text-accent underline underline-offset-2 hover:text-ink"
            {...(external
              ? { target: "_blank", rel: "noreferrer noopener" }
              : {})}
          >
            {renderRuns(run.children, key)}
          </a>
        );
      }
      case "strong":
        return (
          <strong key={key} className="font-bold text-deep-ink">
            {renderRuns(run.children, key)}
          </strong>
        );
      case "del":
        return <del key={key}>{renderRuns(run.children, key)}</del>;
      case "em":
        return <em key={key}>{renderRuns(run.children, key)}</em>;
    }
  });
}

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  return renderRuns(parseInline(text), keyPrefix);
}

function renderLines(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, index) => [
    ...(index > 0 ? [<br key={`${keyPrefix}-br-${index}`} />] : []),
    ...renderInline(line, `${keyPrefix}-${index}`),
  ]);
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-5 mb-3 text-2xl font-bold",
  2: "mt-5 mb-2 text-xl font-bold",
  3: "mt-4 mb-2 text-lg font-semibold",
  4: "mt-3 mb-1 text-base font-semibold",
  5: "mt-3 mb-1 text-sm font-semibold",
  6: "mt-3 mb-1 text-sm font-semibold text-muted",
};

function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return (
        <Tag
          key={key}
          className={`font-display text-deep-ink first:mt-0 ${HEADING_CLASSES[block.level]}`}
        >
          {renderInline(block.text, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="my-2">
          {renderLines(block.lines, key)}
        </p>
      );
    case "list": {
      const items = block.items.map((item, itemIndex) => (
        <li key={`${key}-${itemIndex}`}>
          {renderInline(item, `${key}-${itemIndex}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} start={block.start} className="my-2 list-decimal pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="my-2 list-disc pl-6">
          {items}
        </ul>
      );
    }
    case "quote":
      return (
        <blockquote
          key={key}
          className="my-2 border-l-4 border-line pl-3 text-muted"
        >
          {renderLines(block.lines, key)}
        </blockquote>
      );
    case "code":
      return (
        <pre
          key={key}
          className="my-2 overflow-x-auto rounded bg-md-code-bg p-3 font-utility text-[0.9em] text-ink"
        >
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} className="my-4 border-line" />;
  }
}

/**
 * Wraps every match of the search in the rendered text in `<mark>`. It works
 * on the finished elements, so a match is found within one run of text; one
 * spanning formatting (half bold) is not marked.
 */
function markSearch(node: ReactNode, query: string, key: string): ReactNode {
  if (typeof node === "string") {
    const matches = findMatches(node, query);
    if (matches.length === 0) return node;
    const parts: ReactNode[] = [];
    let last = 0;
    for (const { start, end } of matches) {
      parts.push(node.slice(last, start));
      parts.push(
        <mark
          key={`${key}-m${start}`}
          className="rounded-sm bg-search-match text-inherit"
        >
          {node.slice(start, end)}
        </mark>,
      );
      last = end;
    }
    parts.push(node.slice(last));
    return parts;
  }
  if (Array.isArray(node)) {
    return node.map((child: ReactNode, i) =>
      markSearch(child, query, `${key}-${i}`),
    );
  }
  if (
    isValidElement<{ children?: ReactNode }>(node) &&
    node.props.children !== undefined
  ) {
    return cloneElement(
      node,
      undefined,
      markSearch(node.props.children, query, key),
    );
  }
  return node;
}

type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
  /** Text to mark wherever it appears, as the editor's search does. */
  highlight?: string;
};

export function MarkdownPreview({
  markdown,
  className,
  highlight,
}: MarkdownPreviewProps) {
  const blocks: ReactNode = parseMarkdown(markdown).map(renderBlock);
  return (
    <div className={`break-words [&>*:first-child]:mt-0 ${className ?? ""}`}>
      {highlight ? markSearch(blocks, highlight, "s") : blocks}
    </div>
  );
}
