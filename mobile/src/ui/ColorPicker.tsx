import { Pressable, View } from "react-native";

import { COLORS } from "@personal/shared/colors";

import { makeStyles } from "../theme";

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
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
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
            style={[styles.ring, isSelected && styles.ringSelected]}
          >
            <View style={[styles.swatch, { backgroundColor: color.value }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ring: {
    padding: 3,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ringSelected: { borderColor: colors.ink },
  swatch: { width: 32, height: 32, borderRadius: 16 },
}));
