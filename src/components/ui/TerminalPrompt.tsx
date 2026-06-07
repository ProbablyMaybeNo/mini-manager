import { clsx } from "clsx";

export interface TerminalPromptProps {
  /** The prompt string before the cursor. Default "root@terminal:~#". */
  prompt?: string;
  /** Optional typed command shown after the prompt. */
  command?: string;
  /** Show the blinking block cursor. Default true. */
  cursor?: boolean;
  className?: string;
}

/**
 * TerminalPrompt — gold-standard §12 prompt (`root@terminal:~# _`).
 *
 * A mono prompt with a green user@host segment, a white path/$ tail, an
 * optional typed command, and a blinking block cursor. Decorative chrome
 * (aria-hidden) — flavour, not content. The cursor blink is motion-safe
 * (reduced-motion users get a steady block).
 */
export function TerminalPrompt({
  prompt = "root@terminal:~#",
  command,
  cursor = true,
  className,
}: TerminalPromptProps) {
  return (
    <span className={clsx("terminal-prompt", className)} aria-hidden>
      <span className="terminal-prompt-ps1">{prompt}</span>
      {command ? (
        <span className="terminal-prompt-cmd">{command}</span>
      ) : null}
      {cursor ? <span className="terminal-prompt-cursor" /> : null}
    </span>
  );
}
