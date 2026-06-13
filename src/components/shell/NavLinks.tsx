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
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "block border-l-2 px-4 py-2 font-osd text-sm uppercase tracking-[0.18em] transition-colors",
                isActive
                  ? "border-cyan text-cyan text-glow-cyan"
                  : "border-transparent text-fg-dim hover:border-cyan/40 hover:text-cyan",
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
