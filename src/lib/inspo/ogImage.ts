import "server-only";

/**
 * Resolve a pasted inspo URL to a displayable image URL.
 *
 * - If the URL is already a direct image (content-type image/*), it's returned
 *   as-is.
 * - Otherwise the page HTML is fetched and the `og:image` (or `twitter:image`)
 *   meta tag is extracted, so Pinterest / Instagram / ArtStation *page* links
 *   render as thumbnails instead of broken images.
 * - Returns `null` on any failure (blocked host, timeout, no image found) — the
 *   caller falls back to `<img src={url}>` / raw text, so this never throws.
 *
 * SSRF note: only http(s) is allowed and obvious private / loopback / link-local
 * hosts are blocked. This is hostname-based (not full post-DNS IP validation),
 * which is proportionate for a single-tenant hobby app fetching public art refs.
 */

const MAX_HTML_BYTES = 512_000;
const FETCH_TIMEOUT_MS = 6_000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv4 literal in a private / loopback / link-local range.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  // IPv6 loopback / unique-local / link-local.
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) {
    return true;
  }
  return false;
}

/** Pull the og:image / twitter:image content URL out of a chunk of HTML. */
export function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    const found = match?.[1]?.trim();
    if (found) return found;
  }
  return null;
}

export async function resolveOgImage(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MiniManagerBot/1.0; +https://miniaturemanager.vercel.app)",
        Accept: "text/html,application/xhtml+xml,image/*,*/*",
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    // The URL is itself a direct image — use it directly.
    if (contentType.startsWith("image/")) return url.toString();
    if (!contentType.includes("html")) return null;

    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    const candidate = extractOgImage(html);
    if (!candidate) return null;
    // Resolve protocol-relative / relative image URLs against the page.
    try {
      const resolved = new URL(candidate, url);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
      return resolved.toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
