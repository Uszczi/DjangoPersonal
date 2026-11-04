import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderInput,
  FolderPlus,
  Palette,
  Pencil,
} from "lucide-react";

import { DeleteButton, IconButton } from "@/design-system";
import type {
  FolderResponse,
  WhiteboardResponse,
} from "@personal/shared/generated/api";
import { DeleteFolderModal } from "@/components/modals/DeleteFolderModal";
import { FolderEditorModal } from "@/components/modals/FolderEditorModal";
import {
  MoveFolderModal,
} from "@/components/modals/MoveToFolderModal";
import { childFolders, subtreeIds } from "@personal/shared/folderTree";
import { ShowModal } from "@/stores/modal";
import type { ItemKind } from "@personal/shared/queries/whiteboards";

import { WhiteboardRow } from "./WhiteboardRow";
import { iconClasses, rowActionsClasses, rowButtonClasses, smallIconButton } from "./classes";

type FolderSectionProps = {
  folder: FolderResponse;
  /** Every Folder and item of the Notatnik; the section picks its own children. */
  folders: FolderResponse[];
  whiteboards: WhiteboardResponse[];
  activeId: string | null;
  isExpanded: (folderId: string) => boolean;
  onToggle: (folderId: string) => void;
  onCreate: (kind: ItemKind, folderId: string) => void;
};

/** A collapsible Folder: its subfolders first, alphabetically, then its items, newest first. */
export function FolderSection({
  folder,
  folders,
  whiteboards,
  activeId,
  isExpanded,
  onToggle,
  onCreate,
}: FolderSectionProps) {
  const expanded = isExpanded(folder.id);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const subfolders = childFolders(folders, folder.id);
  const items = whiteboards.filter((wb) => wb.folderId === folder.id);
  const subtree = subtreeIds(folders, folder.id);
  const totalItems = whiteboards.filter(
    (wb) => wb.folderId != null && subtree.has(wb.folderId),
  ).length;

  return (
    <section aria-label={`Folder: ${folder.name}`}>
      <div className="group relative flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={folder.name}
          onClick={() => onToggle(folder.id)}
          className={rowButtonClasses}
        >
          <Chevron
            aria-hidden="true"
            className="size-[14px] shrink-0 text-muted"
          />
          <span aria-hidden="true">📁</span>
          <span className="min-w-0 truncate font-semibold text-ink">
            {folder.name}
          </span>
          <span className="text-[11px] text-muted">{totalItems}</span>
        </button>
        <div className={rowActionsClasses}>
          <IconButton
            className={smallIconButton}
            title="Nowa notatka"
            aria-label={`Nowa notatka w folderze: ${folder.name}`}
            onClick={() => onCreate("markdown", folder.id)}
          >
            <FilePlus aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Nowa tablica"
            aria-label={`Nowa tablica w folderze: ${folder.name}`}
            onClick={() => onCreate("whiteboard", folder.id)}
          >
            <Palette aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Nowy podfolder"
            aria-label={`Nowy folder w folderze: ${folder.name}`}
            onClick={() => ShowModal(FolderEditorModal, { parent: folder })}
          >
            <FolderPlus aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Przenieś do…"
            aria-label={`Przenieś folder do…: ${folder.name}`}
            onClick={() => ShowModal(MoveFolderModal, { folder })}
          >
            <FolderInput aria-hidden="true" className={iconClasses} />
          </IconButton>
          <IconButton
            className={smallIconButton}
            title="Zmień nazwę"
            aria-label={`Zmień nazwę folderu: ${folder.name}`}
            onClick={() => ShowModal(FolderEditorModal, { folder })}
          >
            <Pencil aria-hidden="true" className={iconClasses} />
          </IconButton>
          <DeleteButton
            className={smallIconButton}
            aria-label={`Usuń folder: ${folder.name}`}
            onClick={() =>
              ShowModal(DeleteFolderModal, {
                folder,
                itemCount: totalItems,
                subfolderCount: subtree.size - 1,
              })
            }
          />
        </div>
      </div>
      {expanded && (
        <div className="pl-4">
          {subfolders.map((child) => (
            <FolderSection
              key={child.id}
              folder={child}
              folders={folders}
              whiteboards={whiteboards}
              activeId={activeId}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onCreate={onCreate}
            />
          ))}
          <ul
            className="flex flex-col"
            aria-label={`Zawartość folderu: ${folder.name}`}
          >
            {items.length === 0 && subfolders.length === 0 ? (
              <li className="px-[6px] py-1 text-[12px] text-muted">
                Folder jest pusty.
              </li>
            ) : (
              items.map((wb) => (
                <WhiteboardRow
                  key={wb.id}
                  whiteboard={wb}
                  active={wb.id === activeId}
                />
              ))
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
