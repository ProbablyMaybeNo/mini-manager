import { redirect } from "next/navigation";

/**
 * FIGMA-REBUILD (REBUILD_SPEC §0.2 / §9) — the project-detail PAGE goes
 * away. Project detail becomes a SLIDE-OUT INSPECTOR on the dashboard
 * (same panel language as the library PAINT INFO panel), so this route
 * permanently redirects to /projects with the inspector deep-link param.
 *
 * TODO(inspector agent, task #10): the dashboard must open the project
 * inspector slide-out when `?project=<id>` is present (SlideOutPanel,
 * breadcrumb `SYS > PROJECT`). The full pre-rebuild detail page lives in
 * git history at src/app/projects/[id]/page.tsx (commit 5bb4c0d and
 * earlier) — mine it for the data queries (getProjectById,
 * listChildProjects, recipe/palette maps) and the counter wiring.
 */
export default async function ProjectDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects?project=${encodeURIComponent(id)}`);
}
