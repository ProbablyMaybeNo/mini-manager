import "server-only";

import { db } from "@/db/client";
import { feedback, type Feedback, type FeedbackCategory } from "@/db/schema";

/**
 * Insert one tester-feedback row. Owner-scoped by `userId` (the caller
 * resolves the session first). Returns the inserted row so the API can
 * confirm + optionally fan it out (e.g. Notion) without a second read.
 */
export async function insertFeedback(input: {
  userId: string;
  message: string;
  category: FeedbackCategory;
  pageUrl: string | null;
}): Promise<Feedback> {
  const [row] = await db
    .insert(feedback)
    .values({
      userId: input.userId,
      message: input.message,
      category: input.category,
      pageUrl: input.pageUrl,
    })
    .returning();
  return row!;
}
