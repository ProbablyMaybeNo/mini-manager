/**
 * D5 — minimal client-side undo store.
 *
 * The D4 keyboard layer dispatches a `mm:undo` window event on Ctrl/Cmd+Z
 * (see GlobalSearch). This store is the handler side: actions that are
 * cheaply reversible (today: stage-counter bumps + sets) push an inverse
 * thunk here, and the most-recent one is popped + run when the painter
 * hits undo.
 *
 * Deliberately tiny + in-memory (no persistence): undo is a "take that
 * back" affordance for the current session, not a full history. A bounded
 * LIFO stack keeps memory flat under heavy bumping.
 */

/** A reversible action: running it undoes the change it was recorded for. */
export type UndoEntry = {
  /** Short human label (for a future snackbar / toast). */
  label: string;
  /** Apply the inverse. May be async (server action). */
  invert: () => void | Promise<void>;
};

const MAX_DEPTH = 50;
const stack: UndoEntry[] = [];

/** Record a reversible action. The newest entry is undone first. */
export function pushUndo(entry: UndoEntry): void {
  stack.push(entry);
  if (stack.length > MAX_DEPTH) stack.shift();
}

/**
 * Pop + run the most-recent undo entry. Returns the entry that ran (so a
 * caller can surface "Undid <label>"), or null when the stack is empty.
 */
export function popUndo(): UndoEntry | null {
  const entry = stack.pop();
  if (!entry) return null;
  void entry.invert();
  return entry;
}

/** True when there's at least one undoable action queued. */
export function canUndo(): boolean {
  return stack.length > 0;
}

/** Test/reset helper — clears the stack. */
export function clearUndo(): void {
  stack.length = 0;
}

/** Current depth — exposed for tests. */
export function undoDepth(): number {
  return stack.length;
}
