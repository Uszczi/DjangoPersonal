import { Button, Modal, ModalFooter } from "@/design-system";
import { useTaskListSettingsStore } from "@personal/shared/stores/taskListSettings";

/** How the task list shows its rows on this device; a choice applies at once. */
export function TaskListSettingsModal({ onClose }: { onClose: () => void }) {
  const showTimerButton = useTaskListSettingsStore(
    (state) => state.showTimerButton,
  );
  const setShowTimerButton = useTaskListSettingsStore(
    (state) => state.setShowTimerButton,
  );

  return (
    <Modal
      kicker="ZADANIA"
      title="Ustawienia listy zadań"
      titleId="task-list-settings-title"
      onClose={onClose}
    >
      <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 text-[14px] font-medium text-ink">
        Przycisk timera w każdym wierszu
        <input
          type="checkbox"
          role="switch"
          className="size-4 cursor-pointer accent-signal"
          checked={showTimerButton}
          onChange={(event) => setShowTimerButton(event.target.checked)}
        />
      </label>
      <p className="m-0 mt-3 text-[12px] text-muted">
        Zapisywane na tym urządzeniu.
      </p>
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Gotowe
        </Button>
      </ModalFooter>
    </Modal>
  );
}
