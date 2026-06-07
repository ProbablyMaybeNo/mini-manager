import { Fragment } from "react";
import Link from "next/link";
import { clsx } from "clsx";

export interface Crumb {
  label: string;
  /** Optional href — the last crumb is usually the current page (no link). */
  href?: string;
}

export interface BreadcrumbProps {
  items: ReadonlyArray<Crumb>;
  /** Separator between crumbs. Defaults to the image's " / ". */
  separator?: string;
  className?: string;
}

/**
 * Breadcrumb — gold-standard §12 trail (`ROOT / SYSTEM / DASHBOARD`).
 *
 * Slash-separated mono small-caps crumbs. Crumbs with an `href` render as
 * cyan links; the final / hrefless crumb is the current location (bright
 * white, aria-current="page"). Wrapped in a <nav aria-label> so assistive
 * tech announces it as the page trail.
 */
export function Breadcrumb({
  items,
  separator = "/",
  className,
}: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={clsx("breadcrumb", className)}>
      <ol className="breadcrumb-list">
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={i}>
              <li className="breadcrumb-item">
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="breadcrumb-link">
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className="breadcrumb-current"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {isLast ? null : (
                <li className="breadcrumb-sep" aria-hidden>
                  {separator}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
