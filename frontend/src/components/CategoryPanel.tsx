import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@/apiErrorMessage";
import {
  Button,
  DeleteButton,
  EditButton,
  ErrorAlert,
  ListRow,
  ListRowTitle,
  TextInput,
} from "@/design-system";
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
          className="min-w-0 flex-1 rounded border border-control-border bg-white px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
          placeholder="Nowa kategoria"
          aria-label="Nowa kategoria"
          maxLength={100}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={isCreating || !newName.trim()}
        >
          {isCreating ? "Dodawanie…" : "Dodaj"}
        </Button>
      </form>
      {createError && (
        <ErrorAlert>{createError}</ErrorAlert>
      )}

      {isLoading ? (
        <p className="pt-10 text-muted" role="status">
          Wczytywanie kategorii…
        </p>
      ) : pageError ? (
        <p
          className="m-0 px-2 py-6 text-[13px] text-danger-ink"
          role="alert"
        >
          {pageError}
        </p>
      ) : visibleCategories.length === 0 ? (
        <p className="m-0 border-b border-dashed border-[#ccd8d4] px-2 py-6 text-[13px] text-hint">
          Brak kategorii.
        </p>
      ) : (
        <ul className="m-0 list-none p-0" aria-label="Lista kategorii">
          {visibleCategories.map((category) => (
            <ListRow key={category.id}>
              {editingId === category.id ? (
                <form
                  id={`rename-category-${category.id}`}
                  className="min-w-0 flex-1"
                  onSubmit={(event) => void handleRename(category, event)}
                >
                  <TextInput
                    autoFocus
                    aria-label="Nazwa kategorii"
                    maxLength={100}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelEditing();
                    }}
                  />
                  {renameError && <ErrorAlert>{renameError}</ErrorAlert>}
                </form>
              ) : (
                <ListRowTitle>{category.name}</ListRowTitle>
              )}
              {editingId === category.id ? (
                <div className="flex items-center gap-[13px]">
                  <Button
                    variant="primary"
                    type="submit"
                    form={`rename-category-${category.id}`}
                  >
                    Zapisz
                  </Button>
                  <Button variant="secondary" onClick={cancelEditing}>
                    Anuluj
                  </Button>
                </div>
              ) : (
                <>
                  <EditButton
                    aria-label={`Zmień nazwę kategorii: ${category.name}`}
                    title="Zmień nazwę"
                    onClick={() => startEditing(category)}
                  />
                  <DeleteButton
                    aria-label={`Usuń kategorię: ${category.name}`}
                    onClick={() => openDeleteDialog(category)}
                  />
                </>
              )}
            </ListRow>
          ))}
        </ul>
      )}
    </section>
  );
}
