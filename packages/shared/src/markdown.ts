/**
 * The small Markdown dialect of Notatki, parsed into plain data so each
 * client renders it with its own elements (DOM on the web, `Text` on mobile).
 * Nothing here produces markup, so note text can never inject any.
 *
 * Supported: headings (#–######), paragraphs (single newlines kept as line
 * breaks), unordered (-, *, +) and ordered (1.) lists, blockquotes (>),
 * fenced code blocks (```), horizontal rules (---, ***, ___), and inline
 * `code`, **bold**, *italic*, ~~strikethrough~~ and [links](https://…).
 */

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MarkdownBlock =
  | { type: "heading"; level: HeadingLevel; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; start: number; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; text: string }
  | { type: "rule" };

/**
 * A run of inline text. A link whose target is not safe to follow has
 * `href: null` and is shown as the text it was written as.
 */
export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | {
      type: "link";
      href: string | null;
      source: string;
      children: MarkdownInline[];
    }
  | { type: "strong" | "em" | "del"; children: MarkdownInline[] };

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

export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
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
      const level = heading[1].length as HeadingLevel;
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
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !startsBlock(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

/** Only these link targets are followed; anything else stays text. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[/#]/.test(trimmed)) return trimmed;
  return null;
}

// Earliest match wins; on a tie the order below decides (code first, so its
// content is never parsed, and ** before *).
const INLINE: {
  pattern: RegExp;
  parse: (m: RegExpExecArray) => MarkdownInline;
}[] = [
  {
    pattern: /`([^`\n]+)`/,
    parse: (m) => ({ type: "code", text: m[1] }),
  },
  {
    pattern: /\[([^\]\n]+)\]\(([^)\s]+)\)/,
    parse: (m) => ({
      type: "link",
      href: safeHref(m[2]),
      source: m[0],
      children: parseInline(m[1]),
    }),
  },
  {
    pattern: /(\*\*|__)(?=\S)(.+?)(?<=\S)\1/,
    parse: (m) => ({ type: "strong", children: parseInline(m[2]) }),
  },
  {
    pattern: /~~(?=\S)(.+?)(?<=\S)~~/,
    parse: (m) => ({ type: "del", children: parseInline(m[1]) }),
  },
  {
    pattern:
      /(?<![\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)|(?<!\w)_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)/,
    parse: (m) => ({ type: "em", children: parseInline(m[1] ?? m[2]) }),
  },
];

/** One line of text as runs of plain text and formatting. */
export function parseInline(text: string): MarkdownInline[] {
  const out: MarkdownInline[] = [];
  let rest = text;

  while (rest.length > 0) {
    let best: {
      index: number;
      match: RegExpExecArray;
      rule: (typeof INLINE)[number];
    } | null = null;
    for (const rule of INLINE) {
      const match = rule.pattern.exec(rest);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, match, rule };
      }
    }
    if (best === null) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (best.index > 0) {
      out.push({ type: "text", text: rest.slice(0, best.index) });
    }
    out.push(best.rule.parse(best.match));
    rest = rest.slice(best.index + best.match[0].length);
  }

  return out;
}
