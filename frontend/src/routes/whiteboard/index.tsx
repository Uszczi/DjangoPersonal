import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { api } from "@/api";
import { Button, TextInput } from "@/design-system";
import { useWhiteboardsStore } from "@/stores/whiteboards";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

function WhiteboardsPage() {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const rename = useWhiteboardsStore((s) => s.renameWhiteboard);
  const remove = useWhiteboardsStore((s) => s.deleteWhiteboard);

  const navigate = useNavigate();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(kind: "whiteboard" | "markdown") {
    try {
      const created = await api.whiteboardsCreate({
        whiteboardRequest: { kind, name: "Bez tytułu" },
      });
      useWhiteboardsStore.setState((s) => ({ whiteboards: [created, ...s.whiteboards] }));
      navigate({ to: "/whiteboard/$boardId", params: { boardId: String(created.id) } });
    } catch {
      // ignore
    }
  }

  async function handleRename(id: number) {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    await rename(id, name);
    setEditingId(null);
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove(id);
  }

  if (isLoading) {
    return (
      <div className="pt-[40px] text-muted" role="status">
        Wczytywanie tablic…
      </div>
    );
  }

  if (pageError) {
    return <p className="py-4 text-[13px] text-danger" role="alert">{pageError}</p>;
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em] text-ink">Notatki</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
            <span aria-hidden="true">+</span>
            Nowa tablica
          </Button>
          <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
            <span aria-hidden="true">+</span>
            Nowa notatka
          </Button>
        </div>
      </div>

      {whiteboards.length === 0 ? (
        <div className="pt-[40px] text-muted">
          <p className="font-utility text-[11px] font-semibold tracking-[0.08em] text-muted">BRAK NOTATEK</p>
          <h2 className="mt-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Utwórz pierwszą notatkę</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }} className="mt-5">
            <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
              Nowa tablica
            </Button>
            <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
              Nowa notatka
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex flex-col" aria-label="Tablice">
            {whiteboards.map((wb) => (
              <li className="flex min-h-[62px] items-center gap-[13px] border-b border-[#dce5e1] px-[3px] py-[10px]" key={wb.id}>
                {editingId === wb.id ? (
                  <TextInput
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => void handleRename(wb.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename(wb.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded border border-transparent bg-transparent px-2 py-1 text-left transition-colors hover:bg-wash"
                    onClick={() =>
                      navigate({ to: "/whiteboard/$boardId", params: { boardId: String(wb.id) } })
                    }
                  >
                    <span className="text-[16px]" aria-hidden="true">
                      {wb.kind === "markdown" ? "📝" : "🎨"}
                    </span>
                    <span className="truncate text-[14px] font-medium text-ink">{wb.name}</span>
                  </button>
                )}
                <span className="shrink-0 text-[12px] text-muted">
                  {new Date(wb.updatedAt).toLocaleDateString("pl-PL")}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(wb.id);
                      setEditingName(wb.name);
                    }}
                  >
                    Zmień nazwę
                  </Button>
                  <Button
                    variant="ghostDanger"
                    onClick={() => void handleDelete(wb.id)}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" onClick={() => void handleCreate("whiteboard")}>
                <span aria-hidden="true">+</span>
                Nowa tablica
              </Button>
              <Button variant="secondary" onClick={() => void handleCreate("markdown")}>
                <span aria-hidden="true">+</span>
                Nowa notatka
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}