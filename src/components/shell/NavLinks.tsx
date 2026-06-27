"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { activeNavKey, type NavItem } from "./nav";

/** Shared nav-item list used by both the desktop rail and the mobile menu. */
export function NavLinks({
  items,
  onNavigate,
  className,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const active = activeNavKey(pathname);
  return (
    <ul className={cn("flex flex-col gap-1", className)}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <li key={item.key}>
            <Link
              href={item.path}
              onClick={onNavigate}
              data-tour={item.tour}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                // min-h-11 → 44px comfortable touch target (UX-010); flex
                // keeps the label vertically centred in the taller row.
                // Side-panel nav renders the Title face (UAV OSD Mono) at the
                // body-floor 16px (text-h1) per A1 — Title role, nav size.
                "flex min-h-11 items-center border-l-2 px-4 py-2 font-title text-h1 uppercase tracking-[0.18em] transition-colors",
                isActive
                  ? "border-cyan bg-cyan/10 text-cyan text-glow-cyan"
                  : "border-transparent text-fg hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
