import { Pressable, Text, View } from "react-native";

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
  return (
    <View
      className={
        nowrap ? "flex-row flex-nowrap gap-2" : "flex-row flex-wrap gap-2"
      }
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
            // The web ToggleGroup: secondary buttons, the chosen one primary.
            className={
              isSelected
                ? "rounded-[5px] border border-signal bg-signal px-[13px] py-[9px]"
                : "rounded-[5px] border border-control-border bg-transparent px-[13px] py-[9px]"
            }
          >
            <Text
              className={
                isSelected
                  ? "text-[13px] font-semibold text-on-signal"
                  : "text-[13px] font-semibold text-ink-soft"
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
