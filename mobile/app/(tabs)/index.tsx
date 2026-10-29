import Ionicons from "@expo/vector-icons/Ionicons";
import { Link, Redirect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import {
  firstVisibleTab,
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
} from "../../src/tabBar";
import { fonts, makeStyles, useTheme } from "../../src/theme";

/**
 * The app opens on this tab ("/"). When the user has hidden Start, send
 * them to their first visible tab instead; `Redirect` acts only while this
 * screen is focused, so hiding the tab from Konto does not navigate away.
 */
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

/**
 * A tile per section, like the web's Start page (`NavTiles`). Tiles follow
 * the tab bar's order and include hidden tabs, so those stay one tap away.
 */
function StartScreen() {
  const { colors, common } = useTheme();
  const styles = useStyles();
  const order = useTabBarStore((state) => state.order);
  const tiles = order.filter((name) => name !== "index" && name !== pinnedTab);
  return (
    <ScrollView style={common.screen} contentContainerStyle={styles.grid}>
      {tiles.map((name) => {
        const tab = tabDefinitions[name];
        return (
          <Link key={name} href={tab.href} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View style={styles.iconBox}>
                <Ionicons name={tab.icon} size={24} color={colors.onSignal} />
              </View>
              <Text style={styles.label}>{tab.title}</Text>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 14,
    padding: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.paper,
    shadowColor: "#1d3739",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.signal,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
  },
}));
