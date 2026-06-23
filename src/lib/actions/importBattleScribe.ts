"use server";

import { z } from "zod";
import { currentUserId } from "@/lib/auth-stub";
import { isProUser } from "@/lib/billing/enforce";
import { createProject } from "@/lib/actions/projects";
import type { ActionResult } from "@/lib/actions/projects";
import { parseBattleScribeRoster } from "@/lib/import/battlescribe";

const MAX_XML_CHARS = 2_000_000; // ~2MB of XML — a generous roster ceiling.

const schema = z.object({
  xml: z
    .string()
    .trim()
    .min(1, "Paste a BattleScribe roster first")
    .max(MAX_XML_CHARS, "That roster file is too large to import."),
});

export type ImportBattleScribeInput = z.infer<typeof schema>;

/**
 * Import a BattleScribe `.ros` roster (XML string) as a project hierarchy:
 * one Army container → a Unit per roster selection → a Model per model line.
 *
 * Army-list import is a Pro feature. The gate is inert while
 * `BILLING_ENFORCED` is false (every user reads as Pro), so this stays open
 * for testing until Stripe goes live, then closes automatically.
 *
 * Builds the tree through the existing `createProject` path so the same
 * validation, nesting rules, free-tier caps, and activity logging apply.
 * Best-effort on partial failure: if a child insert fails the Army + whatever
 * landed so far is left in place and the error is surfaced — the painter can
 * clean up or retry from a real, inspectable project.
 *
 * @returns the created root Army project id on success.
 */
export async function importBattleScribeRoster(
  raw: ImportBattleScribeInput,
): Promise<ActionResult<{ armyProjectId: string }>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const userId = await currentUserId();
  if (!(await isProUser(userId))) {
    return {
      ok: false,
      error: "Army-list import is a Pro feature.",
      upgradeUrl: "/pricing",
    };
  }

  const army = parseBattleScribeRoster(parsed.data.xml);
  if (army.units.length === 0) {
    return {
      ok: false,
      error:
        "No units found in that roster. Make sure it's a BattleScribe .ros export.",
    };
  }

  // 1) Army container.
  const unitTotal = army.units.reduce(
    (sum, u) => sum + u.models.reduce((s, m) => s + m.count, 0),
    0,
  );
  const armyResult = await createProject({
    name: army.armyName,
    type: "Army",
    count: clampCount(unitTotal),
  });
  if (!armyResult.ok) return armyResult;
  const armyProjectId = armyResult.data.id;

  // 2) A Unit per selection, then 3) a Model per model line under it.
  for (const unit of army.units) {
    const unitModelTotal = unit.models.reduce((s, m) => s + m.count, 0);
    const unitResult = await createProject({
      name: unit.name,
      type: "Unit",
      count: clampCount(unitModelTotal),
      parentId: armyProjectId,
    });
    if (!unitResult.ok) {
      return {
        ok: false,
        error: `Imported the army, but failed on unit "${unit.name}": ${unitResult.error}`,
      };
    }

    // Only break a unit out into individual Model children when there's real
    // detail to keep (more than one distinct model line). A single
    // homogeneous squad (e.g. "10x Intercessor") stays as one Unit row with
    // its count — nesting ten identical Model rows under it adds noise, not
    // signal.
    if (unit.models.length > 1) {
      for (const model of unit.models) {
        const modelResult = await createProject({
          name: model.name,
          type: "Model",
          count: clampCount(model.count),
          parentId: unitResult.data.id,
        });
        if (!modelResult.ok) {
          return {
            ok: false,
            error: `Imported up to model "${model.name}": ${modelResult.error}`,
          };
        }
      }
    }
  }

  return { ok: true, data: { armyProjectId } };
}

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), 9999);
}
