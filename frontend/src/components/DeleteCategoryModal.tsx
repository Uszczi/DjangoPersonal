import { useState } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import type { CategoryResponse } from "@/generated/api";
import { useCategoriesStore } from "@/stores/categories";

type DeleteCategoryModalProps = {
  category: CategoryResponse;
  onClose: () => void;
};

export function DeleteCategoryModal({
  category,
  onClose,
}: DeleteCategoryModalProps) {
  const confirmCategoryDelete = useCategoriesStore(
    (state) => state.confirmCategoryDelete,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  function close() {
    if (!isDeleting) onClose();
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");

    try {
      await confirmCategoryDelete(category);
      onClose();
    } catch (error) {
      setDeleteError(await apiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-5 flex items-start justify-center bg-[rgb(12_29_33/52%)] px-0 py-4 pt-16 md:px-5 md:py-5 md:pt-5 md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="w-full max-w-[430px] rounded-lg border border-[#d4dfda] bg-paper p-[29px] shadow-[0_24px_80px_rgb(9_24_28/25%)] animate-dialog-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-delete-title"
      >
        <div className="mb-[27px] flex items-start justify-between">
          <div>
            <p className="mb-[9px] font-utility text-[10px] font-bold leading-[1.4] tracking-[0.14em] text-signal">
              POTWIERDŹ USUNIĘCIE
            </p>
            <h2
              id="category-delete-title"
              className="m-0 font-display text-[28px] leading-[1.1] tracking-[-0.05em] text-ink"
            >
              Usunąć kategorię?
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

        <p className="m-0 mt-5 text-[13px] leading-relaxed text-[#40595c] break-words">
          Kategoria „{category.name}" zostanie trwale usunięta wraz ze wszystkimi
          transakcjami, które do niej należą.
        </p>
        {deleteError && (
          <p
            className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
            role="alert"
          >
            {deleteError}
          </p>
        )}
        <div className="mt-[26px] flex justify-end gap-[9px] border-t border-[#e1e8e3] pt-[18px]">
          <button
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
            type="button"
            onClick={close}
            disabled={isDeleting}
          >
            Anuluj
          </button>
          <button
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-[5px] border border-transparent bg-[#a23a28] px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#872d1e] disabled:cursor-wait disabled:opacity-70"
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
          >
            {isDeleting ? "Usuwanie…" : "Usuń kategorię"}
          </button>
        </div>
      </section>
    </div>
  );
}
