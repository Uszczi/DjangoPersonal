import { seriesColor } from "@personal/shared/timeStats";
import { themes } from "@personal/shared/themes";
import { useThemeName } from "@/theme";

/** `seriesColor` for the theme on screen: the dark themes take the dark steps. */
export function useSeriesColor(): (slot: number) => string {
  const scheme = themes[useThemeName()].scheme;
  return (slot) => seriesColor(slot, scheme);
}
