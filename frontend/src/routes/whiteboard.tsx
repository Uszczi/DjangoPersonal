import { createFileRoute, Outlet, useLocation, useParams } from "@tanstack/react-router";

import { NotatnikSidebar } from "@/components/NotatnikSidebar";

export const Route = createFileRoute("/whiteboard")({
  component: WhiteboardLayout,
});

/** One Notatnik screen: the file tree on the left, the open item (or a hint) on the right. */
function WhiteboardLayout() {
  const { boardId } = useParams({ strict: false });
  const activeId = boardId != null ? Number(boardId) : null;
  const asking = useLocation({ select: (location) => location.pathname.startsWith("/whiteboard/ask") });
  // On small screens the tree and the right side take turns: the tree until something is open.
  const detailOpen = activeId != null || asking;
  return (
    <div className="flex gap-6">
      <NotatnikSidebar activeId={activeId} detailOpen={detailOpen} />
      <div className={`min-w-0 flex-1 ${detailOpen ? "" : "max-md:hidden"}`}>
        <Outlet />
      </div>
    </div>
  );
}
