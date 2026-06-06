import Link from "next/link";
import { ImportClient } from "@/components/imports/ImportClient";

export const dynamic = "force-dynamic";

export default function ImportArmyPage() {
  return (
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-accent)]">
          ← Projects
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">Import army list</span>
      </nav>

      <header className="space-y-2">
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)] mb-2">
          SYS ▸ PROJECTS / IMPORT
        </p>
        <h1 className="title-display text-base md:text-lg">IMPORT ARMY LIST</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-2xl mt-3 leading-snug">
          Drop a BattleScribe <code className="font-mono">.ros</code> /{" "}
          <code className="font-mono">.rosz</code> file, a Warhammer App PDF, a{" "}
          <code className="font-mono">.json</code> list, or paste a plain-text
          list from anywhere. Mini Manager parses it, shows
          you the tree, and turns it into a project hierarchy. You edit
          anything the parser got wrong before applying.
        </p>
      </header>

      <ImportClient />
    </div>
  );
}
