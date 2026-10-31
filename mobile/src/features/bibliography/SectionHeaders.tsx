import { Pressable, Text, View } from "react-native";

import { fonts, makeStyles } from "../../theme";

/** A year's (or the planned items') header: tapping it folds its rows away or back. */
export function YearBar({
  label,
  count,
  isOpen,
  onPress,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${/^\d+$/.test(label) ? `Rok ${label}` : label}, ${count}`}
      accessibilityState={{ expanded: isOpen }}
      onPress={onPress}
      style={({ pressed }) => [styles.yearBar, pressed && styles.pressed]}
    >
      <Text style={styles.yearChevron}>{isOpen ? "▾" : "▸"}</Text>
      <Text style={styles.yearLabel}>{label}</Text>
      <Text style={styles.yearCount}>{count}</Text>
    </Pressable>
  );
}

/** A month inside a year: a thin rule with the month's name in the middle. */
export function MonthRule({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.monthRule} accessibilityRole="header">
      <View style={styles.monthLine} />
      <Text style={styles.monthLabel}>{label.toUpperCase()}</Text>
      <View style={styles.monthLine} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  pressed: { opacity: 0.6 },
  yearBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: colors.wash,
  },
  yearChevron: { width: 12, fontSize: 14, color: colors.ink },
  yearLabel: { fontSize: 16, fontWeight: "600", color: colors.ink },
  yearCount: { marginLeft: "auto", fontSize: 12, color: colors.muted },
  monthRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  monthLine: { flex: 1, height: 1, backgroundColor: colors.line },
  monthLabel: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.muted,
  },
}));
