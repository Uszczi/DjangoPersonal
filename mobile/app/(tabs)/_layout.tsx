import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { LogoMark } from "../../src/LogoMark";
import { fonts, useTheme } from "../../src/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
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
      <Tabs.Screen
        name="index"
        options={{ title: "Projekty", tabBarIcon: tabIcon("folder-outline") }}
      />
      <Tabs.Screen
        name="time"
        options={{ title: "Czas", tabBarIcon: tabIcon("time-outline") }}
      />
      <Tabs.Screen
        name="expenses"
        options={{ title: "Wydatki", tabBarIcon: tabIcon("wallet-outline") }}
      />
      <Tabs.Screen
        name="counters"
        options={{
          title: "Liczniki",
          tabBarIcon: tabIcon("stats-chart-outline"),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Konto",
          tabBarIcon: tabIcon("person-circle-outline"),
        }}
      />
    </Tabs>
  );
}
