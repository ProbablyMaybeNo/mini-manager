"use client";

import { useRouter } from "next/navigation";
import { ProjectWorkspaceBody } from "@/components/dashboard/ProjectWorkspaceBody";
import type { Project } from "@/lib/types";

/** Full-page project workspace — same body as the dashboard slide-out. */
export function ProjectPageClient({
  project,
  loggedMinutes,
}: {
  project: Project;
  loggedMinutes?: number;
}) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        className="mb-4 self-start label-osd text-fg hover:text-cyan"
      >
        ‹ Dashboard
      </button>
      <div className="mx-auto w-full max-w-3xl">
        <ProjectWorkspaceBody
          project={project}
          loggedMinutes={loggedMinutes}
          variant="page"
          onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
          onAttachRecipe={() => router.push("/recipes")}
          onOpenSubProject={(id) => router.push(`/projects/${id}`)}
          onClose={() => router.push("/dashboard")}
        />
      </div>
    </div>
  );
}
