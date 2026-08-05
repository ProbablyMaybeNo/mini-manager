/**
 * The project inspector's drill stack, encoded in the dashboard URL.
 *
 * `/dashboard?open=<rootId>` opens the inspector on that project; each extra
 * tier the painter drills into adds a `sub` value in order:
 * `/dashboard?open=<rootId>&sub=<childId>&sub=<grandchildId>`.
 *
 * Keeping the stack in the URL is what makes browser Back pop exactly one tier
 * (MOP-004): every tier is one ordinary history entry, so Back is the router's
 * business rather than a second stack the component has to keep in step.
 * `open` is the same param the project page already hands off with
 * (`/dashboard?open=<id>` from "+ Add Sub-Project"), so that link now simply
 * lands with the panel open instead of being stripped into React state.
 */

export const INSPECTOR_ROOT_PARAM = "open";
export const INSPECTOR_SUB_PARAM = "sub";

/** Anything that can answer `get`/`getAll` — URLSearchParams or Next's readonly wrapper. */
export interface ReadableSearchParams {
  get(name: string): string | null;
  getAll(name: string): string[];
  entries(): IterableIterator<[string, string]>;
}

/**
 * The open drill stack, root first. Empty when the inspector is closed.
 * A `sub` without a root is meaningless, so it yields an empty stack.
 */
export function readInspectorStack(params: ReadableSearchParams): string[] {
  const root = params.get(INSPECTOR_ROOT_PARAM);
  if (!root) return [];
  const stack = [root];
  for (const sub of params.getAll(INSPECTOR_SUB_PARAM)) {
    // A repeated id would make two tiers of the same project; the stack is a
    // path down the tree, so ignore anything already on it.
    if (sub && !stack.includes(sub)) stack.push(sub);
  }
  return stack;
}

/**
 * `pathname` + the search string carrying `stack`, leaving every unrelated
 * param untouched (and its order stable). An empty stack drops both params —
 * that is the "inspector closed" URL.
 */
export function inspectorHref(
  pathname: string,
  params: ReadableSearchParams,
  stack: readonly string[],
): string {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key === INSPECTOR_ROOT_PARAM || key === INSPECTOR_SUB_PARAM) continue;
    next.append(key, value);
  }
  if (stack.length > 0) {
    next.set(INSPECTOR_ROOT_PARAM, stack[0]);
    for (const sub of stack.slice(1)) next.append(INSPECTOR_SUB_PARAM, sub);
  }
  const search = next.toString();
  return search ? `${pathname}?${search}` : pathname;
}
