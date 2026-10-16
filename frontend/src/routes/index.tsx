import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: MainPage,
});

function MainPage() {
  return (
    <>
      <div className="project-heading">
        <div>
          <h1>Start</h1>
        </div>
      </div>
    </>
  );
}
