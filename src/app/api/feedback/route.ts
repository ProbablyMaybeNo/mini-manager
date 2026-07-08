import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { insertFeedback } from "@/db/queries/feedback";

/**
 * In-app "Report an Issue" / feedback sink.
 *
 * Primary store is the DB `feedback` table. A signed-in tester whose email is
 * verified earns the permanent free-forever entitlement (`freeForeverGrantedAt`)
 * on their feedback — the testing-period reward. If `NOTION_TOKEN` is set we
 * ALSO fan the report out to the Notion "Testing Task Tracker" (best-effort,
 * never blocks the response).
 */

const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";
/** Notion "Testing Task Tracker" database (dashed id). */
const DEFAULT_DB_ID = "370c5770-7771-802a-b9d4-cd6d2cc405dc";

const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
type Severity = (typeof SEVERITIES)[number];

/** Notion rich_text caps a single text node at 2000 chars. */
function clamp(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const body = (raw ?? {}) as Record<string, unknown>;

  const title = clamp(String(body.title ?? "").trim(), 200);
  const details = clamp(String(body.details ?? "").trim(), 5000);
  const steps = clamp(String(body.steps ?? "").trim(), 2000);
  const url = clamp(String(body.url ?? "").trim(), 500);
  const userAgent = clamp(String(body.userAgent ?? "").trim(), 300);
  const severity = SEVERITIES.includes(body.severity as Severity)
    ? (body.severity as Severity)
    : null;

  if (!title && !details) {
    return NextResponse.json(
      { ok: false, error: "Add a short description first." },
      { status: 400 },
    );
  }

  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  // Persist to the DB (the real record) and grant free-forever to a
  // verified-email tester on their feedback.
  let freeForever = false;
  if (userId) {
    try {
      const message = [title, details].filter(Boolean).join("\n\n") || title || details;
      await insertFeedback({
        userId,
        message: clamp(message, 9000),
        category: "bug",
        pageUrl: url || null,
      });
      const [u] = await db
        .select({
          emailVerified: users.emailVerified,
          granted: users.freeForeverGrantedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (u?.emailVerified && !u.granted) {
        await db
          .update(users)
          .set({ freeForeverGrantedAt: new Date() })
          .where(eq(users.id, userId));
        freeForever = true;
      }
    } catch (err) {
      console.error("[feedback] DB write failed", err);
      return NextResponse.json(
        { ok: false, error: "Couldn’t submit your report. Please try again." },
        { status: 500 },
      );
    }
  }

  // Best-effort fan-out to the Notion tracker (optional; never blocks).
  const token = process.env.NOTION_TOKEN;
  if (token) {
    try {
      const dbId = process.env.NOTION_FEEDBACK_DATABASE_ID ?? DEFAULT_DB_ID;
      const reporter = session?.user?.email ?? userId ?? "anonymous";
      const notes = clamp(
        [details, "", `URL: ${url}`, `Browser: ${userAgent}`, `Reporter: ${reporter}`]
          .filter(Boolean)
          .join("\n"),
        1900,
      );
      const properties: Record<string, unknown> = {
        Name: { title: [{ text: { content: title || clamp(details, 80) || "Issue report" } }] },
        Type: { select: { name: "Bug" } },
        App: { select: { name: "Mini-Manager" } },
        Source: { select: { name: "Manual" } },
        Status: { status: { name: "Not started" } },
        Notes: { rich_text: [{ text: { content: notes } }] },
      };
      if (severity) properties.Severity = { select: { name: severity } };
      if (steps) properties["Steps to Reproduce"] = { rich_text: [{ text: { content: steps } }] };

      const res = await fetch(NOTION_PAGES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent: { database_id: dbId }, properties }),
      });
      if (!res.ok) {
        console.error("[feedback] Notion create failed", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[feedback] Notion fan-out error", err);
    }
  }

  return NextResponse.json({ ok: true, freeForever });
}
