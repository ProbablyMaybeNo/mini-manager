import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { countProjectImages } from "@/db/queries/projectImages";
import { blobReadWriteToken, isBlobConfigured } from "@/lib/blob/env";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PROJECT,
} from "@/lib/blob/limits";

/**
 * Recipe-card phase 1 — client-upload token route.
 *
 * The painter's browser calls `upload()` from `@vercel/blob/client`, which
 * POSTs here first to get a short-lived, constrained client token, then
 * PUTs the file bytes straight to Vercel Blob (never through this server —
 * side-steps the ~4.5MB serverless request-body limit entirely). This
 * route only ever sees the (tiny) token-request body, never the image.
 *
 * `onBeforeGenerateToken` is where every real check happens — it's the
 * only place a tampered client can't bypass, since the returned
 * `allowedContentTypes` / `maximumSizeInBytes` are enforced by Vercel Blob
 * itself on the upload PUT, not just trusted client-side:
 *   - the caller is signed in
 *   - the caller owns the target project node
 *   - the project hasn't hit MAX_IMAGES_PER_PROJECT yet
 *
 * No `onUploadCompleted` callback — that webhook only fires reliably once
 * deployed with a public URL (not on localhost without a tunnel). Instead
 * the client calls `recordProjectImage` directly with the resolved blob
 * url/pathname right after `upload()` resolves (see ProjectImagePanel).
 * `onBeforeGenerateToken`'s ownership + cap checks are what actually gate
 * the upload — `recordProjectImage` re-checks ownership + the cap again
 * before writing the DB row, so nothing here is trust-on-faith.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Image storage isn't configured yet." },
      { status: 503 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobReadWriteToken() ?? undefined,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        let projectId: string | undefined;
        try {
          const parsed: unknown = clientPayloadRaw
            ? JSON.parse(clientPayloadRaw)
            : null;
          projectId =
            parsed && typeof parsed === "object" && "projectId" in parsed
              ? String((parsed as { projectId: unknown }).projectId)
              : undefined;
        } catch {
          projectId = undefined;
        }
        if (!projectId) throw new Error("Missing project id");

        const rows = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
          .limit(1);
        if (rows.length === 0) throw new Error("Project not found");

        const existing = await countProjectImages(projectId);
        if (existing >= MAX_IMAGES_PER_PROJECT) {
          throw new Error(
            `This project already has the maximum of ${MAX_IMAGES_PER_PROJECT} photos.`,
          );
        }

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ projectId, ownerId: userId }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
