import { Select } from "@/design-system";
import type { ProjectResponse } from "@personal/shared/generated/api";

export function ProjectSelect({ projects, value, onChange }: {
  projects: ProjectResponse[];
  value: string;
  onChange: (projectId: string) => void;
}) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="" disabled>
        Wybierz projekt
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  );
}
