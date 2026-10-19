import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { balanceError } from "@/money";
import { useWalletsStore } from "@/stores/wallets";

type WalletCreateModalProps = {
  onClose: () => void;
};

/** The create modal: a name and the balance the wallet opens with. */
export function WalletCreateModal({ onClose }: WalletCreateModalProps) {
  const createWallet = useWalletsStore((state) => state.createWallet);

  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function close() {
    if (!isSaving) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Podaj nazwę portfela.");
      return;
    }
    const balanceProblem = balanceError(initialBalance);
    if (balanceProblem) {
      setFormError(balanceProblem);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await createWallet({ name: trimmedName, initialBalance });
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-5 flex items-center justify-center bg-[rgb(12_29_33/52%)] p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="w-full max-w-[480px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-create-title"
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              NOWE MIEJSCE
            </p>
            <h2
              id="wallet-create-title"
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              Nowy portfel
            </h2>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-[23px] text-[#64797c] transition-all hover:-translate-y-px hover:bg-[#eaf0ed] cursor-pointer"
            onClick={close}
            aria-label="Zamknij"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Nazwa portfela</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              autoFocus
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="mb-[18px] grid gap-2 text-[12px] font-semibold text-[#334d52]">
            <span>Stan początkowy</span>
            <input
              className="w-full resize-y rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none transition-shadow focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
            />
          </label>
          {formError && (
            <p
              className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
              role="alert"
            >
              {formError}
            </p>
          )}
          <div className="mt-[26px] flex justify-end gap-[9px] border-t border-[#e1e8e3] pt-[18px]">
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
              type="button"
              onClick={close}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#b94b31] disabled:cursor-wait disabled:opacity-70"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Zapisywanie…" : "Utwórz portfel"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
