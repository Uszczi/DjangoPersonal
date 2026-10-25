import type { ReactNode } from "react";

/**
 * A small Markdown renderer for Notatki previews. It builds React elements
 * instead of an HTML string, so note text can never inject markup.
 *
 * Supported: headings (#–######), paragraphs (single newlines kept as line
 * breaks), unordered (-, *, +) and ordered (1.) lists, blockquotes (>),
 * fenced code blocks (```), horizontal rules (---, ***, ___), and inline
 * `code`, **bold**, *italic*, ~~strikethrough~~ and [links](https://…).
 */

type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; start: number; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "rule" };

const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^ {0,3}(```|~~~)/;
const RULE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;

function startsBlock(line: string): boolean {
  return (
    HEADING.test(line) ||
    FENCE.test(line) ||
    RULE.test(line) ||
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    QUOTE.test(line)
  );
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or end of text)
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: "heading", level, text: heading[2] });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      let match: RegExpExecArray | null;
      while (i < lines.length && (match = QUOTE.exec(lines[i]))) {
        quoted.push(match[1]);
        i++;
      }
      blocks.push({ type: "quote", lines: quoted });
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (BULLET.test(line) || numbered) {
      const ordered = numbered !== null;
      const pattern = ordered ? NUMBERED : BULLET;
      const items: string[] = [];
      let match: RegExpExecArray | null;
      while (i < lines.length && (match = pattern.exec(lines[i]))) {
        items.push(ordered ? match[2] : match[1]);
        i++;
      }
      blocks.push({
        type: "list",
        ordered,
        start: numbered ? Number(numbered[1]) : 1,
        items,
      });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

/** Only these link targets are rendered as links; anything else stays text. */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[/#]/.test(trimmed)) return trimmed;
  return null;
}

// Earliest match wins; on a tie the order below decides (code first, so its
// content is never parsed, and ** before *).
const INLINE: { pattern: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode }[] = [
  {
    pattern: /`([^`\n]+)`/,
    render: (m, key) => (
      <code key={key} className="rounded bg-md-code-bg px-1 font-utility text-[0.9em] text-accent">
        {m[1]}
      </code>
    ),
  },
  {
    pattern: /\[([^\]\n]+)\]\(([^)\s]+)\)/,
    render: (m, key) => {
      const href = safeHref(m[2]);
      if (!href) return m[0];
      const external = /^https?:/i.test(href);
      return (
        <a
          key={key}
          href={href}
          className="text-accent underline underline-offset-2 hover:text-ink"
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {renderInline(m[1], key)}
        </a>
      );
    },
  },
  {
    pattern: /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/,
    render: (m, key) => (
      <strong key={key} className="font-bold text-deep-ink">
        {renderInline(m[2], key)}
      </strong>
    ),
  },
  {
    pattern: /~~(?=\S)(.+?)(?<=\S)~~/,
    render: (m, key) => <del key={key}>{renderInline(m[1], key)}</del>,
  },
  {
    pattern: /(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)|(?<!\w)_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)/,
    render: (m, key) => <em key={key}>{renderInline(m[1] ?? m[2], key)}</em>,
  },
];

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;

  while (rest.length > 0) {
    let best: { index: number; match: RegExpExecArray; rule: (typeof INLINE)[number] } | null = null;
    for (const rule of INLINE) {
      const match = rule.pattern.exec(rest);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, match, rule };
      }
    }
    if (best === null) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    out.push(best.rule.render(best.match, `${keyPrefix}-${n++}`));
    rest = rest.slice(best.index + best.match[0].length);
  }

  return out;
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

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as const;
      return (
        <Tag key={key} className={`font-display text-deep-ink first:mt-0 ${HEADING_CLASSES[block.level]}`}>
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
        <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
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
        <blockquote key={key} className="my-2 border-l-4 border-line pl-3 text-muted">
          {renderLines(block.lines, key)}
        </blockquote>
      );
    case "code":
      return (
        <pre key={key} className="my-2 overflow-x-auto rounded bg-md-code-bg p-3 font-utility text-[0.9em] text-ink">
          <code>{block.text}</code>
        </pre>
      );
    case "rule":
      return <hr key={key} className="my-4 border-line" />;
  }
}

type MarkdownPreviewProps = {
  markdown: string;
  className?: string;
};

export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  return (
    <div className={`break-words [&>*:first-child]:mt-0 ${className ?? ""}`}>
      {parseBlocks(markdown).map(renderBlock)}
    </div>
  );
}
