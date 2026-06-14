"use client";

import { Button, SwatchStrip } from "@/components/kit";
import type { CollectionItem, CollectionKind, Project, ProjectStatus } from "@/lib/types";
import { StatusDropdown } from "./StatusDropdown";

const PAINT_COLS = ["Image", "Name", "Company", "Vendor", "Price", "Recipe", "Status", "Link"];
const MODEL_COLS = ["Image", "Name", "Qty", "Company", "Vendor", "Price", "Project", "Status", "Link"];

function Thumb({ src, alt }: { src: string; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-9 w-9 border border-cyan/30 object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center border border-cyan/30 bg-bg-raised/40 font-osd text-[10px] text-fg-faint">
      ▦
    </span>
  );
}

export function CollectionTable({
  kind,
  items,
  projects,
  onStatusChange,
  onAssignProject,
  onAttachRecipe,
  onRemove,
  onAdd,
}: {
  kind: CollectionKind;
  items: CollectionItem[];
  projects: Project[];
  onStatusChange: (item: CollectionItem, status: ProjectStatus) => void;
  onAssignProject: (item: CollectionItem, projectId: string) => void;
  onAttachRecipe: (item: CollectionItem) => void;
  onRemove: (item: CollectionItem) => void;
  onAdd: () => void;
}) {
  const cols = kind === "paint" ? PAINT_COLS : MODEL_COLS;
  const label = kind === "paint" ? "Paint" : "Model";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-cyan/30">
            {cols.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-3 py-2 text-left font-osd text-[10px] uppercase tracking-[0.18em] text-fg-faint"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-3 py-10 text-center">
                <p className="font-osd text-sm uppercase tracking-[0.18em] text-fg-dim">
                  No {label.toLowerCase()}s yet
                </p>
                <p className="mt-1 font-mono text-xs text-fg-faint">
                  Paste a store URL above to add your first {label.toLowerCase()}.
                </p>
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id} className="border-b border-fg/10 transition-colors hover:bg-cyan/5">
                <td className="px-3 py-2">
                  <Thumb src={item.thumbnail} alt={item.name} />
                </td>
                <td className="px-3 py-2">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-fg hover:text-cyan hover:underline"
                  >
                    {item.name}
                  </a>
                </td>
                {kind === "model" && (
                  <td className="px-3 py-2 font-mono text-xs tabular-nums text-fg-dim">
                    ×{item.quantity ?? 1}
                  </td>
                )}
                <td className="px-3 py-2 font-mono text-xs text-fg-dim">{item.company}</td>
                <td className="px-3 py-2 font-mono text-xs text-fg-dim">{item.vendor}</td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-fg">{item.price}</td>
                {kind === "paint" ? (
                  <td className="px-3 py-2">
                    <SwatchStrip swatches={[]} onAttach={() => onAttachRecipe(item)} />
                  </td>
                ) : (
                  <td className="px-3 py-2">
                    <select
                      value={item.projectId ?? ""}
                      aria-label={`Assign ${item.name} to a project`}
                      onChange={(e) => onAssignProject(item, e.target.value)}
                      className="border border-cyan/50 bg-bg px-2 py-1 font-mono text-xs text-fg transition-[border-color,box-shadow] duration-150 focus:border-cyan focus:shadow-[0_0_0_3px_rgba(0,210,255,0.12)] focus:outline-none"
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-3 py-2">
                  <StatusDropdown
                    value={item.status}
                    ariaLabel={`Status for ${item.name}`}
                    onChange={(s) => onStatusChange(item, s)}
                  />
                </td>
                <td className="px-3 py-2">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open source for ${item.name}`}
                    className="font-osd text-cyan hover:text-glow-cyan"
                  >
                    ↗
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-3 flex gap-2 border-t border-cyan/20 pt-3">
        <Button variant="secondary" size="sm" onClick={onAdd}>
          + {label}
        </Button>
        {items.length > 0 && (
          <Button variant="tertiary" size="sm" onClick={() => onRemove(items[items.length - 1])}>
            Remove {label}
          </Button>
        )}
      </div>
    </div>
  );
}
