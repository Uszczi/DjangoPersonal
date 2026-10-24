import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { colors } from "../../src/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === "string" ? color : undefined} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary }}>
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
        options={{ title: "Liczniki", tabBarIcon: tabIcon("stats-chart-outline") }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Konto", tabBarIcon: tabIcon("person-circle-outline") }}
      />
    </Tabs>
  );
}
