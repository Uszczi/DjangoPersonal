import { Linking, Text, View } from "react-native";
import type { ReactNode } from "react";

import {
  parseInline,
  parseMarkdown,
  type HeadingLevel,
  type MarkdownBlock,
  type MarkdownInline,
} from "@personal/shared/markdown";
import { findMatches } from "@personal/shared/textSearch";

const HEADING_CLASSES: Record<HeadingLevel, string> = {
  1: "mt-5 mb-3 font-display text-2xl font-bold text-deep-ink",
  2: "mt-5 mb-2 font-display text-xl font-bold text-deep-ink",
  3: "mt-4 mb-2 font-display text-lg font-semibold text-deep-ink",
  4: "mt-3 mb-1 font-display text-base font-semibold text-deep-ink",
  5: "mt-3 mb-1 font-display text-sm font-semibold text-deep-ink",
  6: "mt-3 mb-1 font-display text-sm font-semibold text-muted",
};

/** Plain text, with every match of the search marked like the web's `<mark>`. */
function markedText(text: string, query: string, key: string): ReactNode {
  const matches = query ? findMatches(text, query) : [];
  if (matches.length === 0) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const { start, end } of matches) {
    parts.push(text.slice(last, start));
    parts.push(
      <Text key={`${key}-m${start}`} className="bg-search-match">
        {text.slice(start, end)}
      </Text>,
    );
    last = end;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Only web and mail links open; a link inside the web app has nowhere to go here. */
function openLink(href: string) {
  if (/^(https?:|mailto:)/i.test(href)) void Linking.openURL(href);
}

function renderRuns(
  runs: MarkdownInline[],
  query: string,
  keyPrefix: string,
): ReactNode[] {
  return runs.map((run, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (run.type) {
      case "text":
        return <Text key={key}>{markedText(run.text, query, key)}</Text>;
      case "code":
        return (
          <Text
            key={key}
            className="bg-md-code-bg font-utility text-[13px] text-accent"
          >
            {markedText(run.text, query, key)}
          </Text>
        );
      case "link": {
        const href = run.href;
        if (!href) {
          return <Text key={key}>{markedText(run.source, query, key)}</Text>;
        }
        return (
          <Text
            key={key}
            accessibilityRole="link"
            className="text-accent underline"
            onPress={() => openLink(href)}
          >
            {renderRuns(run.children, query, key)}
          </Text>
        );
      }
      case "strong":
        return (
          <Text key={key} className="font-bold text-deep-ink">
            {renderRuns(run.children, query, key)}
          </Text>
        );
      case "del":
        return (
          <Text key={key} className="line-through">
            {renderRuns(run.children, query, key)}
          </Text>
        );
      case "em":
        return (
          <Text key={key} className="italic">
            {renderRuns(run.children, query, key)}
          </Text>
        );
    }
  });
}

function inline(text: string, query: string, key: string): ReactNode[] {
  return renderRuns(parseInline(text), query, key);
}

/** Lines of one block, single newlines kept as line breaks. */
function lines(texts: string[], query: string, key: string): ReactNode[] {
  return texts.flatMap((line, index) => [
    ...(index > 0 ? ["\n"] : []),
    ...inline(line, query, `${key}-${index}`),
  ]);
}

function renderBlock(
  block: MarkdownBlock,
  index: number,
  query: string,
): ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case "heading":
      return (
        <Text
          key={key}
          accessibilityRole="header"
          className={HEADING_CLASSES[block.level]}
        >
          {inline(block.text, query, key)}
        </Text>
      );
    case "paragraph":
      return (
        <Text key={key} className="my-2 text-[15px] leading-6 text-ink">
          {lines(block.lines, query, key)}
        </Text>
      );
    case "list":
      return (
        <View key={key} className="my-2 gap-1">
          {block.items.map((item, itemIndex) => (
            <View key={`${key}-${itemIndex}`} className="flex-row gap-2 pl-1">
              <Text className="min-w-4 text-[15px] leading-6 text-muted">
                {block.ordered ? `${block.start + itemIndex}.` : "•"}
              </Text>
              <Text className="flex-1 text-[15px] leading-6 text-ink">
                {inline(item, query, `${key}-${itemIndex}`)}
              </Text>
            </View>
          ))}
        </View>
      );
    case "quote":
      return (
        <View key={key} className="my-2 border-l-4 border-line pl-3">
          <Text className="text-[15px] leading-6 text-muted">
            {lines(block.lines, query, key)}
          </Text>
        </View>
      );
    case "code":
      return (
        <View key={key} className="my-2 rounded bg-md-code-bg p-3">
          <Text className="font-utility text-[13px] text-ink">
            {markedText(block.text, query, key)}
          </Text>
        </View>
      );
    case "rule":
      return <View key={key} className="my-4 h-px bg-line" />;
  }
}

/**
 * A Notatka's Markdown as native text: the same blocks the web preview
 * renders (`@personal/shared/markdown`), built from `Text` and `View`, never
 * from markup. `highlight` marks a search's matches.
 */
export function MarkdownView({
  markdown,
  highlight = "",
}: {
  markdown: string;
  highlight?: string;
}) {
  return (
    <View>
      {parseMarkdown(markdown).map((block, index) =>
        renderBlock(block, index, highlight),
      )}
    </View>
  );
}
