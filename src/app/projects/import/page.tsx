import Link from "next/link";
import { ImportClient } from "@/components/imports/ImportClient";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function ImportArmyPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <nav
        className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]"
        aria-label="Breadcrumb"
      >
        <Link href="/projects" className="hover:underline">
          SYS ▸ PROJECTS
        </Link>
        <span className="text-[var(--color-fg-subtle)]"> / IMPORT</span>
      </nav>

      <PageHeader
        title="IMPORT ARMY LIST"
        accent="green"
        tagline="Drop a BattleScribe .ros / .rosz file, a Warhammer App PDF, a .json list, or paste a plain-text list from anywhere — Mini Manager parses it into an editable project tree before you apply."
      />

      <ImportClient />
    </div>
  );
}
