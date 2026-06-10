import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import { listParentCandidates } from "@/db/queries/projects";
import { NewProjectForm } from "@/components/NewProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { projectTypes, type ProjectType } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string; type?: string }>;
}) {
  const userId = await currentUserId();
  const parents = await listParentCandidates(userId);
  const { parent: initialParentId, type: typeParam } = await searchParams;

  // Only honour the query param if the project ID is one the user
  // actually owns + can parent. Silently drop otherwise (don't leak
  // existence of other users' IDs).
  const safeInitialParent = initialParentId && parents.some((p) => p.id === initialParentId)
    ? initialParentId
    : undefined;

  // The unified "+ Add" menu deep-links here with `?type=` so a chosen
  // kind pre-selects the radio. Top-level: any selectable type. Nested
  // (parent present): only Unit or Model are legal children, so honour
  // the hint when it's one of those and otherwise let the form default.
  const isNestableChildType = typeParam === "Unit" || typeParam === "Model";
  const safeInitialType: ProjectType | undefined =
    typeParam !== undefined &&
    (projectTypes as ReadonlyArray<string>).includes(typeParam) &&
    (safeInitialParent ? isNestableChildType : true)
      ? (typeParam as ProjectType)
      : undefined;

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <nav
        className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]"
        aria-label="Breadcrumb"
      >
        <Link href="/projects" className="hover:underline">
          SYS ▸ PROJECTS
        </Link>
        <span className="text-[var(--color-fg-subtle)]"> / NEW</span>
      </nav>

      <PageHeader
        title="NEW PROJECT"
        accent="green"
        tagline="Pick the kind of thing you're tracking. Armies and warbands are containers; units and single models do the actual painting. Nest a unit inside an army to roll up its counters."
      />

      <NewProjectForm
        parents={parents}
        initialParentId={safeInitialParent}
        initialType={safeInitialType}
      />
    </div>
  );
}
