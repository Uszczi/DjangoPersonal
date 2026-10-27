import { Button, Drawer } from "@/design-system";
import { ProjectEditorModal } from "@/components/modals/ProjectEditorModal";
import { ProjectNavList } from "@/components/ProjectsSidebar";
import { ShowModal } from "@/stores/modal";

const DRAWER_ID = "projects-drawer";

/** The Project list for small screens, which have no sidebar. */
export function ProjectsDrawer({
  selectedProjectId,
  onClose,
}: {
  selectedProjectId: number | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      id={DRAWER_ID}
      side="left"
      label="Projekty"
      title={
        <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
          Projekty
        </h2>
      }
      onClose={onClose}
    >
      <ProjectNavList
        selectedProjectId={selectedProjectId}
        tone="light"
        onNavigate={onClose}
      />
      <Button
        variant="secondary"
        onClick={() => {
          onClose();
          ShowModal(ProjectEditorModal);
        }}
      >
        <span aria-hidden="true">+</span>
        Nowy projekt
      </Button>
    </Drawer>
  );
}

/** The button that opens `ProjectsDrawer`; shown only on small screens. */
export function ProjectsDrawerToggle({
  isOpen,
  onOpen,
}: {
  isOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      className="inline-flex cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[18px] text-muted transition-all hover:-translate-y-px hover:text-ink md:hidden"
      aria-label="Pokaż projekty"
      title="Pokaż projekty"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={DRAWER_ID}
      onClick={onOpen}
    >
      <span aria-hidden="true">»</span>
    </button>
  );
}
