// OWNER: Motion agent. Reduced-motion state: OS media query + the app setting (settings.reduceMotion).
import { useEffect, useSyncExternalStore } from 'react'
import { useProgress } from '../progress'

const QUERY = '(prefers-reduced-motion: reduce)'
let appReduce = false
const listeners = new Set<() => void>()

function mq(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try { return window.matchMedia(QUERY) } catch { return null }
}

/** OS-level "reduce motion". */
export function osReducedMotion(): boolean {
  return !!mq()?.matches
}

/** Non-hook check (for imperative code like celebrate/flyTo): OS setting OR app setting. */
export function prefersReducedMotion(): boolean {
  return appReduce || osReducedMotion()
}

/**
 * Mirror the app setting into module state and onto <html data-reduce-motion="true">, which
 * motion.css uses to switch off ALL CSS animations app-wide (same effect as the OS setting).
 */
export function setAppReducedMotion(v: boolean): void {
  if (typeof document !== 'undefined') {
    if (v) document.documentElement.dataset.reduceMotion = 'true'
    else delete document.documentElement.dataset.reduceMotion
  }
  if (appReduce === v) return
  appReduce = v
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  const m = mq()
  m?.addEventListener?.('change', cb)
  return () => {
    listeners.delete(cb)
    m?.removeEventListener?.('change', cb)
  }
}

/** Reads settings.reduceMotion if a <ProgressProvider> exists; null when there is none. */
function useSettingReduce(): boolean | null {
  try {
    // useProgress() always calls useContext first, so hook order is stable even when it throws.
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    return !!useProgress().state.settings.reduceMotion
  } catch {
    return null
  }
}

/** true if the user prefers reduced motion (OS setting or app setting). Safe without a provider. */
export function useReducedMotion(): boolean {
  const setting = useSettingReduce()
  useEffect(() => {
    if (setting !== null) setAppReducedMotion(setting)
  }, [setting])
  const snap = useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
  return snap || setting === true
}

/** Mount once inside <ProgressProvider> so CSS + celebrate() follow settings.reduceMotion everywhere. */
export function MotionSettingsSync(): null {
  useReducedMotion()
  return null
}
