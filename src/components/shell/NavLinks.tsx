"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { activeNavKey, type NavItem } from "./nav";

/** Immediate click feedback: while the clicked link's route is loading, show a
 *  pulsing dot so navigation never feels frozen (the "old page freezes then
 *  jumps" symptom). Must render inside a <Link> — reads its pending state. */
function NavPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan"
      aria-hidden
    />
  ) : null;
}

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
    <ul className={cn("flex flex-col", className)}>
      {items.map((item) => {
        const isActive = item.key === active;
        const Icon = item.icon;
        return (
          <li key={item.key}>
            <Link
              href={item.path}
              onClick={onNavigate}
              data-tour={item.tour}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                // 44px row (HEX.CODE nav-item / WCAG touch target). icon+label,
                // mono uppercase. Active = cyan left indicator + cyan tint +
                // cyan text/icon; rest are neutral with a faint cyan hover. The
                // left border doubles as the active indicator (style guide 1:191)
                // and reserves a transparent 2px on inactive rows so the label
                // baseline never shifts on activation.
                "relative flex min-h-11 items-center gap-3 border-l-2 pl-5 pr-3 font-mono text-[13px] uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:bg-cyan/10 focus-visible:text-cyan-lite",
                isActive
                  ? "border-cyan bg-cyan/[0.06] font-bold text-cyan-lite"
                  : "border-transparent text-fg hover:bg-fg/[0.04] hover:text-cyan-lite",
              )}
            >
              {Icon && <Icon size={16} strokeWidth={2} className="shrink-0" aria-hidden />}
              {item.label}
              <NavPending />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
