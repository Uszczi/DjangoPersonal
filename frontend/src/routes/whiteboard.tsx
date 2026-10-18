import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/whiteboard")({
  component: WhiteboardLayout,
});

function WhiteboardLayout() {
  return <Outlet />;
}