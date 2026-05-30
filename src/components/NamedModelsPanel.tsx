import type { NamedModel } from "@/db/schema";
import { AddNamedModelForm } from "@/components/AddNamedModelForm";
import { NamedModelRow } from "@/components/NamedModelRow";
import { AttachedRecipeForNamedModel } from "@/components/recipes/AttachedRecipeForNamedModel";
import { Card } from "@/components/ui/Card";

/**
 * Server component. Renders the named models section of a project
 * workspace. Hidden when the project has none — only the compact
 * `[ + Add named model ]` button materialises. As soon as the
 * first model is added the full panel (header, rows, inline add)
 * replaces the bare button.
 *
 * The page fetches and passes the rows; this component owns the
 * empty-state branch and the slim snapshot projection so the
 * client rows stay portable.
 */
export function NamedModelsPanel({
  projectId,
  namedModels,
}: {
  projectId: string;
  namedModels: ReadonlyArray<NamedModel>;
}) {
  if (namedModels.length === 0) {
    return <AddNamedModelForm projectId={projectId} mode="compact" />;
  }

  return (
    <Card title={`Named Models · ${namedModels.length}`}>
      <ul className="space-y-2" role="list">
        {namedModels.map((m) => (
          <NamedModelRow
            key={m.id}
            snapshot={{
              id: m.id,
              name: m.name,
              isBuilt: m.isBuilt,
              isPrimed: m.isPrimed,
              isPainted: m.isPainted,
              isBased: m.isBased,
              isComplete: m.isComplete,
            }}
            recipeSlot={<AttachedRecipeForNamedModel namedModelId={m.id} />}
          />
        ))}
      </ul>

      <div className="mt-3">
        <AddNamedModelForm projectId={projectId} mode="inline" />
      </div>
    </Card>
  );
}
