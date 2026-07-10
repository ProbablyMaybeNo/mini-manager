import { cn } from "@/lib/cn";

/**
 * Centered public-page title — the frameless-page counterpart to the app's
 * PageHeader (4:4). Nouveau IBM ExtraBold (Ross 2026-07-10, FINAL), uppercase,
 * bright-white title with wide letter-spacing and the short cyan underline bar
 * beneath it, so /pricing, /privacy, /terms etc. read native to the HEX.CODE
 * system. clamp() keeps the min modest so it still fits a 320px viewport
 * (MUX-008); the max is pushed up because Nouveau IBM reads small.
 */
export function PublicPageTitle({
  children,
  align = "center",
  className,
}: {
  children: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "flex flex-col items-center" : "flex flex-col items-start", className)}>
      <h1
        className="font-title font-extrabold uppercase leading-none tracking-[0.15em] text-fg-bright"
        style={{ fontSize: "clamp(0.9375rem, 3.375vw, calc(var(--text-title) * 1.15))" }}
      >
        {children}
      </h1>
      <span aria-hidden className="mt-3 block h-1 w-12 rounded-full bg-cyan" />
    </div>
  );
}
