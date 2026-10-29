import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { LogoMark } from "../../src/LogoMark";
import {
  tabDefinitions,
  useTabBarStore,
  type TabDefinition,
} from "../../src/tabBar";
import { fonts, useTheme } from "../../src/theme";

function tabIcon(name: TabDefinition["icon"]) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons
      name={name}
      color={typeof color === "string" ? color : undefined}
      size={size}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  // The user's order and visibility (Konto > Pasek kart). A hidden tab stays
  // a route (`href: null`), so links to it still work.
  const order = useTabBarStore((state) => state.order);
  const hidden = useTabBarStore((state) => state.hidden);
  return (
    <Tabs
      screenOptions={{
        // The web Navbar: a deep-ink bar with small monospace labels.
        headerStyle: { backgroundColor: colors.deepInk },
        headerTintColor: colors.navText,
        headerTitleStyle: { fontWeight: "700", fontSize: 16 },
        headerShadowVisible: false,
        headerLeft: () => <LogoMark />,
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarStyle: {
          backgroundColor: colors.deepInk,
          borderTopColor: colors.deepInk,
        },
        tabBarActiveTintColor: colors.onSignal,
        tabBarInactiveTintColor: colors.navMuted,
        tabBarActiveBackgroundColor: colors.navSelected,
        tabBarLabelStyle: {
          fontFamily: fonts.utility,
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.6,
        },
      }}
    >
      {order.map((name) => {
        const tab = tabDefinitions[name];
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title: tab.title,
              tabBarLabel: tab.label,
              tabBarIcon: tabIcon(tab.icon),
              href: hidden.includes(name) ? null : undefined,
            }}
          />
        );
      })}
    </Tabs>
  );
}
