import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useTheme } from "./theme";

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
 */
export function ScreenHeader({
  title,
  actions = [],
}: {
  title: string;
  actions?: HeaderAction[];
}) {
  const { headerOptions } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const tint = headerOptions.headerTintColor;

  return (
    <View style={[headerOptions.headerStyle, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {router.canGoBack() && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wstecz"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.button}
          >
            <Ionicons
              name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
              size={24}
              color={tint}
            />
          </Pressable>
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            styles.title,
            headerOptions.headerTitleStyle,
            { color: tint },
          ]}
        >
          {title}
        </Text>
        {actions.map((action) => (
          <Pressable
            key={action.accessibilityLabel}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            hitSlop={16}
            onPress={action.onPress}
            style={styles.button}
          >
            <Ionicons name={action.icon} size={22} color={tint} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    height: Platform.OS === "ios" ? 44 : 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, marginHorizontal: 8 },
}));
