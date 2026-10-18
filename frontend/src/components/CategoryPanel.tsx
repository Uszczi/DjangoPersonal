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
    <section className="category-panel" aria-label="Kategorie">
      <div className="project-heading">
        <div>
          <h2>Kategorie</h2>
        </div>
      </div>

      <form className="category-create" onSubmit={handleCreate}>
        <input
          placeholder="Nowa kategoria"
          aria-label="Nowa kategoria"
          maxLength={100}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button
          className="primary-button"
          type="submit"
          disabled={isCreating || !newName.trim()}
        >
          {isCreating ? "Dodawanie…" : "Dodaj"}
        </button>
      </form>
      {createError && (
        <p className="form-error" role="alert">
          {createError}
        </p>
      )}

      {isLoading ? (
        <p className="loading-state" role="status">
          Wczytywanie kategorii…
        </p>
      ) : pageError ? (
        <p className="task-error" role="alert">
          {pageError}
        </p>
      ) : categories.length === 0 ? (
        <p className="task-empty-state">Brak kategorii.</p>
      ) : (
        <ul className="project-list" aria-label="Lista kategorii">
          {categories.map((category) => (
            <li className="project-row" key={category.id}>
              {editingId === category.id ? (
                <form
                  className="project-row-copy"
                  onSubmit={(event) => void handleRename(category, event)}
                >
                  <input
                    autoFocus
                    aria-label="Nazwa kategorii"
                    maxLength={100}
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelEditing();
                    }}
                  />
                  <div className="project-row-actions">
                    <button className="primary-button" type="submit">
                      Zapisz
                    </button>
                    <button
                      className="quiet-button"
                      type="button"
                      onClick={cancelEditing}
                    >
                      Anuluj
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="project-row-copy">
                    <p>{category.name}</p>
                  </div>
                  <div className="project-row-actions">
                    <button
                      className="task-edit-button"
                      type="button"
                      aria-label={`Zmień nazwę kategorii: ${category.name}`}
                      onClick={() => startEditing(category)}
                    >
                      Zmień
                    </button>
                    <button
                      className="task-delete-button"
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
                <p className="form-error" role="alert">
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
