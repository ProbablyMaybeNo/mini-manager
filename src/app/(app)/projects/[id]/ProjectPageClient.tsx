"use client";

import { useRouter } from "next/navigation";
import { ProjectWorkspaceBody } from "@/components/dashboard/ProjectWorkspaceBody";
import type { Project } from "@/lib/types";

/** Full-page project workspace — same body as the dashboard slide-out. */
export function ProjectPageClient({ project }: { project: Project }) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mb-4 self-start font-osd text-[11px] uppercase tracking-[0.2em] text-fg-faint hover:text-cyan"
      >
        ‹ Dashboard
      </button>
      <div className="mx-auto w-full max-w-3xl">
        <ProjectWorkspaceBody
          project={project}
          variant="page"
          onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
          onAttachRecipe={() => router.push("/recipes")}
          onClose={() => router.push("/dashboard")}
        />
      </div>
    </div>
  );
}
