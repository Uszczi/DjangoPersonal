import { useEffect, useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";
import {
  Button,
  ErrorAlert,
  IconPicker,
  ListRow,
  ListRowButton,
  ListRowTitle,
  LoadingStatus,
  TextInput,
} from "@/design-system";
import {
  CATEGORY_ICON_SUGGESTIONS,
  DEFAULT_CATEGORY_ICON,
} from "@personal/shared/categoryIcons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { DeleteCategoryModal } from "@/components/modals/DeleteCategoryModal";
import { ShowModal } from "@/stores/modal";
import {
  useCategoriesStore,
  type CategoryInput,
} from "@personal/shared/stores/categories";
import type { CategoryResponse } from "@personal/shared/generated/api";

/** Panel below the wallet: inline create, edit (name and icon), and delete. */
export function CategoryPanel() {
  const categories = useCategoriesStore((state) => state.categories);
  const isLoading = useCategoriesStore((state) => state.isLoading);
  const pageError = useCategoriesStore((state) => state.pageError);
  const loadCategories = useCategoriesStore((state) => state.loadCategories);
  const createCategory = useCategoriesStore((state) => state.createCategory);
  const updateCategory = useCategoriesStore((state) => state.updateCategory);

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState(DEFAULT_CATEGORY_ICON);
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
    const input: CategoryInput = { name: newName.trim(), icon: newIcon };
    if (!input.name) return;

    setIsCreating(true);
    setCreateError("");
    try {
      await createCategory(input);
      setNewName("");
      setNewIcon(DEFAULT_CATEGORY_ICON);
    } catch (error) {
      setCreateError(await apiErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }

  function startEditing(category: CategoryResponse) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
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
    const input: CategoryInput = { name: editName.trim(), icon: editIcon };
    if (!input.name) return;

    try {
      await updateCategory(category, input);
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

      <form className="mt-4 flex gap-[10px]" onSubmit={handleCreate}>
        <IconPicker
          label="Ikona kategorii"
          value={newIcon}
          onChange={setNewIcon}
          suggestions={CATEGORY_ICON_SUGGESTIONS}
        />
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
      {createError && <ErrorAlert>{createError}</ErrorAlert>}

      {isLoading ? (
        <LoadingStatus>Wczytywanie kategorii…</LoadingStatus>
      ) : pageError ? (
        <p className="m-0 px-2 py-6 text-[13px] text-danger-ink" role="alert">
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
                  <div className="flex gap-[10px]">
                    <IconPicker
                      label="Ikona kategorii"
                      value={editIcon}
                      onChange={setEditIcon}
                      suggestions={CATEGORY_ICON_SUGGESTIONS}
                    />
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
                  </div>
                  {renameError && <ErrorAlert>{renameError}</ErrorAlert>}
                </form>
              ) : (
                <ListRowButton
                  aria-label={`Zmień nazwę kategorii: ${category.name}`}
                  onClick={() => startEditing(category)}
                >
                  <CategoryIcon
                    icon={category.icon}
                    className="text-ink-soft"
                  />
                  <ListRowTitle>{category.name}</ListRowTitle>
                </ListRowButton>
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
                  <Button
                    variant="ghostDanger"
                    aria-label={`Usuń kategorię: ${category.name}`}
                    onClick={() => {
                      cancelEditing();
                      openDeleteDialog(category);
                    }}
                  >
                    Usuń
                  </Button>
                </div>
              ) : null}
            </ListRow>
          ))}
        </ul>
      )}
    </section>
  );
}
