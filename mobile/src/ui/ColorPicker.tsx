import { Pressable, View } from "react-native";

import { COLORS } from "@personal/shared/colors";

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

/** A Wallet's or a Counter's colour as a row of swatches. */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
}: ColorPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {COLORS.map((color) => {
        const isSelected = color.value === value;
        return (
          <Pressable
            key={color.value}
            accessibilityRole="radio"
            accessibilityLabel={color.label}
            accessibilityState={{ checked: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onChange(color.value)}
            className={
              isSelected
                ? "rounded-[22px] border-2 border-ink p-[3px]"
                : "rounded-[22px] border-2 border-transparent p-[3px]"
            }
          >
            <View
              className="size-8 rounded-2xl"
              style={{ backgroundColor: color.value }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
