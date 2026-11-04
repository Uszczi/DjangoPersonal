import type { ReactNode } from "react";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";

/** How far, in points, a swipe must travel to change the month. */
const SWIPE_DISTANCE = 50;
/** A quick flick changes the month even when it is shorter. */
const SWIPE_VELOCITY = 500;

/**
 * A month calendar that changes month on a horizontal swipe: right to left
 * shows the next month, left to right the previous one. The pan only takes
 * over once the finger moves sideways, so a vertical drag still scrolls the
 * screen and taps still reach the days.
 */
export function MonthSwipe({
  onShift,
  enabled = true,
  children,
}: {
  /** `1` for the next month, `-1` for the previous one. */
  onShift: (delta: 1 | -1) => void;
  /** Off where the content scrolls sideways itself. */
  enabled?: boolean;
  children: ReactNode;
}) {
  const gesture = usePanGesture({
    runOnJS: true,
    enabled,
    activeOffsetX: [-15, 15],
    failOffsetY: [-15, 15],
    onDeactivate: (event) => {
      if (event.canceled) return;
      const { translationX, velocityX } = event;
      const far = Math.abs(translationX) >= SWIPE_DISTANCE;
      const fast = Math.abs(velocityX) >= SWIPE_VELOCITY;
      if (!far && !fast) return;
      onShift(translationX < 0 ? 1 : -1);
    },
  });
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
