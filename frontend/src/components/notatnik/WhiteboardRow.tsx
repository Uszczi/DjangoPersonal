import { useNavigate } from "@tanstack/react-router";
import { FolderInput } from "lucide-react";

import { DeleteButton, IconButton } from "@/design-system";
import type {
  MatchingLine,
  WhiteboardResponse,
} from "@personal/shared/generated/api";
import { MoveWhiteboardModal } from "@/components/modals/MoveToFolderModal";
import { ShowModal } from "@/stores/modal";
import { useDeleteWhiteboard } from "@personal/shared/queries/whiteboards";

import {
  iconClasses,
  rowActionsClasses,
  rowButtonClasses,
  SHOWN_LINES,
  smallIconButton,
} from "./classes";

type WhiteboardRowProps = {
  whiteboard: WhiteboardResponse;
  /** The item open on the right. */
  active: boolean;
  /** The Folder path, shown under the name in search results. */
  location?: string;
  /** The lines of its text that matched a search. */
  lines?: MatchingLine[];
  /** The search its text matched; the Notatka opens searching for it. */
  searchQuery?: string;
};

/** A single Folder item (a Notatka or a Tablica) in the tree or search results. */
export function WhiteboardRow({
  whiteboard: wb,
  active,
  location,
  lines = [],
  searchQuery,
}: WhiteboardRowProps) {
  const remove = useDeleteWhiteboard();
  const navigate = useNavigate();

  async function handleDelete() {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove.mutateAsync(wb.id);
    if (active) navigate({ to: "/whiteboard" });
  }

  return (
    <li className="group relative">
      <button
        type="button"
        aria-label={`Otwórz ${wb.kind === "markdown" ? "notatkę" : "tablicę"}: ${wb.name}`}
        aria-current={active ? "page" : undefined}
        className={`${rowButtonClasses} aria-[current]:bg-wash aria-[current]:font-semibold aria-[current]:text-ink`}
        onClick={() =>
          navigate({
            to: "/whiteboard/$boardId",
            params: { boardId: String(wb.id) },
            search: searchQuery ? { q: searchQuery } : {},
          })
        }
      >
        <span className="w-[14px] shrink-0" aria-hidden="true" />
        <span aria-hidden="true">{wb.kind === "markdown" ? "📝" : "🎨"}</span>
        {location === undefined ? (
          <span className="min-w-0 truncate">{wb.name}</span>
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-ink">{wb.name}</span>
            <small className="block truncate text-[11px] text-muted">
              {location}
            </small>
            {lines.length > 0 && <MatchingLines lines={lines} />}
          </span>
        )}
      </button>
      <div
        className={`${rowActionsClasses} ${location !== undefined ? "top-[18px]" : ""}`}
      >
        <IconButton
          className={smallIconButton}
          title="Przenieś do…"
          aria-label={`Przenieś do…: ${wb.name}`}
          onClick={() => ShowModal(MoveWhiteboardModal, { whiteboard: wb })}
        >
          <FolderInput aria-hidden="true" className={iconClasses} />
        </IconButton>
        <DeleteButton
          className={smallIconButton}
          aria-label={`Usuń tablicę: ${wb.name}`}
          onClick={() => void handleDelete()}
        />
      </div>
    </li>
  );
}

/** Grep-style: each matching line with its number, the first few only. */
function MatchingLines({ lines }: { lines: MatchingLine[] }) {
  const hidden = lines.length - SHOWN_LINES;
  return (
    <span
      role="list"
      aria-label="Pasujące linie"
      className="mt-1 block font-mono text-[11px] leading-relaxed"
    >
      {lines.slice(0, SHOWN_LINES).map((line) => (
        <span role="listitem" key={line.number} className="flex min-w-0 gap-2">
          <span className="w-6 shrink-0 text-right text-muted tabular-nums">
            {line.number}
          </span>
          <span className="min-w-0 truncate text-ink">{line.text}</span>
        </span>
      ))}
      {hidden > 0 && (
        <span className="block pl-8 text-muted">i {hidden} więcej</span>
      )}
    </span>
  );
}
