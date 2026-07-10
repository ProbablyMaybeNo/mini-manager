import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { blobReadWriteToken, isBlobConfigured } from "@/lib/blob/env";
import { MAX_IMAGE_BYTES } from "@/lib/blob/limits";

/**
 * Recipe-card phase 3 — client-upload token route for gallery SUBMIT.
 * Mirrors `/api/project-images/upload` exactly (see that route's comment
 * for the full client-upload rationale): the browser PUTs the rendered
 * card PNG straight to Vercel Blob, this route only ever hands out a
 * scoped token. `onBeforeGenerateToken` is where the real checks live —
 * signed in + the caller owns the target recipe.
 *
 * No `onUploadCompleted` — `submitRecipeToGallery` (called by the client
 * right after `upload()` resolves) is what actually records the pending
 * submission; it re-verifies ownership itself.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Card exports are rendered at a fixed 1080px-wide raster — comfortably
// under the general image cap, but capped separately in case a future
// export width grows the PNG.
const MAX_CARD_BYTES = MAX_IMAGE_BYTES;

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
        let recipeId: string | undefined;
        try {
          const parsed: unknown = clientPayloadRaw ? JSON.parse(clientPayloadRaw) : null;
          recipeId =
            parsed && typeof parsed === "object" && "recipeId" in parsed
              ? String((parsed as { recipeId: unknown }).recipeId)
              : undefined;
        } catch {
          recipeId = undefined;
        }
        if (!recipeId) throw new Error("Missing recipe id");

        const rows = await db
          .select({ id: recipes.id })
          .from(recipes)
          .where(and(eq(recipes.id, recipeId), eq(recipes.ownerId, userId)))
          .limit(1);
        if (rows.length === 0) throw new Error("Recipe not found");

        return {
          allowedContentTypes: ["image/png"],
          maximumSizeInBytes: MAX_CARD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ recipeId, ownerId: userId }),
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
