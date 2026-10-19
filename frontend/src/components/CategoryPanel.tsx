import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import { DeleteCategoryModal } from "@/components/DeleteCategoryModal";
import { ShowModal } from "@/stores/modal";
import { useCategoriesStore, type CategoryInput } from "@/stores/categories";
import type { CategoryResponse } from "@/generated/api";

/** Sidebar panel below the wallets list: inline create, rename, and delete. */
export function CategoryPanel() {
  const categories = useCategoriesStore((state) => state.categories);
  const isLoading = useCategoriesStore((state) => state.isLoading);
  const pageError = useCategoriesStore((state) => state.pageError);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const createCategory = useCategoriesStore((state) => state.createCategory);
  const renameCategory = useCategoriesStore((state) => state.renameCategory);

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState("");

  // The System category holds balance corrections; the user never manages it.
  const visibleCategories = categories.filter((category) => !category.isSystem);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function openDeleteDialog(category: CategoryResponse) {
    ShowModal(DeleteCategoryModal, { category });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: CategoryInput = { name: newName.trim() };
    if (!input.name) return;

    setIsCreating(true);
    setCreateError("");
    try {
      await createCategory(input);
      setNewName("");
    } catch (error) {
      setCreateError(await apiErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(category: CategoryResponse) {
    setEditingId(category.id);
    setEditName(category.name);
    setRenameError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setRenameError("");
  }

  async function handleRename(
    category: CategoryResponse,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const input: CategoryInput = { name: editName.trim() };
    if (!input.name) return;

    try {
      await renameCategory(category, input);
      setEditingId(null);
      setRenameError("");
    } catch (error) {
      setRenameError(await apiErrorMessage(error));
    }
  }

  return (
    <section
      className="mt-[34px] border-t border-line pt-[26px]"
      aria-label="Kategorie"
    >
      <div className="flex items-end justify-between gap-6 pb-0">
        <div>
          <h2 className="m-0 font-display text-[clamp(24px,3vw,34px)] font-semibold leading-none tracking-[-0.05em] text-ink">
            Kategorie
          </h2>
        </div>
      </div>

      <form
        className="mt-4 flex gap-[10px]"
        onSubmit={handleCreate}
      >
        <input
          className="min-w-0 flex-1 rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
          placeholder="Nowa kategoria"
          aria-label="Nowa kategoria"
          maxLength={100}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button
          className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#b94b31] disabled:cursor-wait disabled:opacity-70"
          type="submit"
          disabled={isCreating || !newName.trim()}
        >
          {isCreating ? "Dodawanie…" : "Dodaj"}
        </button>
      </form>
      {createError && (
        <p
          className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
          role="alert"
        >
          {createError}
        </p>
      )}

      {isLoading ? (
        <p className="pt-10 text-muted" role="status">
          Wczytywanie kategorii…
        </p>
      ) : pageError ? (
        <p
          className="m-0 px-2 py-6 text-[13px] text-[#873b2b]"
          role="alert"
        >
          {pageError}
        </p>
      ) : visibleCategories.length === 0 ? (
        <p className="m-0 border-b border-dashed border-[#ccd8d4] px-2 py-6 text-[13px] text-[#718487]">
          Brak kategorii.
        </p>
      ) : (
        <ul className="m-0 list-none p-0" aria-label="Lista kategorii">
          {visibleCategories.map((category) => (
            <li
              className="grid min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-3 py-[10px] grid-cols-[24px_minmax(0,1fr)_auto]"
              key={category.id}
            >
              {editingId === category.id ? (
                <form
                  className="contents"
                  onSubmit={(event) => void handleRename(category, event)}
                >
                  <input
                    className="w-full rounded border border-[#cbd7d3] bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none focus:border-[#477c7c] focus:ring-[3px] focus:ring-[rgb(71_124_124/15%)]"
                    autoFocus
                    aria-label="Nazwa kategorii"
                    maxLength={100}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelEditing();
                    }}
                  />
                  <div className="flex items-center gap-[13px]">
                    <button
                      className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-transparent bg-signal px-[15px] text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-[#b94b31] disabled:cursor-wait disabled:opacity-70"
                      type="submit"
                    >
                      Zapisz
                    </button>
                    <button
                      className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-3 whitespace-nowrap rounded-[5px] border border-[#c9d5d2] bg-transparent px-[15px] text-[12px] font-semibold text-[#344d52] transition-all hover:border-[#9db0ad] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-70"
                      type="button"
                      onClick={cancelEditing}
                    >
                      Anuluj
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="m-0 overflow-wrap-anywhere text-[13px] leading-[1.45] text-[#344d52]">
                      {category.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-[13px]">
                    <button
                      className="cursor-pointer bg-transparent p-0 text-[11px] text-[#567277] underline decoration-[#b5c4bf] underline-offset-[3px] hover:text-signal"
                      type="button"
                      aria-label={`Zmień nazwę kategorii: ${category.name}`}
                      onClick={() => startEditing(category)}
                    >
                      Zmień
                    </button>
                    <button
                      className="cursor-pointer bg-transparent p-0 text-[11px] text-[#8a5648] underline decoration-[#d3b8b0] underline-offset-[3px] hover:text-[#a23a28]"
                      type="button"
                      aria-label={`Usuń kategorię: ${category.name}`}
                      onClick={() => openDeleteDialog(category)}
                    >
                      Usuń
                    </button>
                  </div>
                </>
              )}
              {renameError && editingId === category.id && (
                <p
                  className="mb-[17px] border-l-[3px] border-signal bg-[#fff0eb] px-[11px] py-[9px] text-[12px] leading-relaxed text-[#873b2b]"
                  role="alert"
                >
                  {renameError}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
