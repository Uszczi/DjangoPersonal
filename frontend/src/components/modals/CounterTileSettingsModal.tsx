import { Button, Modal, ModalFooter, ToggleGroup } from "@/design-system";
import { COUNTER_TILE_VALUE_LABELS } from "@personal/shared/counterFormat";
import {
  COUNTER_TILE_VALUES,
  useCounterViewStore,
} from "@personal/shared/stores/counterView";

/** How the Counter tiles look on this device; a choice applies at once. */
export function CounterTileSettingsModal({ onClose }: { onClose: () => void }) {
  const tileValue = useCounterViewStore((state) => state.tileValue);
  const setTileValue = useCounterViewStore((state) => state.setTileValue);

  return (
    <Modal
      kicker="LICZNIKI"
      title="Wygląd kafelków"
      titleId="counter-tile-settings-title"
      onClose={onClose}
    >
      <p className="m-0 mt-5 mb-2 text-[13px] font-medium text-ink-soft">
        Na środku kafelka
      </p>
      <ToggleGroup
        label="Na środku kafelka"
        className="flex-wrap"
        options={COUNTER_TILE_VALUES}
        labels={COUNTER_TILE_VALUE_LABELS}
        value={tileValue}
        onChange={setTileValue}
      />
      <ModalFooter>
        <Button variant="primary" onClick={onClose}>
          Gotowe
        </Button>
      </ModalFooter>
    </Modal>
  );
}
