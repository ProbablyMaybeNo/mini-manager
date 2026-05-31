"use server";

import { redirect } from "next/navigation";
import { applyPasswordReset } from "@/lib/auth/passwordReset";

export async function applyPasswordResetAction(input: {
  token: string;
  password: string;
}): Promise<{ ok: false; message: string } | never> {
  const res = await applyPasswordReset(input);
  if (!res.ok) {
    return { ok: false, message: res.message };
  }
  redirect("/projects");
}
