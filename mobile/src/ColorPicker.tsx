import { Pressable, StyleSheet, View } from "react-native";

import { WALLET_COLORS } from "@personal/shared/walletColors";

import { colors } from "./theme";

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
};

/** The wallet colour as a row of swatches. */
export function ColorPicker({
  value,
  onChange,
  disabled = false,
}: ColorPickerProps) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {WALLET_COLORS.map((color) => {
        const isSelected = color.value === value;
        return (
          <Pressable
            key={color.value}
            accessibilityRole="radio"
            accessibilityLabel={color.label}
            accessibilityState={{ checked: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onChange(color.value)}
            style={[styles.ring, isSelected && styles.ringSelected]}
          >
            <View style={[styles.swatch, { backgroundColor: color.value }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ring: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ringSelected: { borderColor: colors.text },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
