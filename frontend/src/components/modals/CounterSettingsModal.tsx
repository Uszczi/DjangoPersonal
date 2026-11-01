import { Button, Modal, ModalFooter, ToggleGroup } from "@/design-system";
import {
  COUNTER_TILE_VALUE_LABELS,
  COUNTER_VIEW_MODE_LABELS,
} from "@personal/shared/counterFormat";
import {
  COUNTER_TILE_VALUES,
  COUNTER_VIEW_MODES,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";

const sectionLabel =
  "m-0 mt-5 mb-2 font-utility text-[11px] font-semibold tracking-[0.08em] text-muted uppercase";

/** How the Counters list looks on this device; a choice applies at once. */
export function CounterSettingsModal({ onClose }: { onClose: () => void }) {
  const viewMode = useCounterViewStore((state) => state.mode);
  const setViewMode = useCounterViewStore((state) => state.setMode);
  const tileValue = useCounterViewStore((state) => state.tileValue);
  const setTileValue = useCounterViewStore((state) => state.setTileValue);

  return (
    <Modal
      kicker="LICZNIKI"
      title="Ustawienia liczników"
      titleId="counter-settings-title"
      onClose={onClose}
    >
      <p className={sectionLabel}>Widok</p>
      <ToggleGroup
        label="Widok liczników"
        options={COUNTER_VIEW_MODES}
        labels={COUNTER_VIEW_MODE_LABELS}
        value={viewMode}
        onChange={setViewMode}
      />
      {/* Only tiles have a middle, so the choice appears once tiles are on. */}
      {viewMode === "tiles" && (
        <>
          <p className={sectionLabel}>Na środku kafelka</p>
          <ToggleGroup
            label="Na środku kafelka"
            className="flex-wrap"
            options={COUNTER_TILE_VALUES}
            labels={COUNTER_TILE_VALUE_LABELS}
            value={tileValue}
            onChange={setTileValue}
          />
        </>
      )}
      <p className="m-0 mt-4 text-[12px] text-muted">
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
