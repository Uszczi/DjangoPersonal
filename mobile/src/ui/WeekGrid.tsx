import { Children, type ReactNode } from "react";
import { View } from "react-native";

const WEEK = 7;

/** One day of a `WeekGrid`: an equal share of the row, the gap inside it. */
export const WEEK_CELL = "flex-1 p-0.5";

/**
 * A month calendar's cells laid out as weeks: rows of seven equal cells.
 *
 * Each row is its own flex row of `WEEK_CELL`s rather than one wrapping row
 * of 1/7-wide cells: those widths round up on some phones, and the seventh
 * cell then wrapped to the next line, pushing the calendar off centre. Pass
 * the weekday labels, the blanks before the 1st and the days, in order, each
 * a keyed `WEEK_CELL` view; the last week is padded with empty cells.
 */
export function WeekGrid({ children }: { children: ReactNode }) {
  const cells = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let start = 0; start < cells.length; start += WEEK) {
    const row = cells.slice(start, start + WEEK);
    for (let pad = row.length; pad < WEEK; pad += 1) {
      row.push(<View key={`pad-${pad}`} className={WEEK_CELL} />);
    }
    rows.push(row);
  }
  return (
    <View>
      {rows.map((row, index) => (
        <View key={index} className="flex-row">
          {row}
        </View>
      ))}
    </View>
  );
}
