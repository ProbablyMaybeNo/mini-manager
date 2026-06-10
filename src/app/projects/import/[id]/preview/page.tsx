import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchImportForPreview } from "@/lib/actions/imports";
import { ImportPreview } from "@/components/imports/ImportPreview";
import { PageHeader } from "@/components/ui/PageHeader";

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
      <div className="p-6 md:p-8 max-w-3xl space-y-6">
        <nav
          className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]"
          aria-label="Breadcrumb"
        >
          <Link href="/projects/import" className="hover:underline">
            SYS ▸ IMPORT
          </Link>
          <span className="text-[var(--color-fg-subtle)]"> / FAILED</span>
        </nav>
        <PageHeader
          title="IMPORT FAILED"
          accent="red"
          tagline="The parser couldn't read that list. Check the file or paste the text again."
        />
        <p
          className="text-sm font-mono text-[var(--color-red)]"
          role="alert"
        >
          {result.error}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <nav
        className="font-mono text-2xs uppercase tracking-[0.2em] text-[var(--color-cyan)]"
        aria-label="Breadcrumb"
      >
        <Link href="/projects" className="hover:underline">
          SYS ▸ PROJECTS
        </Link>
        <span className="text-[var(--color-fg-subtle)]"> / </span>
        <Link href="/projects/import" className="hover:underline">
          IMPORT
        </Link>
        <span className="text-[var(--color-fg-subtle)]"> / PREVIEW</span>
      </nav>

      <PageHeader
        title="PREVIEW"
        accent="green"
        tagline="Edit anything the parser got wrong. Apply creates an Army project with one Unit child per row."
      />

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
