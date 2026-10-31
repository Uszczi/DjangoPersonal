/** A Wallet's or a Counter's colour as a small circle next to its name; decorative, the name carries the meaning. */
export function ColorDot({
  color,
  className = "",
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${className}`.trim()}
      style={{ backgroundColor: color }}
    />
  );
}
