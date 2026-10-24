import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { Button, ErrorAlert, Field, Modal, ModalFooter, TextInput } from "@/design-system";
import type { WalletResponse } from "@/generated/api";
import { DeleteWalletModal } from "@/components/modals/DeleteWalletModal";
import { WalletColorPicker } from "@/components/WalletColorPicker";
import { WalletIconPicker } from "@/components/WalletIconPicker";
import { balanceError } from "@/money";
import { ShowModal } from "@/stores/modal";
import { useWalletsStore } from "@/stores/wallets";

type WalletEditModalProps = {
  wallet: WalletResponse;
  onClose: () => void;
};

/**
 * The edit modal: rename, recolour or re-icon the wallet and/or state the balance it now holds.
 * Changing the balance writes a System correction, so the ledger keeps
 * summing to what the user says they have.
 */
export function WalletEditModal({ wallet, onClose }: WalletEditModalProps) {
  const updateWallet = useWalletsStore((state) => state.updateWallet);

  const [name, setName] = useState(wallet.name);
  const [color, setColor] = useState(wallet.color);
  const [icon, setIcon] = useState<string | null>(wallet.icon ?? null);
  const [currentBalance, setCurrentBalance] = useState(wallet.balance ?? "0.00");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

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
    const balanceProblem = balanceError(currentBalance);
    if (balanceProblem) {
      setFormError(balanceProblem);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      await updateWallet(wallet, {
        name: trimmedName,
        color,
        icon,
        currentBalance: currentBalance.trim(),
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
      kicker="ZMIANA SZCZEGÓŁÓW"
      title="Edytuj portfel"
      titleId="wallet-edit-title"
      onClose={close}
      onEdit={isEditing ? undefined : () => setIsEditing(true)}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={!isEditing} className="contents">
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
          <Field label="Stan aktualny">
            <TextInput
              inputMode="decimal"
              autoComplete="off"
              value={currentBalance}
              onChange={(event) => setCurrentBalance(event.target.value)}
            />
          </Field>
        </fieldset>
        {formError && <ErrorAlert>{formError}</ErrorAlert>}
        {isEditing && (
          <ModalFooter>
            <Button
              variant="ghostDanger"
              className="mr-auto"
              onClick={() => {
                onClose();
                ShowModal(DeleteWalletModal, { wallet });
              }}
              disabled={isSaving}
            >
              Usuń
            </Button>
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
              {isSaving ? "Zapisywanie…" : "Zapisz zmiany"}
            </Button>
          </ModalFooter>
        )}
      </form>
    </Modal>
  );
}
