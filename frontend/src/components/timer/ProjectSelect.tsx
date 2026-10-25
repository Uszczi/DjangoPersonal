import { Select } from "@/design-system";
import type { ProjectResponse } from "@personal/shared/generated/api";

/** The select value for "no project" when `allowNone` is set. */
export const NO_PROJECT = "none";

export function ProjectSelect({ projects, value, onChange, allowNone = false }: {
  projects: ProjectResponse[];
  value: string;
  onChange: (projectId: string) => void;
  /** Offer "Bez projektu" (`NO_PROJECT`) and stop requiring a choice. */
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} required={!allowNone}>
      <option value="" disabled>
        Wybierz projekt
      </option>
      {allowNone && <option value={NO_PROJECT}>Bez projektu</option>}
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  );
}
