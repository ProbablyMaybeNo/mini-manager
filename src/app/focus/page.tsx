import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FocusPageSection } from "@/components/focus/FocusPageSection";

export const metadata: Metadata = {
  title: "Focus · Mini Manager",
};

export const dynamic = "force-dynamic";

function str(raw: string | string[] | undefined): string | undefined {
  return typeof raw === "string" && raw.length ? raw : undefined;
}

/**
 * FOCUS (/focus) — full painting session page (REBUILD_SPEC §7).
 * Launch context: `/focus?project=<id>` or the user's last-pinned focus.
 */
export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const projectId = str(params.project);
  const focusRecipeId = str(params.focusRecipe);
  const focusSlotParam = str(params.focusSlot);

  return (
    <div className="px-4 py-6 md:px-8">
      <PageHeader
        title="FOCUS"
        accent="cyan"
        tagline="Painting session companion — timer, recipe steps, and inspiration in one place."
      />
      <FocusPageSection
        projectId={projectId}
        focusRecipeId={focusRecipeId}
        focusSlotParam={focusSlotParam}
      />
    </div>
  );
}
