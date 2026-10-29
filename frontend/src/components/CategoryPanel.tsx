import { useState, type FormEvent } from "react";

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
import type { CategoryResponse } from "@personal/shared/generated/api";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  type CategoryInput,
  type CategoryKind,
} from "@personal/shared/queries/categories";
import { CATEGORIES_LOAD_ERROR } from "@personal/shared/loadErrors";

/** The create form for one kind: the section it sits in decides the kind. */
function CreateCategoryForm({
  kind,
  createCategory,
}: {
  kind: CategoryKind;
  createCategory: ReturnType<typeof useCreateCategory>;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [error, setError] = useState("");

  // The expense section keeps the long-standing labels; the income section is
  // explicit so the two forms are told apart in the UI and in tests.
  const income = kind === "income";
  const nameLabel = income ? "Nowa kategoria przychodu" : "Nowa kategoria";
  const iconLabel = income ? "Ikona kategorii przychodu" : "Ikona kategorii";
  const submitLabel = income ? "Dodaj przychód" : "Dodaj";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: CategoryInput = { name: name.trim(), icon, kind };
    if (!input.name) return;

    setError("");
    try {
      await createCategory.mutateAsync(input);
      setName("");
      setIcon(DEFAULT_CATEGORY_ICON);
    } catch (err) {
      setError(await apiErrorMessage(err));
    }
  }

  return (
    <>
      <form
        className="mt-4 flex gap-[10px]"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <IconPicker
          label={iconLabel}
          value={icon}
          onChange={setIcon}
          suggestions={CATEGORY_ICON_SUGGESTIONS}
        />
        <input
          className="min-w-0 flex-1 rounded border border-control-border bg-input px-[11px] py-[10px] font-normal text-sm leading-relaxed text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15"
          placeholder={nameLabel}
          aria-label={nameLabel}
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          variant="primary"
          type="submit"
          disabled={createCategory.isPending || !name.trim()}
        >
          {createCategory.isPending ? "Dodawanie…" : submitLabel}
        </Button>
      </form>
      {error && <ErrorAlert>{error}</ErrorAlert>}
    </>
  );
}

const sectionTitle =
  "mt-6 mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink";

/** Panel below the wallet: two sections, Wydatki and Przychody, each with an
 * inline create, edit (name and icon), and delete. */
export function CategoryPanel() {
  const { data: categories = [], isPending, isError } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [renameError, setRenameError] = useState("");

  // The System category holds balance corrections; the user never manages it.
  const visibleCategories = categories.filter((category) => !category.isSystem);
  const expenseCategories = visibleCategories.filter(
    (category) => category.kind === "expense",
  );
  const incomeCategories = visibleCategories.filter(
    (category) => category.kind === "income",
  );

  function openDeleteDialog(category: CategoryResponse) {
    ShowModal(DeleteCategoryModal, { category });
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
      await updateCategory.mutateAsync({ category, input });
      setEditingId(null);
      setRenameError("");
    } catch (error) {
      setRenameError(await apiErrorMessage(error));
    }
  }

  function renderList(list: CategoryResponse[], kind: CategoryKind) {
    const label = kind === "income" ? "przychodów" : "wydatków";
    if (list.length === 0) {
      return (
        <p className="m-0 border-b border-dashed border-control-border px-2 py-6 text-[13px] text-hint">
          Brak kategorii.
        </p>
      );
    }
    return (
      <ul className="m-0 list-none p-0" aria-label={`Kategorie ${label}`}>
        {list.map((category) => (
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
    );
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

      {isPending ? (
        <LoadingStatus>Wczytywanie kategorii…</LoadingStatus>
      ) : isError ? (
        <p className="m-0 px-2 py-6 text-[13px] text-danger-ink" role="alert">
          {CATEGORIES_LOAD_ERROR}
        </p>
      ) : (
        <>
          <h3 className={sectionTitle}>Wydatki</h3>
          <CreateCategoryForm kind="expense" createCategory={createCategory} />
          {renderList(expenseCategories, "expense")}

          <h3 className={sectionTitle}>Przychody</h3>
          <CreateCategoryForm kind="income" createCategory={createCategory} />
          {renderList(incomeCategories, "income")}
        </>
      )}
    </section>
  );
}
