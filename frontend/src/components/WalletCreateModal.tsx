import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { Button, ErrorAlert, Field, Modal, ModalFooter, TextInput } from "@/design-system";
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
          <Button
            variant="secondary"
            onClick={close}
            disabled={isSaving}
          >
            Anuluj
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "Zapisywanie…" : "Utwórz portfel"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
