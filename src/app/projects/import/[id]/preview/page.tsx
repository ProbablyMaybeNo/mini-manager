import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchImportForPreview } from "@/lib/actions/imports";
import { ImportPreview } from "@/components/imports/ImportPreview";

export const dynamic = "force-dynamic";

interface PreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ImportPreviewPage({ params }: PreviewPageProps) {
  const { id } = await params;
  const result = await fetchImportForPreview(id);

  if (!result.ok) {
    if (result.error === "Import not found.") notFound();
    return (
      <div className="p-6 md:p-8 max-w-3xl space-y-4">
        <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
          <Link href="/projects/import" className="hover:text-[var(--color-accent)]">
            ← Import another list
          </Link>
        </nav>
        <header className="space-y-2">
          <h1 className="text-2xl">┌─ IMPORT FAILED ─</h1>
          <p
            className="text-sm font-mono text-[var(--color-amber)]"
            role="alert"
          >
            {result.error}
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <nav className="text-xs font-mono text-[var(--color-fg-muted)]">
        <Link href="/projects" className="hover:text-[var(--color-accent)]">
          ← Projects
        </Link>
        {" > "}
        <Link
          href="/projects/import"
          className="hover:text-[var(--color-accent)]"
        >
          Import
        </Link>
        {" > "}
        <span className="text-[var(--color-fg)]">Preview</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl">┌─ PREVIEW ─</h1>
        <p className="text-sm text-[var(--color-fg-muted)] font-sans max-w-2xl">
          Edit anything the parser got wrong. <strong>Apply</strong> creates an
          Army project with one Unit child per row.
        </p>
      </header>

      <ImportPreview
        importId={result.import.id}
        initialTree={result.tree}
        parserUsed={result.import.parserUsed}
        confidence={result.import.parserConfidence}
        warnings={result.warnings}
      />
    </div>
  );
}
