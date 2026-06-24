import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * In-app "Report an Issue" sink. Creates a card in the Notion "Testing Task
 * Tracker" database (the existing bug/feedback table) via the Notion REST API.
 *
 * Config (set in env — not in the repo):
 *   - NOTION_TOKEN                  internal-integration secret (required)
 *   - NOTION_FEEDBACK_DATABASE_ID   override the target DB (optional)
 *
 * The integration must be shared with the target database in Notion. When
 * NOTION_TOKEN is absent the route returns 503 so the dialog can show a clean
 * "not configured yet" message instead of throwing.
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
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_FEEDBACK_DATABASE_ID ?? DEFAULT_DB_ID;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Issue reporting isn’t switched on yet." },
      { status: 503 },
    );
  }

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

  // Best-effort reporter attribution — never block on auth.
  const session = await auth().catch(() => null);
  const reporter = session?.user?.email ?? session?.user?.id ?? "anonymous";

  const notes = clamp(
    [details, "", `URL: ${url}`, `Browser: ${userAgent}`, `Reporter: ${reporter}`]
      .filter(Boolean)
      .join("\n"),
    1900,
  );

  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: title || clamp(details, 80) || "Issue report" } }],
    },
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
    const detail = await res.text().catch(() => "");
    console.error("[feedback] Notion create failed", res.status, detail);
    return NextResponse.json(
      { ok: false, error: "Couldn’t submit your report. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
