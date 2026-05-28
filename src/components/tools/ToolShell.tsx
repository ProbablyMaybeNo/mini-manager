"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

interface Props {
  /** Left pane content — typically the input controls / canvas. */
  input: ReactNode;
  /** Right pane content — typically the result list / preview / actions. */
  output: ReactNode;
  /** Sticky footer actions. Disabled when the tool has nothing to send. */
  footer?: ReactNode;
  /** Optional className on the outer wrapper. */
  className?: string;
}

/**
 * Two-pane shell shared by every tool route. Desktop: input on the left,
 * output on the right; both panes scroll independently. Mobile: single
 * column, full-height scroll. Footer sits at the bottom of the viewport
 * (sticky) so the painter always has the action buttons within thumb's
 * reach.
 */
export function ToolShell({ input, output, footer, className }: Props) {
  return (
    <div
      className={clsx(
        "flex flex-col min-h-[calc(100vh-72px)]",
        className,
      )}
    >
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <section
          aria-label="Tool input"
          className="lg:w-[420px] lg:max-w-[45%] lg:border-r border-[var(--color-border)] lg:overflow-y-auto"
        >
          <div className="p-4 lg:p-5">{input}</div>
        </section>
        <section
          aria-label="Tool output"
          className="flex-1 min-w-0 border-t lg:border-t-0 border-[var(--color-border)] lg:overflow-y-auto"
        >
          <div className="p-4 lg:p-5">{output}</div>
        </section>
      </div>
      {footer ? (
        <footer
          className="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur px-4 py-3"
          aria-label="Tool actions"
        >
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
