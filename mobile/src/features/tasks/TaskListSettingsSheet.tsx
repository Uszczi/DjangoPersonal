import { Switch, Text } from "react-native";

import { Sheet, SheetRow } from "../../ui/Sheet";
import { useTaskListSettingsStore } from "./taskListSettings";
import { useTheme } from "../../theme";

/** The task list settings, opened from the gear in the task lists' header. */
export function TaskListSettingsSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const setShowTimerButton = useTaskListSettingsStore(
    (state) => state.setShowTimerButton,
  );

  return (
    <Sheet title="Ustawienia listy zadań" onClose={onClose}>
      <SheetRow>
        <Text className="flex-1 text-[15px] font-medium text-ink">
          Przycisk timera w każdym wierszu
        </Text>
        <Switch
          accessibilityLabel="Przycisk timera w każdym wierszu"
          value={showTimerButton}
          onValueChange={setShowTimerButton}
          trackColor={{ true: colors.signal, false: colors.controlBorder }}
        />
      </SheetRow>
      <Text className="pt-2 text-xs text-muted">
        Zapisywane na tym urządzeniu.
      </Text>
    </Sheet>
  );
}
