import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

export type HeaderAction = {
  icon: ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * A stack header drawn in plain views, styled like the native one
 * (`headerOptions`). Screens use it through `header: () => ...` when they need
 * actions in the top bar: native header buttons can miss taps on Android,
 * these are ordinary Pressables with a generous hit area.
 *
 * `left` replaces the back button (the tabs show the logo there), and
 * `onTitlePress` turns the title into a button with a chevron, for a title
 * that opens a picker.
 */
export function ScreenHeader({
  title,
  actions = [],
  left,
  onTitlePress,
  titleAccessibilityLabel,
}: {
  title: string;
  actions?: HeaderAction[];
  left?: ReactNode;
  onTitlePress?: () => void;
  titleAccessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tint = colors.navText;

  return (
    // Matches the native header (`headerOptions` in theme.ts).
    <View className="bg-deep-ink" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 px-2 ios:h-11 android:h-14">
        {left ??
          (router.canGoBack() && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wstecz"
              hitSlop={12}
              onPress={() => router.back()}
              className="size-10 items-center justify-center"
            >
              <Ionicons
                name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
                size={24}
                color={tint}
              />
            </Pressable>
          ))}
        {onTitlePress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={titleAccessibilityLabel ?? title}
            hitSlop={8}
            onPress={onTitlePress}
            className="mx-2 min-h-10 flex-1 flex-row items-center gap-1.5 active:opacity-60"
          >
            <Text
              numberOfLines={1}
              className="shrink text-[16px] font-bold text-nav-text"
            >
              {title}
            </Text>
            <Ionicons name="chevron-down" size={16} color={tint} />
          </Pressable>
        ) : (
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="mx-2 flex-1 text-[16px] font-bold text-nav-text"
          >
            {title}
          </Text>
        )}
        {actions.map((action) => (
          <Pressable
            key={action.accessibilityLabel}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            hitSlop={16}
            onPress={action.onPress}
            className="size-10 items-center justify-center"
          >
            <Ionicons name={action.icon} size={22} color={tint} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
