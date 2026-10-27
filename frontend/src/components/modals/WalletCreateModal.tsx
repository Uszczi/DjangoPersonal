import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  Button,
  ErrorAlert,
  Field,
  Modal,
  ModalFooter,
  TextInput,
} from "@/design-system";
import { WalletColorPicker } from "@/components/WalletColorPicker";
import { WalletIconPicker } from "@/components/WalletIconPicker";
import { balanceError } from "@personal/shared/money";
import { useCreateWallet } from "@personal/shared/queries/wallets";
import { DEFAULT_WALLET_COLOR } from "@personal/shared/walletColors";

type WalletCreateModalProps = {
  onClose: () => void;
};

/** The create modal: a name, a colour and the balance the wallet opens with. */
export function WalletCreateModal({ onClose }: WalletCreateModalProps) {
  const createWallet = useCreateWallet();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_WALLET_COLOR);
  const [icon, setIcon] = useState<string | null>(null);
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
      await createWallet.mutateAsync({
        name: trimmedName,
        color,
        icon,
        initialBalance,
      });
      onClose();
    } catch (error) {
      setFormError(await apiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      kicker="NOWE MIEJSCE"
      title="Nowy portfel"
      titleId="wallet-create-title"
      onClose={close}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nazwa portfela">
          <TextInput
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <WalletColorPicker value={color} onChange={setColor} />
        <WalletIconPicker value={icon} onChange={setIcon} />
        <Field label="Stan początkowy">
          <TextInput
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={initialBalance}
            onChange={(event) => setInitialBalance(event.target.value)}
          />
        </Field>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        <ModalFooter>
          <Button variant="secondary" onClick={close} disabled={isSaving}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" disabled={isSaving}>
            {isSaving ? "Zapisywanie…" : "Utwórz portfel"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
