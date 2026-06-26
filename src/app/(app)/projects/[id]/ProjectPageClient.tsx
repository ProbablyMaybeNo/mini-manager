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
        {/* The big in-panel title was removed (RF-4); this page has no
            breadcrumb header, so it keeps a compact heading + name here so the
            document always has an h1 and the project is named at a glance. */}
        <div className="mb-4">
          <div className="label-osd tracking-[0.2em] text-fg">DASHBOARD ▸ PROJECT</div>
          <h1 className="label-osd-h2 text-cyan">{project.title}</h1>
        </div>
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
