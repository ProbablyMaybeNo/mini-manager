"use client";

import { useRouter } from "next/navigation";
import { Button, Panel } from "@/components/kit";
import { PageHeader } from "@/components/shell";

export function RecipeNotFound({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="RECIPE NOT FOUND" />
      <Panel label="ERROR" accent="red" className="max-w-md p-6">
        <p className="font-body text-body text-red">▸ No recipe with id “{id}”.</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => router.push("/recipes")}>
            ← Back to recipes
          </Button>
        </div>
      </Panel>
    </div>
  );
}
