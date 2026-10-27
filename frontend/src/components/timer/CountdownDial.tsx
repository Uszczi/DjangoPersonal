import { useEffect, useRef } from "react";

/** Side of the dial in CSS pixels. */
const SIZE = 132;

type Palette = {
  face: string;
  rim: string;
  wedge: string;
  tick: string;
  hand: string;
};

/**
 * A kitchen-timer dial drawn on a canvas: the wedge is the part of the limit
 * still left, shrinking back towards 12 o'clock. Purely visual — the digits
 * next to it carry the same information, so it is hidden from assistive tech.
 * It redraws whenever `remaining` changes (the page ticks once a second).
 */
export function CountdownDial({
  remaining,
  total,
}: {
  /** Milliseconds left. */
  remaining: number;
  /** The whole limit in milliseconds. */
  total: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    // Draw at the screen's pixel density so the dial stays sharp.
    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== SIZE * ratio) {
      canvas.width = SIZE * ratio;
      canvas.height = SIZE * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const fraction =
      total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0;
    drawDial(context, fraction, readPalette(canvas));
  }, [remaining, total]);

  return (
    <canvas
      ref={canvasRef}
      className="shrink-0 self-center"
      style={{ width: SIZE, height: SIZE }}
      aria-hidden="true"
    />
  );
}

/** The design tokens from `index.css`, with fallbacks in case they are missing. */
function readPalette(element: Element): Palette {
  const styles = getComputedStyle(element);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    face: token("--color-paper", "#f8faf7"),
    rim: token("--color-line", "#d2ddda"),
    wedge: token("--color-accent", "#477c7c"),
    tick: token("--color-icon", "#64797c"),
    hand: token("--color-ink", "#1b3439"),
  };
}

function drawDial(
  context: CanvasRenderingContext2D,
  fraction: number,
  palette: Palette,
) {
  const center = SIZE / 2;
  const radius = center - 3;
  const top = -Math.PI / 2;
  const handAngle = top + fraction * 2 * Math.PI;

  context.clearRect(0, 0, SIZE, SIZE);

  // Face and rim.
  context.beginPath();
  context.arc(center, center, radius, 0, 2 * Math.PI);
  context.fillStyle = palette.face;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = palette.rim;
  context.stroke();

  // Time left: a wedge from 12 o'clock clockwise.
  if (fraction > 0) {
    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius - 10, top, handAngle);
    context.closePath();
    context.globalAlpha = 0.85;
    context.fillStyle = palette.wedge;
    context.fill();
    context.globalAlpha = 1;
  }

  // Ticks: one per minute of a clock face, longer every five.
  context.strokeStyle = palette.tick;
  for (let index = 0; index < 60; index += 1) {
    const isMajor = index % 5 === 0;
    const angle = top + (index / 60) * 2 * Math.PI;
    const outer = radius - 2;
    const inner = outer - (isMajor ? 7 : 3);
    context.beginPath();
    context.lineWidth = isMajor ? 2 : 1;
    context.moveTo(
      center + Math.cos(angle) * inner,
      center + Math.sin(angle) * inner,
    );
    context.lineTo(
      center + Math.cos(angle) * outer,
      center + Math.sin(angle) * outer,
    );
    context.stroke();
  }

  // Hand at the edge of the wedge, and the pin it turns on.
  context.beginPath();
  context.lineCap = "round";
  context.lineWidth = 3;
  context.strokeStyle = palette.hand;
  context.moveTo(center, center);
  context.lineTo(
    center + Math.cos(handAngle) * (radius - 14),
    center + Math.sin(handAngle) * (radius - 14),
  );
  context.stroke();
  context.beginPath();
  context.arc(center, center, 5, 0, 2 * Math.PI);
  context.fillStyle = palette.hand;
  context.fill();
}
