import { cn } from "@/lib/cn";

/**
 * Centered public-page title — the frameless-page counterpart to the app's
 * PageHeader (4:4). JetBrains Mono ExtraBold, uppercase, bright-white title
 * with the short cyan underline bar beneath it, so /pricing, /privacy, /terms
 * etc. read native to the HEX.CODE system. clamp() keeps it inside a 320px
 * viewport (MUX-008).
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
        className="font-mono font-extrabold uppercase leading-none tracking-tight text-fg-bright"
        style={{ fontSize: "clamp(1.75rem, 9vw, var(--text-title))" }}
      >
        {children}
      </h1>
      <span aria-hidden className="mt-3 block h-1 w-12 rounded-full bg-cyan" />
    </div>
  );
}
