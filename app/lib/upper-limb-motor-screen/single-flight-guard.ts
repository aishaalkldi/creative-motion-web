/**
 * Generic single-flight guard — the reusable form of the
 * `saveInProgressRef` pattern already established in
 * app/components/clinician/cv/CvLabSession.tsx: a synchronous boolean
 * check-and-set before an async action starts, reset when it settles.
 *
 * Used to prevent duplicate assignment creation / session-result save /
 * finalize calls from React re-renders, StrictMode double-invoke, rapid
 * double-clicks, or overlapping retries. Framework-agnostic — usable from
 * a React ref, a class field, or a plain closure.
 */

export type SingleFlightGuard = {
  /** True while a run() call is in flight. */
  readonly inProgress: boolean;
  /**
   * Runs fn() unless a previous run() is still in flight, in which case
   * this call is a synchronous no-op and resolves to { skipped: true }.
   */
  run<T>(fn: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }>;
};

export function createSingleFlightGuard(): SingleFlightGuard {
  let inProgress = false;

  return {
    get inProgress() {
      return inProgress;
    },
    async run<T>(fn: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }> {
      if (inProgress) return { skipped: true };
      inProgress = true;
      try {
        const value = await fn();
        return { skipped: false, value };
      } finally {
        inProgress = false;
      }
    },
  };
}
