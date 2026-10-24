import { WALLET_COLORS } from "@personal/shared/walletColors";

type WalletColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

/**
 * The wallet colour as a row of swatches. A radio group in a fieldset rather
 * than a `Field`, because `Field` nests its control in a single `<label>`.
 */
export function WalletColorPicker({ value, onChange }: WalletColorPickerProps) {
  return (
    <fieldset className="mb-[18px] grid gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-[12px] font-semibold text-ink-soft">Kolor</legend>
      <div className="flex flex-wrap gap-2">
        {WALLET_COLORS.map((color) => (
          <label key={color.value} className="cursor-pointer" title={color.label}>
            <input
              type="radio"
              name="wallet-color"
              className="peer sr-only"
              value={color.value}
              checked={value === color.value}
              onChange={() => onChange(color.value)}
              aria-label={color.label}
            />
            <span
              aria-hidden="true"
              className="block h-8 w-8 rounded-full border-2 border-transparent ring-offset-2 transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
              style={{ backgroundColor: color.value }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
