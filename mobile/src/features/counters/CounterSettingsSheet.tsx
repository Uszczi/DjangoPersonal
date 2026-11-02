import { Text } from "react-native";

import {
  COUNTER_CALENDAR_MODE_LABELS,
  COUNTER_TILE_VALUE_LABELS,
  COUNTER_VIEW_MODE_LABELS,
} from "@personal/shared/counterFormat";
import {
  COUNTER_CALENDAR_MODES,
  COUNTER_TILE_VALUES,
  COUNTER_VIEW_MODES,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";

import { Sheet, SheetItem } from "@/ui/Sheet";

/** The Liczniki list settings, opened from the gear in the tab's header. */
export function CounterSettingsSheet({ onClose }: { onClose: () => void }) {
  const viewMode = useCounterViewStore((state) => state.mode);
  const setViewMode = useCounterViewStore((state) => state.setMode);
  const tileValue = useCounterViewStore((state) => state.tileValue);
  const setTileValue = useCounterViewStore((state) => state.setTileValue);
  const calendar = useCounterViewStore((state) => state.calendar);
  const setCalendar = useCounterViewStore((state) => state.setCalendar);

  return (
    <Sheet title="Ustawienia liczników" onClose={onClose}>
      <Text className="pt-1 pb-0.5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
        WIDOK
      </Text>
      {COUNTER_VIEW_MODES.map((mode) => (
        <SheetItem
          key={mode}
          label={COUNTER_VIEW_MODE_LABELS[mode]}
          isSelected={mode === viewMode}
          onPress={() => setViewMode(mode)}
        />
      ))}
      {/* Only tiles have a middle, so the choice appears once tiles are on. */}
      {viewMode === "tiles" && (
        <>
          <Text className="pt-2 pb-0.5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
            NA ŚRODKU KAFELKA
          </Text>
          {COUNTER_TILE_VALUES.map((value) => (
            <SheetItem
              key={value}
              label={COUNTER_TILE_VALUE_LABELS[value]}
              isSelected={value === tileValue}
              onPress={() => setTileValue(value)}
            />
          ))}
        </>
      )}
      <Text className="pt-2 pb-0.5 font-utility text-[11px] font-semibold tracking-[0.9px] text-muted">
        KALENDARZ
      </Text>
      {COUNTER_CALENDAR_MODES.map((mode) => (
        <SheetItem
          key={mode}
          label={COUNTER_CALENDAR_MODE_LABELS[mode]}
          isSelected={mode === calendar}
          onPress={() => setCalendar(mode)}
        />
      ))}
      <Text className="pt-2 text-xs text-muted">
        Zapisywane na tym urządzeniu.
      </Text>
    </Sheet>
  );
}
