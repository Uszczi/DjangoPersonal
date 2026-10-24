import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "./theme";

type ChipOption<T> = { value: T; label: string };

type ChipGroupProps<T> = {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** Single choice from a short list; React Native has no built-in select. */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { color: colors.text },
  labelSelected: { color: colors.onPrimary, fontWeight: "600" },
});
