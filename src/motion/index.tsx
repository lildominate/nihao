// OWNER: Motion agent. Animation & feedback primitives used across the app. Signatures = contract.
import type { ReactNode } from 'react'

/** Fire a celebration overlay (canvas/DOM, auto-cleans). Respects reduced motion. */
export function celebrate(_kind: 'confetti' | 'burst' | 'fireworks' | 'stars' = 'confetti', _opts?: { origin?: { x: number; y: number } }): void {}
/** Short vibration where supported (Android); no-op on iOS. */
export function haptic(_kind: 'light' | 'success' | 'error' = 'light'): void {}
/** Number that rolls up/down to `value`. */
export function CountUp({ value, className }: { value: number; durationMs?: number; className?: string }) {
  return <span className={className}>{value}</span>
}
/** Animated enter when `swapKey` changes (screen/exercise transitions). */
export function Transition({ swapKey, children, className }: { swapKey: string | number; kind?: 'slide' | 'fade' | 'pop' | 'up'; children: ReactNode; className?: string }) {
  return <div key={swapKey} className={className}>{children}</div>
}
/** Full-screen splash/loading screen with the mascot. */
export function Splash(_props: { message?: string; onDone?: () => void }) { return null }
/** Big full-screen celebration moment (level up, streak, lesson done). */
export function CelebrationOverlay(_props: { open: boolean; title: string; subtitle?: string; mood?: 'cheer' | 'proud'; onClose: () => void; children?: ReactNode }) { return null }
/** true if the user prefers reduced motion (OS setting or app setting). */
export function useReducedMotion(): boolean { return false }
