/**
 * A single-flight guard: while one invocation is in flight, further calls are
 * dropped. The in-flight flag flips SYNCHRONOUSLY on entry (before the first
 * await), so a native double-click — which fires ~15ms apart, faster than a
 * React disabled-prop re-render — can never start the wrapped action twice.
 *
 * Held in a ref (not state) so it survives re-renders without re-creating.
 */
export function createSingleFlightGuard() {
  let inFlight = false;
  return async function run(fn: () => Promise<void>): Promise<boolean> {
    if (inFlight) return false;
    inFlight = true;
    try {
      await fn();
      return true;
    } finally {
      inFlight = false;
    }
  };
}

export type SingleFlightGuard = ReturnType<typeof createSingleFlightGuard>;
