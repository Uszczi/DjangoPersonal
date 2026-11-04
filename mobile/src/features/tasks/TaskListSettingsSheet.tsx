import { Switch, Text } from "react-native";

import { Sheet, SheetRow } from "@/ui/Sheet";
import { useTaskListSettingsStore } from "@personal/shared/stores/taskListSettings";
import { useTheme } from "@/theme";

/** The task list settings, opened from the gear in the task lists' header. */
export function TaskListSettingsSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const setShowTimerButton = useTaskListSettingsStore(
    (state) => state.setShowTimerButton,
  );
  const showDragHandle = useTaskListSettingsStore(
    (state) => state.showDragHandle,
  );
  const setShowDragHandle = useTaskListSettingsStore(
    (state) => state.setShowDragHandle,
  );
  const showCommentCount = useTaskListSettingsStore(
    (state) => state.showCommentCount,
  );
  const setShowCommentCount = useTaskListSettingsStore(
    (state) => state.setShowCommentCount,
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
      <SheetRow>
        <Text className="flex-1 text-[15px] font-medium text-ink">
          Liczba komentarzy w każdym wierszu
        </Text>
        <Switch
          accessibilityLabel="Liczba komentarzy w każdym wierszu"
          value={showCommentCount}
          onValueChange={setShowCommentCount}
          trackColor={{ true: colors.signal, false: colors.controlBorder }}
        />
      </SheetRow>
      <SheetRow>
        <Text className="flex-1 text-[15px] font-medium text-ink">
          Uchwyt przeciągania w każdym wierszu
        </Text>
        <Switch
          accessibilityLabel="Uchwyt przeciągania w każdym wierszu"
          value={showDragHandle}
          onValueChange={setShowDragHandle}
          trackColor={{ true: colors.signal, false: colors.controlBorder }}
        />
      </SheetRow>
      <Text className="pt-2 text-xs text-muted">
        Bez uchwytu zadanie przeciągniesz, przytrzymując cały wiersz.
      </Text>
      <Text className="pt-2 text-xs text-muted">
        Zapisywane na tym urządzeniu.
      </Text>
    </Sheet>
  );
}
