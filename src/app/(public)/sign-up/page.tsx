"use client";

import { useRouter } from "next/navigation";
import { AuthView } from "@/components/public/AuthView";

export default function SignUpPage() {
  const router = useRouter();
  return <AuthView mode="sign-up" onSubmit={() => router.push("/dashboard")} />;
}
