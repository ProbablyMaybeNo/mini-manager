import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import { listParentCandidates } from "@/db/queries/projects";
import { NewProjectForm } from "@/components/NewProjectForm";
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

  // Item 1 — the unified "+ Add" menu deep-links here with `?type=` so a
  // chosen kind (Unit / Terrain Piece) pre-selects the radio. A nested
  // child can only be a Unit (sub-project rule), so the type hint is
  // ignored when a parent is present; the form locks to Unit in that case.
  const safeInitialType: ProjectType | undefined =
    !safeInitialParent &&
    typeParam !== undefined &&
    (projectTypes as ReadonlyArray<string>).includes(typeParam)
      ? (typeParam as ProjectType)
      : undefined;

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-accent)]">
          ← Projects
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">New project</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl tracking-wide">NEW PROJECT</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-xl">
          Pick the kind of thing you&apos;re tracking. Armies and warbands are
          containers; units and single models do the actual painting. Nest a unit
          inside an army to roll up its counters.
        </p>
      </header>

      <NewProjectForm
        parents={parents}
        initialParentId={safeInitialParent}
        initialType={safeInitialType}
      />
    </div>
  );
}
