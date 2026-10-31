import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Redirect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  firstVisibleTab,
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
} from "@/features/tabs/tabBar";
import { useTheme } from "@/theme";
import { common } from "@/ui/classes";

export default function StartTab() {
  const target = useTabBarStore((state) =>
    state.hidden.includes("index")
      ? firstVisibleTab(state.order, state.hidden)
      : null,
  );
  return target === null ? (
    <StartScreen />
  ) : (
    <Redirect href={tabDefinitions[target].href} />
  );
}

function StartScreen() {
  const { colors } = useTheme();
  const order = useTabBarStore((state) => state.order);
  const tiles = order.filter((name) => name !== "index" && name !== pinnedTab);
  return (
    <ScrollView
      className={common.screen}
      contentContainerClassName="flex-row flex-wrap gap-3 p-4"
    >
      {tiles.map((name) => {
        const tab = tabDefinitions[name];
        return (
          <Link key={name} href={tab.href} asChild>
            <Pressable
              accessibilityRole="link"
              className="grow basis-[47%] gap-3.5 rounded-lg border border-card-line bg-paper p-[18px] shadow-[0_8px_18px_rgba(29,55,57,0.05)] active:opacity-70"
            >
              <View className="size-12 items-center justify-center rounded-lg bg-signal">
                <Ionicons name={tab.icon} size={24} color={colors.onSignal} />
              </View>
              <Text className="font-display text-[17px] font-semibold text-ink">
                {tab.title}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}
