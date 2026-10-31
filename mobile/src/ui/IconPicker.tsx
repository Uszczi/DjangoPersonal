import { Pressable, Text, View } from "react-native";

import type { IconSuggestion } from "@personal/shared/iconSuggestion";

import { NamedIcon } from "./NamedIcon";
import { useTheme } from "../theme";

type IconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
  suggestions: readonly IconSuggestion[];
  /** Offer "no icon" (wallets); categories always have one. */
  noneLabel?: string;
  fallback: string;
  disabled?: boolean;
};

const CELL =
  "size-11 items-center justify-center rounded-[5px] border border-control-border bg-input";
const CELL_SELECTED =
  "size-11 items-center justify-center rounded-[5px] border border-signal bg-signal";

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
  const { colors } = useTheme();
  const options =
    value && !suggestions.some((item) => item.value === value)
      ? [{ value, label: value }, ...suggestions]
      : suggestions;

  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {noneLabel && (
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={noneLabel}
          accessibilityState={{ checked: value === null, disabled }}
          disabled={disabled}
          onPress={() => onChange(null)}
          className={value === null ? CELL_SELECTED : CELL}
        >
          <Text className="text-[18px] text-muted">—</Text>
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
            className={isSelected ? CELL_SELECTED : CELL}
          >
            <NamedIcon
              name={option.value}
              fallback={fallback}
              color={isSelected ? colors.onSignal : colors.ink}
              size={22}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
