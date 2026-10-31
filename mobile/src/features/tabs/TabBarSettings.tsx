import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Switch, Text, View } from "react-native";

import { Button } from "../../ui/Button";
import {
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
  type TabName,
} from "./tabBar";
import { makeStyles, useTheme } from "../../theme";

/**
 * The Konto section that picks which bottom tabs show and in what order:
 * a switch per tab and arrows to move it. Konto itself cannot be hidden.
 */
export function TabBarSettings() {
  const { card, form } = useTheme();
  const order = useTabBarStore((state) => state.order);
  const reset = useTabBarStore((state) => state.reset);
  return (
    <View style={card.section}>
      <Text style={card.kicker}>PASEK KART</Text>
      <View>
        {order.map((name, index) => (
          <TabRow
            key={name}
            name={name}
            isFirst={index === 0}
            isLast={index === order.length - 1}
          />
        ))}
      </View>
      <Text style={form.hint}>
        Zapisywany na tym urządzeniu. Karty Konto nie można ukryć; gdy któraś
        karta jest ukryta, w jej miejscu jest Więcej z ukrytymi kartami i
        Kontem.
      </Text>
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        <Button label="Przywróć domyślne" variant="secondary" onPress={reset} />
      </View>
    </View>
  );
}

function TabRow({
  name,
  isFirst,
  isLast,
}: {
  name: TabName;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isVisible = useTabBarStore((state) => !state.hidden.includes(name));
  const setVisible = useTabBarStore((state) => state.setVisible);
  const move = useTabBarStore((state) => state.move);
  const tab = tabDefinitions[name];
  const isPinned = name === pinnedTab;
  return (
    <View style={styles.row}>
      <Ionicons
        name={tab.icon}
        size={20}
        color={isVisible ? colors.ink : colors.muted}
      />
      <Text style={[styles.title, !isVisible && styles.hidden]}>
        {tab.title}
      </Text>
      <MoveButton
        icon="chevron-up"
        label={`Przesuń ${tab.title} wyżej`}
        disabled={isFirst}
        onPress={() => move(name, -1)}
      />
      <MoveButton
        icon="chevron-down"
        label={`Przesuń ${tab.title} niżej`}
        disabled={isLast}
        onPress={() => move(name, 1)}
      />
      <Switch
        accessibilityLabel={`Pokazuj kartę ${tab.title}`}
        value={isVisible}
        disabled={isPinned}
        onValueChange={(value) => setVisible(name, value)}
        trackColor={{ true: colors.signal, false: colors.controlBorder }}
      />
    </View>
  );
}

function MoveButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "chevron-up" | "chevron-down";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.move,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowLine,
  },
  title: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.ink },
  hidden: { color: colors.muted },
  move: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.controlBorder,
  },
  dimmed: { opacity: 0.35 },
}));
