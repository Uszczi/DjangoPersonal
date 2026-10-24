import { Pressable, StyleSheet, Text, View } from "react-native";

import type { IconSuggestion } from "@personal/shared/iconSuggestion";

import { NamedIcon } from "./NamedIcon";
import { colors } from "./theme";

type IconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
  suggestions: readonly IconSuggestion[];
  /** Offer "no icon" (wallets); categories always have one. */
  noneLabel?: string;
  fallback: string;
  disabled?: boolean;
};

/**
 * A grid of the suggested lucide icons. The web picker also takes any typed
 * lucide name; such an icon (set on the web) stays selectable here.
 */
export function IconPicker({
  value,
  onChange,
  suggestions,
  noneLabel,
  fallback,
  disabled = false,
}: IconPickerProps) {
  const options =
    value && !suggestions.some((item) => item.value === value)
      ? [{ value, label: value }, ...suggestions]
      : suggestions;

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {noneLabel && (
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={noneLabel}
          accessibilityState={{ checked: value === null, disabled }}
          disabled={disabled}
          onPress={() => onChange(null)}
          style={[styles.cell, value === null && styles.cellSelected]}
        >
          <Text style={styles.none}>—</Text>
        </Pressable>
      )}
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.cell, isSelected && styles.cellSelected]}
          >
            <NamedIcon
              name={option.value}
              fallback={fallback}
              color={isSelected ? colors.onPrimary : colors.text}
              size={22}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  none: { fontSize: 18, color: colors.muted },
});
