import type { ReactNode } from "react";
import { SidebarRail } from "./SidebarRail";
import { MobileTopBar } from "./MobileTopBar";
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
      {/* min-h-0 bounds this column-flex child so the inner <main> scroll
          container is height-constrained on mobile. Without it the whole
          document scrolls and react-virtual renders every /library node
          (7,000+) instead of the visible window (P4). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          id="main"
          tabIndex={-1}
          // The fixed bottom nav is gone (the hamburger in MobileTopBar owns
          // mobile nav now), so the only reserved space is the home-indicator
          // safe area.
          className="min-w-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] outline-none min-[840px]:pb-0"
        >
          <RouteTransition>{children}</RouteTransition>
        </main>
      </div>
    </div>
  );
}
