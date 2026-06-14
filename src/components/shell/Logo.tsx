import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** The Mini Manager CRT logo (exported from Figma). Links home / to dashboard. */
export function Logo({
  href = "/dashboard",
  size = 64,
  className,
}: {
  href?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Link href={href} aria-label="Mini Manager" className={cn("inline-block", className)}>
      <Image
        src="/logo.png"
        alt="Mini Manager"
        width={size}
        height={size}
        priority
        className="select-none"
      />
    </Link>
  );
}
