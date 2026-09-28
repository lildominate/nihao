// OWNER: Motion agent. Imperative DOM helpers: flyTo (XP orbs → counter), bump, replay.
import { prefersReducedMotion } from './reduced'

export interface FlyOptions {
  /** How many orbs (staggered). Default 1, max 12. */
  count?: number
  /** Flight time per orb in ms. Default 750. */
  durationMs?: number
  /** Delay between orbs in ms. Default 70. */
  staggerMs?: number
  /** Extra class for the orb (default look: `.fly-orb`, a gold coin). */
  className?: string
  /** Called as each orb lands (e.g. increment a counter, play a tick). */
  onArrive?: (index: number) => void
}

function center(el: Element) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Springy scale bump on an element (uses the independent `scale` property, so it never fights `transform`). */
export function bump(el: Element | null | undefined, amount = 1.22): void {
  if (!el || prefersReducedMotion() || typeof (el as HTMLElement).animate !== 'function') return
  try {
    ;(el as HTMLElement).animate(
      [{ scale: '1' }, { scale: String(amount) }, { scale: '1' }],
      { duration: 320, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    )
  } catch { /* ignore */ }
}

/** Restart a one-shot CSS animation class (e.g. `replay(el, 'shake')` on every wrong answer). */
export function replay(el: Element | null | undefined, className: string): void {
  if (!el) return
  el.classList.remove(className)
  void (el as HTMLElement).offsetWidth // restart the animation
  el.classList.add(className)
}

/**
 * Fly `content` (text like "+10", an emoji, or a DOM node) from one element to another along a
 * curved path, e.g. XP orbs to the XP counter. Resolves when the last orb lands. The target gets
 * a bump per arrival. Reduced motion: no flight; resolves right away (onArrive still fires).
 */
export function flyTo(
  fromEl: Element | null | undefined,
  toEl: Element | null | undefined,
  content: string | Node = '',
  opts: FlyOptions = {},
): Promise<void> {
  const count = Math.max(1, Math.min(12, opts.count ?? 1))
  const done = () => { for (let i = 0; i < count; i++) opts.onArrive?.(i) }
  if (typeof document === 'undefined' || !fromEl || !toEl || prefersReducedMotion() || typeof document.body.animate !== 'function') {
    done()
    return Promise.resolve()
  }
  const a = center(fromEl)
  const b = center(toEl)
  const duration = opts.durationMs ?? 750
  const stagger = opts.staggerMs ?? 70

  const flights: Promise<void>[] = []
  for (let i = 0; i < count; i++) {
    const orb = document.createElement('div')
    orb.className = `fly-orb ${opts.className ?? ''}`
    orb.setAttribute('aria-hidden', 'true')
    if (typeof content === 'string') orb.textContent = content
    else orb.appendChild(content.cloneNode(true))
    document.body.appendChild(orb)
    const half = { x: orb.offsetWidth / 2, y: orb.offsetHeight / 2 }

    // start slightly scattered; curve bows upward and sideways
    const sx = a.x + (count > 1 ? (Math.random() - 0.5) * 50 : 0)
    const sy = a.y + (count > 1 ? (Math.random() - 0.5) * 30 : 0)
    const cx = sx + (b.x - sx) * 0.25 + (Math.random() - 0.5) * 80
    const cy = Math.min(sy, b.y) - 90 - Math.random() * 60
    const at = (t: number) => ({
      x: (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * b.x,
      y: (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * b.y,
    })
    const tf = (x: number, y: number, s: number) => `translate3d(${x - half.x}px, ${y - half.y}px, 0) scale(${s})`

    const steps = 14
    const path: Keyframe[] = []
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const p = at(t)
      path.push({ transform: tf(p.x, p.y, 1.1 - 0.55 * t), opacity: t > 0.92 ? 0.4 : 1, offset: t })
    }

    const flight = new Promise<void>((resolve) => {
      const finish = () => { orb.remove(); opts.onArrive?.(i); bump(toEl); resolve() }
      try {
        const pop = orb.animate(
          [{ transform: tf(sx, sy, 0.2), opacity: 0 }, { transform: tf(sx, sy - 14, 1.15), opacity: 1 }, { transform: tf(sx, sy - 8, 1.1), opacity: 1 }],
          { duration: 220, delay: i * stagger, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' },
        )
        pop.finished.then(() => {
          // the path's first keyframe is the pop's end state
          path[0] = { transform: tf(sx, sy - 8, 1.1), opacity: 1, offset: 0 }
          const fly = orb.animate(path, { duration, easing: 'cubic-bezier(0.45, 0, 0.8, 0.5)', fill: 'forwards' })
          pop.cancel()
          fly.finished.then(finish, finish)
        }, finish)
      } catch {
        finish()
      }
    })
    flights.push(flight)
  }
  return Promise.all(flights).then(() => undefined)
}
