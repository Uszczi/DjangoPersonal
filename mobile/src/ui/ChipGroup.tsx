import { Pressable, Text, View } from "react-native";

import { makeStyles } from "../theme";

type ChipOption<T> = { value: T; label: string };

type ChipGroupProps<T> = {
  options: ChipOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** One line (inside a horizontal ScrollView) instead of wrapping. */
  nowrap?: boolean;
};

/** Single choice from a short list; React Native has no built-in select. */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  nowrap = false,
}: ChipGroupProps<T>) {
  const styles = useStyles();
  return (
    <View
      style={[styles.group, nowrap && styles.nowrap]}
      accessibilityRole="radiogroup"
    >
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

const useStyles = makeStyles((colors) => ({
  group: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nowrap: { flexWrap: "nowrap" },
  // The web ToggleGroup: secondary buttons, the chosen one primary.
  chip: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "transparent",
  },
  chipSelected: {
    backgroundColor: colors.signal,
    borderColor: colors.signal,
  },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: "600" },
  labelSelected: { color: colors.onSignal },
}));
