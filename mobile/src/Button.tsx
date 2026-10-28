import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { makeStyles, useTheme } from "./theme";

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
  const { colors } = useTheme();
  const styles = useStyles();
  const labelStyles = useLabelStyles();
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
          color={variant === "secondary" ? colors.inkSoft : colors.onSignal}
        />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
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
  primary: { backgroundColor: colors.signal },
  secondary: {
    borderColor: colors.controlBorder,
    backgroundColor: "transparent",
  },
  danger: { backgroundColor: colors.danger },
  dimmed: { opacity: 0.7 },
  label: { fontSize: 13, fontWeight: "600" },
}));

const useLabelStyles = makeStyles((colors) => ({
  primary: { color: colors.onSignal },
  secondary: { color: colors.inkSoft },
  danger: { color: colors.onSignal },
}));
