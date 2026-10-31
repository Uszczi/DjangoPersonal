import { Pressable, Text } from "react-native";

import { useTheme } from "../theme";

type FabProps = { accessibilityLabel: string; onPress: () => void };

/**
 * The floating "+" in the bottom-right corner. Screen actions live in the
 * body rather than the native header, where buttons can miss taps on Android.
 */
export function Fab({ accessibilityLabel, onPress }: FabProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      // Echoes the web's signal tiles and logo mark rather than a round FAB.
      className="absolute right-5 bottom-8 size-14 items-center justify-center rounded-[10px] bg-signal active:opacity-80"
      // A theme colour at 25% has no Uniwind class (`shadow-deep-ink/25`
      // does not resolve the variable), so the shadow stays a style.
      style={{
        elevation: 4,
        shadowColor: colors.deepInk,
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <Text className="text-[30px] leading-8 text-on-signal">+</Text>
    </Pressable>
  );
}
