import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { api } from "@/api";
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
      <div className="loading-state" role="status">
        Wczytywanie tablic…
      </div>
    );
  }

  if (pageError) {
    return <p className="task-error" role="alert">{pageError}</p>;
  }

  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Notatki</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="primary-button" onClick={() => void handleCreate("whiteboard")}>
            <span aria-hidden="true">+</span>
            Nowa tablica
          </button>
          <button className="quiet-button" onClick={() => void handleCreate("markdown")}>
            <span aria-hidden="true">+</span>
            Nowa notatka
          </button>
        </div>
      </div>

      {whiteboards.length === 0 ? (
        <div className="empty-state">
          <p className="eyebrow">BRAK NOTATEK</p>
          <h2>Utwórz pierwszą notatkę</h2>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="primary-button" onClick={() => void handleCreate("whiteboard")}>
              Nowa tablica
            </button>
            <button className="quiet-button" onClick={() => void handleCreate("markdown")}>
              Nowa notatka
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="whiteboard-list" aria-label="Tablice">
            {whiteboards.map((wb) => (
              <li className="whiteboard-row" key={wb.id}>
                {editingId === wb.id ? (
                  <input
                    className="whiteboard-name-input"
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
                    className="whiteboard-name"
                    onClick={() =>
                      navigate({ to: "/whiteboard/$boardId", params: { boardId: String(wb.id) } })
                    }
                  >
                    <span className="whiteboard-kind">
                      {wb.kind === "markdown" ? "📝" : "🎨"}
                    </span>
                    {wb.name}
                  </button>
                )}
                <span className="whiteboard-date">
                  {new Date(wb.updatedAt).toLocaleDateString("pl-PL")}
                </span>
                <div className="whiteboard-row-actions">
                  <button
                    className="task-edit-button"
                    type="button"
                    onClick={() => {
                      setEditingId(wb.id);
                      setEditingName(wb.name);
                    }}
                  >
                    Zmień nazwę
                  </button>
                  <button
                    className="task-delete-button"
                    type="button"
                    onClick={() => void handleDelete(wb.id)}
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="list-add-row">
            <div style={{ display: "flex", gap: 8 }}>
              <button className="primary-button" onClick={() => void handleCreate("whiteboard")}>
                <span aria-hidden="true">+</span>
                Nowa tablica
              </button>
              <button className="quiet-button" onClick={() => void handleCreate("markdown")}>
                <span aria-hidden="true">+</span>
                Nowa notatka
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}