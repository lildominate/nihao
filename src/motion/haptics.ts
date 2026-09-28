// OWNER: Motion agent. Haptic feedback.
// Android/Chrome: navigator.vibrate patterns. iOS Safari has no Vibration API, but since iOS 18
// toggling an <input type="checkbox" switch> gives a system haptic tick, so we click a hidden one.
// Everything is best effort and silently does nothing where unsupported.

export type HapticKind = 'light' | 'success' | 'error' | 'medium' | 'heavy' | 'select' | 'warning'

const PATTERNS: Record<HapticKind, number | number[]> = {
  select: 6,
  light: 10,
  medium: 18,
  heavy: 30,
  success: [12, 70, 20],
  warning: [22, 90, 22],
  error: [35, 60, 35, 60, 45],
}
/** Number of iOS switch ticks per kind (the iOS tick has a fixed strength). */
const IOS_TICKS: Record<HapticKind, number> = { select: 1, light: 1, medium: 1, heavy: 1, success: 2, warning: 2, error: 3 }

let enabled = true
/** Globally enable/disable haptics (e.g. from a future setting). */
export function setHapticsEnabled(v: boolean): void { enabled = v }

let iosLabel: HTMLLabelElement | null = null
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
function isEditable(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}
function iosTick(): void {
  if (typeof document === 'undefined') return
  // Don't risk disturbing the on-screen keyboard while the learner types.
  if (isEditable(document.activeElement)) return
  if (!iosLabel || !iosLabel.isConnected) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosLabel = label
  }
  iosLabel.click()
}

/** Short vibration where supported (Android; iOS 18+ via switch tick); silent no-op otherwise. */
export function haptic(kind: HapticKind = 'light'): void {
  if (!enabled || typeof navigator === 'undefined') return
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] ?? 10)
      return
    }
    if (!isIOS()) return
    const n = IOS_TICKS[kind] ?? 1
    iosTick()
    for (let i = 1; i < n; i++) setTimeout(iosTick, i * 90)
  } catch {
    /* unsupported */
  }
}
