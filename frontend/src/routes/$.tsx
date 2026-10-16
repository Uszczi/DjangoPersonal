import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <>
      <div className="empty-state">
        <h1>Tej strony nie ma</h1>
        <p className="project-description">
          Adres jest nieznany albo projekt, do którego prowadził, został
          usunięty.
        </p>
      </div>
    </>
  );
}
