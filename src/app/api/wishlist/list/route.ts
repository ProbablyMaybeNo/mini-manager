import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/auth-stub";
import { listWishlist } from "@/db/queries/wishlist";

/** Owner-scoped wishlist list — used by the global search popover. */
export async function GET(): Promise<NextResponse> {
  const userId = await currentUserId();
  const items = await listWishlist(userId, { status: "All" });
  return NextResponse.json(items);
}
