import type { HeaderAction } from "@/ui/ScreenHeader";

/** The header button opening the task list settings. */
export function taskListSettingsAction(onPress: () => void): HeaderAction {
  return {
    icon: "settings-outline",
    accessibilityLabel: "Ustawienia listy zadań",
    onPress,
  };
}
