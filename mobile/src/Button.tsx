import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "./theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  isBusy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  isBusy = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || isBusy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: isBusy }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || isDisabled) && styles.dimmed,
        style,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator
          color={variant === "secondary" ? colors.textSoft : colors.onPrimary}
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The web Button: 5px corners, a 1px border and a small semibold label.
  base: {
    flex: 1,
    minHeight: 44,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    borderColor: colors.controlBorder,
    backgroundColor: "transparent",
  },
  danger: { backgroundColor: colors.danger },
  dimmed: { opacity: 0.7 },
  label: { fontSize: 13, fontWeight: "600" },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.textSoft },
  danger: { color: colors.onPrimary },
});
