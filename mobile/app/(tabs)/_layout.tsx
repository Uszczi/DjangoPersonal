import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useState } from "react";
import type { ColorValue } from "react-native";

import { LogoMark } from "../../src/LogoMark";
import { MoreTabsMenu } from "../../src/MoreTabsMenu";
import {
  pinnedTab,
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
  // The user's order and visibility (Konto > Pasek kart). A hidden tab only
  // loses its button: `href: null` would mark the tab hidden, and expo-router
  // redirects away from a focused hidden tab, so Więcej could never open it.
  const order = useTabBarStore((state) => state.order);
  const hidden = useTabBarStore((state) => state.hidden);
  // While some tabs are hidden, Konto's place shows Więcej: a popup with the
  // hidden tabs and Konto itself.
  const hiddenInOrder = order.filter((name) => hidden.includes(name));
  const hasMore = hiddenInOrder.length > 0;
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  return (
    <>
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
          const isMore = hasMore && name === pinnedTab;
          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: tab.title,
                tabBarLabel: isMore ? "Więcej" : tab.label,
                tabBarIcon: tabIcon(isMore ? "ellipsis-horizontal" : tab.icon),
                tabBarItemStyle: hidden.includes(name)
                  ? { display: "none" }
                  : undefined,
              }}
              listeners={
                isMore
                  ? {
                      tabPress: (event) => {
                        event.preventDefault();
                        setIsMoreOpen(true);
                      },
                    }
                  : undefined
              }
            />
          );
        })}
      </Tabs>
      {isMoreOpen && (
        <MoreTabsMenu
          hidden={hiddenInOrder}
          onClose={() => setIsMoreOpen(false)}
        />
      )}
    </>
  );
}
