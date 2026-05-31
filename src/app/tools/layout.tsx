import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Common chrome for every /tools route. Renders a slim breadcrumb at the
 * top that links back to the tools index. Individual tool routes render
 * their own ToolShell underneath.
 */
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b border-[var(--color-border)] px-4 md:px-6 py-2 flex items-center gap-2">
        <Button as="a" href="/tools" variant="ghost" size="sm">
          ← Tools
        </Button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
