import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Switch, Text, View } from "react-native";

import { Button } from "@/ui/Button";
import {
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
  type TabName,
} from "@/features/tabs/tabBar";
import { useTheme } from "@/theme";
import { card, form } from "@/ui/classes";

/**
 * The Konto section that picks which bottom tabs show and in what order:
 * a switch per tab and arrows to move it. Konto itself cannot be hidden.
 */
export function TabBarSettings() {
  const order = useTabBarStore((state) => state.order);
  const reset = useTabBarStore((state) => state.reset);
  return (
    <View className={card.section}>
      <Text className={card.kicker}>PASEK KART</Text>
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
      <Text className={form.hint}>
        Zapisywany na tym urządzeniu. Karty Konto nie można ukryć; gdy któraś
        karta jest ukryta, w jej miejscu jest Więcej z ukrytymi kartami i
        Kontem.
      </Text>
      <View className="mt-1 flex-row">
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
  const isVisible = useTabBarStore((state) => !state.hidden.includes(name));
  const setVisible = useTabBarStore((state) => state.setVisible);
  const move = useTabBarStore((state) => state.move);
  const tab = tabDefinitions[name];
  const isPinned = name === pinnedTab;
  return (
    <View className="flex-row items-center gap-2.5 border-b border-row-line py-2">
      <Ionicons
        name={tab.icon}
        size={20}
        color={isVisible ? colors.ink : colors.muted}
      />
      <Text
        className={
          isVisible
            ? "flex-1 text-sm font-medium text-ink"
            : "flex-1 text-sm font-medium text-muted"
        }
      >
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      className={`size-[34px] items-center justify-center rounded-[5px] border border-control-border ${disabled ? "opacity-35" : "active:opacity-35"}`}
    >
      <Ionicons name={icon} size={18} color={colors.inkSoft} />
    </Pressable>
  );
}
