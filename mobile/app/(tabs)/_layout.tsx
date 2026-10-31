import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useState } from "react";
import type { ColorValue } from "react-native";

import { LogoMark } from "@/ui/LogoMark";
import { MoreTabsMenu } from "@/features/tabs/MoreTabsMenu";
import {
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
  type TabDefinition,
} from "@/features/tabs/tabBar";
import { useTheme } from "@/theme";

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
  const { headerOptions, tabOptions } = useTheme();
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
          headerStyle: headerOptions.headerStyle,
          headerTintColor: headerOptions.headerTintColor,
          headerTitleStyle: headerOptions.headerTitleStyle,
          headerShadowVisible: false,
          headerLeft: () => <LogoMark />,
          ...tabOptions,
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
