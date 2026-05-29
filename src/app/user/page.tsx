import { ExportButton } from "@/components/user/ExportButton";

export const dynamic = "force-dynamic";

export default function UserPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl">┌─ USER ─</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans">
          Profile · Sync · Inventory · Export · Preferences.
        </p>
      </header>

      <section className="frame bg-[var(--color-bg-elevated)] p-5 space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-[var(--color-fg-muted)]">
          Backup &amp; Export
        </h2>
        <p className="text-sm font-sans text-[var(--color-fg)]">
          Downloads everything you own — projects, named models, recipes
          (with zones and steps), palettes, inventory, and wishlist — as a
          single JSON file. The schema is versioned so a future Mini Manager
          can re-import it.
        </p>
        <ExportButton />
      </section>
    </div>
  );
}
