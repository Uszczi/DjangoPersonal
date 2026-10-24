import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { api } from "@/api";
import {
  Button,
  DeleteButton,
  ErrorMessage,
  ListRow,
  ListRowButton,
  ListRowTitle,
  LoadingStatus,
} from "@/design-system";
import { useWhiteboardsStore } from "@/stores/whiteboards";

export const Route = createFileRoute("/whiteboard/")({
  component: WhiteboardsPage,
});

function WhiteboardsPage() {
  const whiteboards = useWhiteboardsStore((s) => s.whiteboards);
  const isLoading = useWhiteboardsStore((s) => s.isLoading);
  const pageError = useWhiteboardsStore((s) => s.pageError);
  const load = useWhiteboardsStore((s) => s.loadWhiteboards);
  const remove = useWhiteboardsStore((s) => s.deleteWhiteboard);

  const navigate = useNavigate();

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

  async function handleDelete(id: number) {
    if (!window.confirm("Usunąć tablicę?")) return;
    await remove(id);
  }

  if (isLoading) {
    return (
      <LoadingStatus>
        Wczytywanie tablic…
      </LoadingStatus>
    );
  }

  if (pageError) {
    return <ErrorMessage>{pageError}</ErrorMessage>;
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
              <ListRow key={wb.id}>
                <ListRowButton
                  aria-label={`Otwórz ${wb.kind === "markdown" ? "notatkę" : "tablicę"}: ${wb.name}`}
                  onClick={() =>
                    navigate({ to: "/whiteboard/$boardId", params: { boardId: String(wb.id) } })
                  }
                >
                  <span className="text-[16px]" aria-hidden="true">
                    {wb.kind === "markdown" ? "📝" : "🎨"}
                  </span>
                  <ListRowTitle>{wb.name}</ListRowTitle>
                </ListRowButton>
                <>
                  <span className="mr-2 text-[12px] text-muted">
                    {new Date(wb.updatedAt).toLocaleDateString("pl-PL")}
                  </span>
                  <DeleteButton
                    aria-label={`Usuń tablicę: ${wb.name}`}
                    onClick={() => void handleDelete(wb.id)}
                  />
                </>
              </ListRow>
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