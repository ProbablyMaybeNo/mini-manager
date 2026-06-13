import { Panel } from "@/components/kit";
import { PageHeader } from "./PageHeader";

/** On-brand placeholder for routes whose full build lands in a later phase. */
export function PagePlaceholder({
  title,
  tagline,
  phase,
}: {
  title: string;
  tagline?: string;
  phase?: string;
}) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={title} tagline={tagline} />
      <Panel label="STATUS" cornerTicks className="max-w-md p-6">
        <p className="font-mono text-xs text-fg-dim">
          ▸ Screen scaffolded. Full build {phase ? `lands in ${phase}.` : "pending."}
        </p>
      </Panel>
    </div>
  );
}
