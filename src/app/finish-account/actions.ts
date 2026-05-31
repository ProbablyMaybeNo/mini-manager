"use server";

import { redirect } from "next/navigation";
import { finishAccount } from "@/lib/auth/finishAccount";

export async function finishAccountAction(input: {
  username: string;
  password: string;
}): Promise<{ ok: false; message: string } | never> {
  const res = await finishAccount(input);
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  redirect("/projects");
}
