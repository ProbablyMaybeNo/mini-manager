import { NextResponse } from "next/server";

/**
 * Recipe-card phase 2 — same-origin read-through proxy for Vercel Blob
 * public images.
 *
 * `ShareCardComposer` bakes the painter's model photo into an exported PNG
 * via `html-to-image`, which needs a CORS-clean fetch of every `<img>` it
 * inlines. Model photos live on `*.public.blob.vercel-storage.com` — a
 * cross-origin host — so routing them through our own origin sidesteps
 * that host's CORS story entirely rather than hoping it sends permissive
 * headers (see `src/lib/shareCard/imageSrc.ts` for where this gets called).
 *
 * Locked to the Blob public-storage host suffix — this is a read-through
 * proxy for our own uploaded images, not an open one, so it can't be used
 * to fetch arbitrary internal/external URLs (SSRF).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOST_SUFFIX = ".public.blob.vercel-storage.com";

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), { cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Image not found" },
      { status: upstream.status || 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      // Same-origin now, so it's cacheable by the browser without needing
      // CORS response headers at all.
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
