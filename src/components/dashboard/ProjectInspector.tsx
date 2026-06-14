import {
  Button,
  PriorityTag,
  ProgressBar,
  SlideOutPanel,
  StatusText,
  Swatch,
  TypeChip,
} from "@/components/kit";
import type { Project } from "@/lib/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-osd text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

/** Project detail inspector — opens from a PROJECTS row. Uses the shared slide-out. */
export function ProjectInspector({
  project,
  open,
  onClose,
  onStartSession,
  onAttachRecipe,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onStartSession: (project: Project) => void;
  onAttachRecipe: (project: Project) => void;
}) {
  return (
    <SlideOutPanel
      open={open && project != null}
      onClose={onClose}
      breadcrumb="DASHBOARD ▸ PROJECT"
      title={project?.title ?? ""}
      footer={
        project && (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onStartSession(project)}>
              ▸ Focus
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {project && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <TypeChip type={project.type} />
            <StatusText status={project.status} />
          </div>

          <Field label="Completion">
            <ProgressBar percent={project.completionPercent} />
          </Field>

          <Field label="Priority">
            <PriorityTag priority={project.priority} />
          </Field>

          <Field label="Recipe">
            {project.recipeSwatches.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {project.recipeSwatches.map((hex, i) => (
                  <Swatch key={`${hex}-${i}`} hex={hex} />
                ))}
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => onAttachRecipe(project)}>
                + Attach recipe
              </Button>
            )}
          </Field>

          {project.children && project.children.length > 0 && (
            <Field label="Units">
              <ul className="flex flex-col gap-1">
                {project.children.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between font-mono text-xs text-fg-dim"
                  >
                    <span>{c.title}</span>
                    <StatusText status={c.status} />
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </div>
      )}
    </SlideOutPanel>
  );
}
