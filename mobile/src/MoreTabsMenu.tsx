import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Modal, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { pinnedTab, tabDefinitions, type TabName } from "./tabBar";
import { fonts, makeStyles, useTheme } from "./theme";

/**
 * The popup behind the Więcej tab, which stands in for Konto while some tabs
 * are hidden: it lists the hidden tabs, in the bar's order, then Konto.
 */
export function MoreTabsMenu({
  hidden,
  onClose,
}: {
  hidden: TabName[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const names = [...hidden, pinnedTab];

  function open(name: TabName) {
    onClose();
    router.navigate(tabDefinitions[name].href);
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Zamknij menu"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: 12 + insets.bottom }]}
          // Taps inside the sheet must not reach the backdrop.
          onPress={() => {}}
        >
          <Text style={styles.kicker}>WIĘCEJ</Text>
          {names.map((name) => {
            const tab = tabDefinitions[name];
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                onPress={() => open(name)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Ionicons name={tab.icon} size={22} color={colors.ink} />
                <Text style={styles.title}>{tab.title}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.paper,
  },
  kicker: {
    fontFamily: fonts.utility,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
    color: colors.muted,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  pressed: { opacity: 0.6 },
  title: { fontSize: 15, fontWeight: "500", color: colors.ink },
}));
