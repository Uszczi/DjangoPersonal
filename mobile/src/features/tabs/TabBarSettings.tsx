import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Switch, Text, View } from "react-native";
import {
  NestedReorderableList,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";

import { Button } from "@/ui/Button";
import {
  pinnedTab,
  tabDefinitions,
  useTabBarStore,
  type TabName,
} from "@/features/tabs/tabBar";
import { useUpdateHiddenTabs } from "@/queries/mobileSettings";
import { useTheme } from "@/theme";
import { card, form } from "@/ui/classes";

/**
 * The Konto section that picks which bottom tabs show and in what order:
 * a switch per tab, and a long press drags a tab to another place, like the
 * Tasks on the Project screen. Konto itself cannot be hidden. Visibility is
 * saved to the account; the order stays on this device. Its screen scrolls
 * in a `ScrollViewContainer`, which the nested reorderable list needs.
 */
export function TabBarSettings() {
  const order = useTabBarStore((state) => state.order);
  const move = useTabBarStore((state) => state.move);
  const reset = useTabBarStore((state) => state.reset);
  const { mutate } = useUpdateHiddenTabs();

  const toggleVisibility = (name: TabName, isVisible: boolean) => {
    const hidden = useTabBarStore.getState().hidden;
    const next = isVisible
      ? hidden.filter((item) => item !== name)
      : [...hidden, name];
    mutate(next);
  };

  const restoreDefaults = () => {
    reset();
    mutate([]);
  };

  return (
    <View className={card.section}>
      <Text className={card.kicker}>PASEK KART</Text>
      <NestedReorderableList
        // The outer ScrollViewContainer scrolls; a scrolling FlatList inside it
        // is the nested-VirtualizedList warning.
        scrollEnabled={false}
        data={order}
        keyExtractor={(name) => name}
        onReorder={({ from, to }: ReorderableListReorderEvent) =>
          move(from, to)
        }
        renderItem={({ item }) => (
          <TabRow name={item} onToggle={toggleVisibility} />
        )}
      />
      <Text className={form.hint}>
        Przytrzymaj kartę, aby zmienić jej miejsce. Widoczność kart zapisuje się
        na koncie; ich kolejność — na tym urządzeniu. Karty Konto nie można
        ukryć; gdy któraś karta jest ukryta, w jej miejscu jest Więcej z
        ukrytymi kartami i Kontem.
      </Text>
      <View className="mt-1 flex-row">
        <Button
          label="Przywróć domyślne"
          variant="secondary"
          onPress={restoreDefaults}
        />
      </View>
    </View>
  );
}

function TabRow({
  name,
  onToggle,
}: {
  name: TabName;
  onToggle: (name: TabName, isVisible: boolean) => void;
}) {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const isVisible = useTabBarStore((state) => !state.hidden.includes(name));
  const tab = tabDefinitions[name];
  const isPinned = name === pinnedTab;
  return (
    <Pressable
      // A dragged row floats over its neighbours, so it needs its own fill.
      className="flex-row items-center gap-2.5 border-b border-row-line bg-paper py-2"
      accessibilityLabel={tab.title}
      accessibilityHint="Przytrzymaj, aby zmienić kolejność"
      onLongPress={drag}
    >
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
      <Switch
        accessibilityLabel={`Pokazuj kartę ${tab.title}`}
        value={isVisible}
        disabled={isPinned}
        onValueChange={(value) => onToggle(name, value)}
        trackColor={{ true: colors.signal, false: colors.controlBorder }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Przenieś kartę ${tab.title}`}
        accessibilityHint="Przytrzymaj i przeciągnij, aby zmienić kolejność"
        hitSlop={8}
        delayLongPress={150}
        onLongPress={drag}
        className="h-[34px] w-7 items-center justify-center"
      >
        <Ionicons name="reorder-three" size={22} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}
