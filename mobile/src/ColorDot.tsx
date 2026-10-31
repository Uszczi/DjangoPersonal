import { View } from "react-native";

/** A Counter's colour as a small circle next to its name; decorative. */
export function ColorDot({
  color,
  size = 10,
}: {
  color: string;
  size?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}
