/**
 * `share` (0–1) of `color` laid over `base`, both hex: the calendar's tint,
 * which React Native cannot get from CSS `color-mix`. A colour that is not
 * hex comes back unmixed.
 */
export function mixColor(color: string, base: string, share: number): string {
  const a = rgb(color);
  const b = rgb(base);
  if (!a || !b) return color;
  const mixed = a.map((channel, index) =>
    Math.round(channel * share + b[index] * (1 - share)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function rgb(hex: string): number[] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const digits =
    match[1].length === 3
      ? [...match[1]].map((digit) => digit + digit).join("")
      : match[1];
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16));
}
