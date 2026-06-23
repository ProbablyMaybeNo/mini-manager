import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { insertFeedback } from "@/db/queries/feedback";
import { feedbackCategories } from "@/db/schema";

/**
 * POST /api/feedback
 *
 * In-app "Report an issue" sink for the tester feedback widget (app shell).
 * Auth via the NextAuth session — unauthenticated callers get 401 (the
 * widget only renders for signed-in users, but the route defends anyway).
 *
 * Body: { message: string, category?: "bug"|"idea"|"other", pageUrl?: string }
 * Stores one row in the `feedback` table and returns `{ ok: true, id }`.
 *
 * Notion: the repo has no NOTION_TOKEN / database id configured, so this
 * is DB-only by design — no best-effort Notion fan-out is wired (it would
 * need credentials we don't have, and the brief says not to block on it).
 */

const bodySchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(4000),
  category: z.enum(feedbackCategories).default("other"),
  // Captured client-side from the current path; keep it bounded.
  pageUrl: z.string().trim().max(2048).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { message, category, pageUrl } = parsed.data;
  const row = await insertFeedback({
    userId,
    message,
    category,
    pageUrl: pageUrl && pageUrl.length > 0 ? pageUrl : null,
  });

  return NextResponse.json({ ok: true, id: row.id });
}
