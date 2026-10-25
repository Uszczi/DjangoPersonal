import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";

import { NotatnikSidebar } from "@/components/NotatnikSidebar";

export const Route = createFileRoute("/whiteboard")({
  component: WhiteboardLayout,
});

/** One Notatnik screen: the file tree on the left, the open item (or a hint) on the right. */
function WhiteboardLayout() {
  const { boardId } = useParams({ strict: false });
  const activeId = boardId != null ? Number(boardId) : null;
  return (
    <div className="flex gap-6">
      <NotatnikSidebar activeId={activeId} />
      <div className={`min-w-0 flex-1 ${activeId == null ? "max-md:hidden" : ""}`}>
        <Outlet />
      </div>
    </div>
  );
}
