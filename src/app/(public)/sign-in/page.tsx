"use client";

import { useRouter } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";

export default function SignInPage() {
  const router = useRouter();
  return <AuthView mode="sign-in" onSubmit={() => router.push("/dashboard")} />;
}
