/**
 * Renders a JSON-LD structured-data block. Server-safe; the payload is
 * serialised once and never contains user input beyond values the caller
 * vouches for, so `dangerouslySetInnerHTML` is the standard, correct sink for
 * ld+json in the App Router.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
