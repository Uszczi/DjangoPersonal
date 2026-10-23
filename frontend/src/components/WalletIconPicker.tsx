import { IconPicker } from "@/design-system";
import { WALLET_ICON_SUGGESTIONS } from "@/walletIcons";

type WalletIconPickerProps = {
  value: string | null;
  onChange: (icon: string | null) => void;
};

/** The wallet's optional icon, as a form row matching `WalletColorPicker`. */
export function WalletIconPicker({ value, onChange }: WalletIconPickerProps) {
  return (
    <div className="mb-[18px] grid justify-items-start gap-2">
      <span className="text-[12px] font-semibold text-ink-soft">Ikona (opcjonalnie)</span>
      <IconPicker
        label="Ikona portfela"
        noneLabel="Bez ikony"
        value={value}
        onChange={onChange}
        suggestions={WALLET_ICON_SUGGESTIONS}
      />
    </div>
  );
}
