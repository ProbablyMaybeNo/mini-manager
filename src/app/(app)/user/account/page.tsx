import { redirect } from "next/navigation";

/** Account was merged into the Settings page (`/user`). Keep the old route
 *  working for bookmarks / deep links by redirecting to it. */
export default function AccountPage() {
  redirect("/user");
}
