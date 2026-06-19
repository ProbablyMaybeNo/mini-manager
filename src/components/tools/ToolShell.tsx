import Link from "next/link";
import { Button } from "@/components/kit";
import { PageHeader } from "@/components/shell";

/** Common chrome for a single tool: back-to-hub link + title + blurb. */
export function ToolShell({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-x-hidden overflow-y-auto p-6">
      <Link href="/tools">
        <Button variant="tertiary">← Tools</Button>
      </Link>
      <PageHeader title={title} tagline={blurb} />
      {children}
    </div>
  );
}
