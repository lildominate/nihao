// Pure timing rules for the Splash screen (unit-testable without a DOM).

/** Default minimum time on screen so the version string can be read. */
export const SPLASH_MIN_MS = 1500

/** Minimum hold time. Reduced motion removes animation, not reading time, so only a huge value is capped. */
export function splashHoldMs(minMs: number = SPLASH_MIN_MS): number {
  return Number.isFinite(minMs) ? Math.max(0, minMs) : SPLASH_MIN_MS
}

/** The splash may leave once the minimum time has passed, any message is typed out and the app is ready. */
export function splashCanLeave(s: { minPassed: boolean; typedAll: boolean; ready: boolean }): boolean {
  return s.minPassed && s.typedAll && s.ready
}
