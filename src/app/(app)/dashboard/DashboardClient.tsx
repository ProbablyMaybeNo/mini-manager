"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { RecipePickerDialog } from "@/components/recipe/RecipePickerDialog";
import { ArmyImportPanel } from "./ArmyImportPanel";
import { useToast } from "@/components/kit";
import { createProject } from "@/lib/actions/projects";
import { createSingleFlightGuard } from "@/lib/guards/singleFlight";
import { attachRecipeToProject, createRecipe } from "@/lib/actions/recipes";
import { deriveDashboardSummary } from "@/mock/derive";
import type {
  ActivityEntry,
  CalendarEvent,
  Project,
  Recipe,
  SessionStats,
} from "@/lib/types";

/**
 * Dashboard client shell. Receives the signed-in user's REAL data (loaded
 * server-side via loadAppData) and wires the interactive bits: the create flow
 * and navigation callbacks. Creating a project or event calls a server action
 * that revalidates `/dashboard`, so the server component re-runs and this
 * re-renders with fresh data.
 *
 * The recipe-attach flow (V2 HEX.CODE): every `onAttachRecipe(project)` from the
 * roster / flow panels opens the {@link RecipePickerDialog} of the user's
 * recipes (recently-used first). Picking one calls `attachRecipeToProject` and
 * refreshes in place — no navigation. "+ New" pre-creates a recipe already
 * attached to that project and opens it in the editor.
 */
export function DashboardClient({
  projects,
  events,
  activity,
  recipes,
  sessionStats,
  projectMinutes,
}: {
  projects: Project[];
  events: CalendarEvent[];
  activity: ActivityEntry[];
  recipes: Recipe[];
  sessionStats: SessionStats;
  projectMinutes: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A freshly created project to auto-open in the detail panel.
  const [openId, setOpenId] = useState<string | null>(null);
  // RF-8: the tour deep-link opens CREATE mode (the project page, blank). A
  // one-shot signal that DashboardView consumes once on mount.
  const [autoCreate, setAutoCreate] = useState(false);
  // Army-list import panel (re-homed to the dashboard "⬆ Upload Army" button).
  const [importOpen, setImportOpen] = useState(false);
  // The project whose recipe-attach picker is open — null when closed.
  const [attaching, setAttaching] = useState<Project | null>(null);
  const [creating, creatingProject] = useTransition();
  const [attachPending, startAttach] = useTransition();
  // Synchronous single-flight guard — a native double-click on "+ New Project"
  // fires faster than the disabled-prop re-render, so the disabled flag alone
  // let a double-click create two projects (E2). The ref-held guard rejects the
  // second call before it can start a second createProject.
  const createGuard = useRef(createSingleFlightGuard());
  const { toast, node: toastNode } = useToast();

  // Recipe picker options, recently-used first. `recipes` arrives already
  // ordered by updatedAt desc (listRecipesForTable), so mapping preserves it.
  const recipeOptions = useMemo(
    () =>
      recipes.map((r) => ({
        id: r.id,
        name: r.name,
        swatches: r.slots.map((s) => s.swatch),
      })),
    [recipes],
  );

  // "+ New Project" now creates a draft immediately and opens its editable
  // panel (the open-on-create effect picks up the new id). No separate
  // create form — the panel itself is where name/type/units are set (Ross).
  function handleAddProject() {
    creatingProject(async () => {
      await createGuard.current(async () => {
        const res = await createProject({ name: "New Project", type: "Army", count: 0 });
        if (res.ok && res.data?.id) {
          setOpenId(res.data.id);
          router.refresh();
        } else if (!res.ok) {
          toast(res.error ?? "Couldn’t create the project.", "red");
        }
      });
    });
  }

  // Attach an existing recipe to the picker's target project. Persists via the
  // real action, closes the picker, and refreshes so the project's swatches
  // update in place across the roster + panels (no navigation).
  function attach(recipeId: string) {
    const target = attaching;
    if (!target) return;
    setAttaching(null);
    const name = recipes.find((r) => r.id === recipeId)?.name ?? "recipe";
    startAttach(async () => {
      const res = await attachRecipeToProject({ recipeId, projectId: target.id });
      if (res.ok) {
        toast(`Attached ${name} to ${target.title}`, "green");
        router.refresh();
      } else {
        toast(res.error, "red");
      }
    });
  }

  // "+ Create" — a brand-new recipe already attached to the picker's target
  // project, then open it in the editor. Because it is pre-attached, saving
  // needs no extra step; returning to the dashboard shows its swatches.
  function createForProject() {
    const target = attaching;
    if (!target) return;
    setAttaching(null);
    startAttach(async () => {
      const res = await createRecipe({
        name: `${target.title} recipe`,
        attachedProjectId: target.id,
      });
      if (res.ok && res.data?.id) {
        router.push(`/recipes/${res.data.id}?from=${target.id}`);
      } else if (!res.ok) {
        toast(res.error, "red");
      }
    });
  }

  // Final tutorial step lands here as `/dashboard?tour=create` to open the
  // create-project flow. Trigger create mode once, then strip the param so a
  // refresh / back doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get("tour") === "create") {
      setAutoCreate(true);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  // The project PAGE's "+ ADD UNIT" / "+ Add Sub-Project" affordances hand off
  // here as `/dashboard?open=<id>` (no sub-project type picker on the page
  // itself — that lives in the dashboard's editable panel). Reopen that
  // project's panel the same way a fresh create does, then strip the param.
  useEffect(() => {
    const openParam = searchParams.get("open");
    if (openParam) {
      setOpenId(openParam);
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  const summary = deriveDashboardSummary(projects, sessionStats);

  return (
    <>
      <DashboardView
        summary={summary}
        projects={projects}
        events={events}
        activity={activity}
        projectMinutes={projectMinutes}
        openProjectId={openId}
        onOpenConsumed={() => setOpenId(null)}
        onAddProject={handleAddProject}
        creatingProject={creating}
        autoCreate={autoCreate}
        onAutoCreateConsumed={() => setAutoCreate(false)}
        onStartSession={(p) => router.push(`/focus?project=${p.id}`)}
        onAttachRecipe={(p) => setAttaching(p)}
        onUploadArmyList={() => setImportOpen(true)}
        onRetry={() => router.refresh()}
      />
      <ArmyImportPanel open={importOpen} onClose={() => setImportOpen(false)} />
      <RecipePickerDialog
        open={attaching !== null}
        recipes={recipeOptions}
        busy={attachPending}
        title={attaching ? `Attach a recipe to ${attaching.title}` : "Attach a recipe"}
        breadcrumb="PROJECT"
        createLabel="+ Create new"
        onPick={attach}
        onCreateNew={createForProject}
        onClose={() => setAttaching(null)}
      />
      {toastNode}
    </>
  );
}
