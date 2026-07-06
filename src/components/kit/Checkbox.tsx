import { cn } from "@/lib/cn";

/** Small square checkbox — native `<input type="checkbox">` so it's
 *  keyboard-focusable and announces state to screen readers for free.
 *  Styled to match the app's 1px-border, no-radius(ish) primitives. */
export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        "h-4 w-4 cursor-pointer rounded-[3px] border border-border bg-transparent accent-cyan",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan",
        className,
      )}
    />
  );
}
