// OWNER: Motion agent. Animation & feedback primitives used across the app. Signatures = contract.
// Usage guide: src/motion/README.md. CSS utilities: src/styles/motion.css. Demo: /src/motion/_demo/index.html
//
//   celebrate(kind, opts?)            canvas particles: 'confetti' | 'burst' | 'fireworks' | 'stars'
//   haptic(kind?)                     vibration / iOS 18 switch tick; silent no-op elsewhere
//   <CountUp value />                 rolling number
//   <Transition swapKey kind />       enter animation when swapKey changes
//   <Splash onDone />                 launch/loading screen
//   <CelebrationOverlay open … />     full-screen reward moment
//   useReducedMotion()                OS setting OR settings.reduceMotion (safe without provider)
//   <MotionSettingsSync />            mount once inside ProgressProvider (applies the app setting to CSS)
//   <Skeleton />, <Pressable />, setTapSound(), flyTo(), bump(), replay(), prefersReducedMotion()

export { celebrate } from './particles'
export type { CelebrateKind, CelebrateOptions } from './particles'
export { haptic, setHapticsEnabled } from './haptics'
export type { HapticKind } from './haptics'
export { CountUp, Transition, Splash, CelebrationOverlay, Skeleton, Pressable, setTapSound } from './components'
export { useReducedMotion, prefersReducedMotion, MotionSettingsSync, setAppReducedMotion } from './reduced'
export { flyTo, bump, replay } from './fly'
export type { FlyOptions } from './fly'

// iOS Safari only applies :active (used by `.press`) when a touchstart listener exists.
if (typeof document !== 'undefined') {
  document.addEventListener('touchstart', () => {}, { passive: true })
}
