import Link from "next/link";
import { currentUserId } from "@/lib/auth-stub";
import { listParentCandidates } from "@/db/queries/projects";
import { NewProjectForm } from "@/components/NewProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const userId = await currentUserId();
  const parents = await listParentCandidates(userId);

  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-green)]">
          ← Projects
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">New project</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl">┌─ NEW PROJECT ─</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-xl">
          Pick the kind of thing you&apos;re tracking. Armies and warbands are
          containers; units and single models do the actual painting. Nest a unit
          inside an army to roll up its counters.
        </p>
      </header>

      <NewProjectForm parents={parents} />
    </div>
  );
}
