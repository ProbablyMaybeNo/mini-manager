import type { ReactNode } from "react";
import { SidebarRail } from "./SidebarRail";
import { MobileTopBar } from "./MobileTopBar";
import { BottomNav } from "./BottomNav";
import { RouteTransition } from "./RouteTransition";

/**
 * App chrome. `signedIn` is a simple boolean prop (the host owns auth):
 *  - signed-in  → renders the rail (desktop) / top bar (mobile) around the content.
 *  - signed-out → renders only the content (public surfaces bring their own nav).
 */
export function AppShell({
  children,
  signedIn = true,
}: {
  children: ReactNode;
  signedIn?: boolean;
}) {
  if (!signedIn) {
    return <main className="min-h-full">{children}</main>;
  }
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:border focus:border-cyan focus:bg-bg focus:px-3 focus:py-1.5 focus:font-button focus:text-button focus:uppercase focus:tracking-[0.15em] focus:text-cyan-lite"
      >
        Skip to content
      </a>
      <SidebarRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          id="main"
          tabIndex={-1}
          // Reserve room for the fixed phone bottom nav (+ its safe-area inset)
          // so trailing content never hides behind the bar; cleared at ≥840px
          // where the rail takes over (MUX-001).
          className="min-w-0 flex-1 overflow-y-auto pb-[calc(3.25rem+env(safe-area-inset-bottom))] outline-none min-[840px]:pb-0"
        >
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
