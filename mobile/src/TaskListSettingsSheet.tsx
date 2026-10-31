import { Switch, Text } from "react-native";

import { Sheet, SheetRow } from "./Sheet";
import { useTaskListSettingsStore } from "./taskListSettings";
import { makeStyles, useTheme } from "./theme";

/** The task list settings, opened from the gear in the task lists' header. */
export function TaskListSettingsSheet({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const setShowTimerButton = useTaskListSettingsStore(
    (state) => state.setShowTimerButton,
  );

  return (
    <Sheet title="Ustawienia listy zadań" onClose={onClose}>
      <SheetRow>
        <Text style={styles.label}>Przycisk timera w każdym wierszu</Text>
        <Switch
          accessibilityLabel="Przycisk timera w każdym wierszu"
          value={showTimerButton}
          onValueChange={setShowTimerButton}
          trackColor={{ true: colors.signal, false: colors.controlBorder }}
        />
      </SheetRow>
      <Text style={styles.hint}>Zapisywane na tym urządzeniu.</Text>
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  label: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.ink },
  hint: { fontSize: 12, color: colors.muted, paddingTop: 8 },
}));
