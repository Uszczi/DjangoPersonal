import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  isBusy?: boolean;
  /**
   * How the button sits in its row; by default it shares the row with its
   * neighbours (`flex-1`). Give `flex-none` for a button sized to its label.
   */
  className?: string;
  accessibilityLabel?: string;
};

// The web Button: 5px corners, a 1px border and a small semibold label.
const BASE =
  "min-h-11 items-center justify-center rounded-[5px] border px-[15px] py-2.5";

const VARIANTS: Record<Variant, string> = {
  primary: "border-transparent bg-signal",
  secondary: "border-control-border bg-transparent",
  danger: "border-transparent bg-danger",
};

const LABELS: Record<Variant, string> = {
  primary: "text-[13px] font-semibold text-on-signal",
  secondary: "text-[13px] font-semibold text-ink-soft",
  danger: "text-[13px] font-semibold text-on-signal",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  isBusy = false,
  className = "flex-1",
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
      className={`${BASE} ${VARIANTS[variant]} ${isDisabled ? "opacity-70" : "active:opacity-70"} ${className}`}
    >
      {isBusy ? (
        <ActivityIndicator
          colorClassName={
            variant === "secondary" ? "accent-ink-soft" : "accent-on-signal"
          }
        />
      ) : (
        <Text className={LABELS[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
