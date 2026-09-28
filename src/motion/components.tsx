// OWNER: Motion agent. React motion components. Styles live in src/styles/motion.css (mo-* classes).
import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Panda } from '../mascot/Panda'
import { haptic, type HapticKind } from './haptics'
import { celebrate, type CelebrateKind } from './particles'
import { useReducedMotion } from './reduced'

// ─── CountUp ─────────────────────────────────────────────────

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Number that rolls up/down to `value` (rAF, ease-out, tabular-nums), with an optional pop on change. */
export function CountUp({ value, durationMs = 700, className, pulse = true, format, from }: {
  value: number
  durationMs?: number
  className?: string
  /** Scale-pulse when the value changes. Default true. */
  pulse?: boolean
  /** Custom formatting, e.g. n => n.toLocaleString('sv-SE'). Default: rounded integer. */
  format?: (n: number) => string
  /** Roll from this value on first mount (e.g. 0 for a results screen). Default: no roll on mount. */
  from?: number
}) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(from ?? value)
  const shown = useRef(from ?? value)
  const [pulseKey, setPulseKey] = useState(0)
  const first = useRef(true)

  useEffect(() => {
    const start = shown.current
    const isFirst = first.current
    first.current = false
    if (start === value) return
    if (!isFirst && pulse && !reduced) setPulseKey((k) => k + 1)
    if (reduced || durationMs <= 0 || typeof requestAnimationFrame === 'undefined') {
      shown.current = value
      setDisplay(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const dur = Math.min(durationMs, 250 + Math.abs(value - start) * 40) // tiny changes stay snappy
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      const v = start + (value - start) * easeOutCubic(p)
      shown.current = v
      setDisplay(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs, reduced, pulse])

  const fmt = format ?? ((n: number) => String(Math.round(n)))
  return (
    <span className={`relative inline-block tabular-nums ${className ?? ''}`}>
      <span key={pulseKey} className={pulseKey ? 'mo-count-pulse inline-block' : 'inline-block'} aria-hidden="true">{fmt(display)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  )
}

// ─── Transition ──────────────────────────────────────────────

/**
 * Animated enter when `swapKey` changes (screen/exercise transitions). Enter-only by design: the old
 * subtree unmounts immediately, so no double-mounted audio/effects. Uses fill-mode `backwards`, so
 * once the animation ends the wrapper has NO transform (position:fixed children behave normally).
 */
export function Transition({ swapKey, kind = 'fade', children, className, direction = 1, durationMs }: {
  swapKey: string | number
  kind?: 'slide' | 'fade' | 'pop' | 'up'
  children: ReactNode
  className?: string
  /** slide: 1 = from the right (forward), -1 = from the left (back). */
  direction?: 1 | -1
  durationMs?: number
}) {
  const reduced = useReducedMotion()
  const style = { '--mo-dir': direction, ...(durationMs ? { '--mo-dur': `${durationMs}ms` } : {}) } as CSSProperties
  return (
    <div key={swapKey} className={`${reduced ? '' : `mo-enter-${kind}`} ${className ?? ''}`} style={style}>
      {children}
    </div>
  )
}

// ─── Splash ──────────────────────────────────────────────────

/** Full-screen splash/loading screen with the mascot. Calls onDone after ~1.2 s (or once `message` is typed out and `ready`). */
export function Splash({ message, onDone, minMs = 1200, ready = true, tagline = 'lär dig tala kinesiska' }: {
  message?: string
  onDone?: () => void
  /** Minimum time on screen. Default 1200 ms (reduced motion: 600 ms). */
  minMs?: number
  /** Keep showing (with shimmer) until true, for real loading work. Default true. */
  ready?: boolean
  tagline?: string
}) {
  const reduced = useReducedMotion()
  const [typed, setTyped] = useState(0)
  const [minPassed, setMinPassed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })
  const msgLen = message?.length ?? 0
  const typedAll = reduced || typed >= msgLen

  useEffect(() => {
    const t = setTimeout(() => setMinPassed(true), reduced ? Math.min(minMs, 600) : minMs)
    return () => clearTimeout(t)
  }, [minMs, reduced])

  useEffect(() => {
    setTyped(0)
    if (!msgLen || reduced) return
    let n = 0
    const iv = setInterval(() => {
      n++
      setTyped(n)
      if (n >= msgLen) clearInterval(iv)
    }, 32)
    return () => clearInterval(iv)
  }, [message, msgLen, reduced])

  useEffect(() => {
    if (leaving || !minPassed || !typedAll || !ready) return
    // let a typed message breathe a moment, then fade out
    const t = setTimeout(() => setLeaving(true), msgLen && !reduced ? 350 : 0)
    return () => clearTimeout(t)
  }, [leaving, minPassed, typedAll, ready, msgLen, reduced])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => onDoneRef.current?.(), reduced ? 120 : 320)
    return () => clearTimeout(t)
  }, [leaving, reduced])

  return (
    <div className={`mo-splash ${leaving ? 'mo-splash-out' : ''} ${reduced ? 'mo-still' : ''}`} role="status" aria-live="polite" aria-busy={!leaving}>
      <div className="mo-splash-glow" aria-hidden="true" />
      <div className="mo-splash-bokeh" aria-hidden="true">
        {[1, 2, 3, 4, 5, 1, 3].map((tone, i) => <span key={i} style={{ '--i': i, background: `var(--color-tone-${tone})` } as CSSProperties} />)}
      </div>
      <div className="mo-splash-inner">
        <div className="mo-splash-panda">
          <div className="float"><Panda mood="wave" size={128} /></div>
        </div>
        <h1 className="mo-wordmark" aria-label="Nǐ hǎo">
          <span aria-hidden="true" className="mo-wordmark-row">
            <span className="mo-letter" style={{ '--i': 0 } as CSSProperties}>N</span>
            <span className="mo-letter mo-toned" style={{ '--i': 1 } as CSSProperties}>ı<Caron i={0} /></span>
            <span className="mo-letter mo-gap" style={{ '--i': 2 } as CSSProperties}> </span>
            <span className="mo-letter" style={{ '--i': 3 } as CSSProperties}>h</span>
            <span className="mo-letter mo-toned" style={{ '--i': 4 } as CSSProperties}>a<Caron i={1} /></span>
            <span className="mo-letter" style={{ '--i': 5 } as CSSProperties}>o</span>
          </span>
        </h1>
        <p className="mo-splash-tag">{tagline}</p>
        <p className="mo-splash-msg" aria-live="polite">
          {message ? <>{reduced ? message : message.slice(0, typed)}{!typedAll && <span className="mo-caret" aria-hidden="true" />}</> : ' '}
        </p>
        <div className="mo-splash-bar" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}

/** Third-tone mark (ˇ) drawn as SVG so it can pop in and "dip" like the tone contour. */
function Caron({ i }: { i: number }) {
  return (
    <span className="mo-caron" style={{ '--c': i } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 20 12" width="100%" height="100%">
        <path d="M3 2 L10 9.5 L17 2" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

// ─── CelebrationOverlay ──────────────────────────────────────

/** Big full-screen celebration moment (level up, streak, lesson done). Focus-managed, Escape/tap/button to close. */
export function CelebrationOverlay({ open, title, subtitle, mood = 'cheer', onClose, children, confetti = 'confetti', closeLabel = 'Fortsätt', tapToClose = true }: {
  open: boolean
  title: string
  subtitle?: string
  mood?: 'cheer' | 'proud'
  onClose: () => void
  children?: ReactNode
  /** Particle effect fired on open, or false for none. Default 'confetti'. */
  confetti?: CelebrateKind | false
  closeLabel?: string
  /** Tap anywhere outside `children` to continue. Default true. */
  tapToClose?: boolean
}) {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const openedAt = useRef(0)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  const id = useId()

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, reduced ? 10 : 220)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // on open: confetti, haptic, focus; on close: restore focus
  useEffect(() => {
    if (!open) return
    openedAt.current = Date.now()
    const prev = document.activeElement as HTMLElement | null
    const t = setTimeout(() => { if (confetti) celebrate(confetti) }, reduced ? 0 : 160)
    haptic('success')
    const f = requestAnimationFrame(() => btnRef.current?.focus({ preventScroll: true }))
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(f)
      if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus({ preventScroll: true })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape + focus trap
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current() }
      if (e.key === 'Tab' && rootRef.current) {
        const els = Array.from(rootRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'))
        if (!els.length) return
        const firstEl = els[0], lastEl = els[els.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
        else if (!rootRef.current.contains(document.activeElement)) { e.preventDefault(); firstEl.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!(open || mounted) || typeof document === 'undefined') return null

  const onBackdrop = () => {
    // ignore the tap that opened it / accidental double taps
    if (tapToClose && Date.now() - openedAt.current > 700) onCloseRef.current()
  }

  return createPortal(
    <div
      ref={rootRef}
      className={`mo-celebrate ${closing ? 'mo-celebrate-out' : ''} ${reduced ? 'mo-still' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-t`}
      aria-describedby={subtitle ? `${id}-s` : undefined}
      onClick={onBackdrop}
    >
      <div className="mo-celebrate-rays" aria-hidden="true" />
      <div className="mo-celebrate-glow" aria-hidden="true" />
      <div className="mo-celebrate-body">
        <div className="mo-celebrate-panda"><div className="float"><Panda mood={mood} size={156} /></div></div>
        <h2 id={`${id}-t`} className="mo-celebrate-title">{title}</h2>
        {subtitle && <p id={`${id}-s`} className="mo-celebrate-sub">{subtitle}</p>}
        {children && <div className="mo-celebrate-extra stagger-children" onClick={(e) => e.stopPropagation()}>{children}</div>}
        <button ref={btnRef} type="button" className="mo-celebrate-btn press" onClick={(e) => { e.stopPropagation(); haptic('light'); onCloseRef.current() }}>
          {closeLabel}
        </button>
        {tapToClose && <p className="mo-celebrate-hint" aria-hidden="true">Tryck var som helst för att fortsätta</p>}
      </div>
    </div>,
    document.body,
  )
}

// ─── Skeleton ────────────────────────────────────────────────

/** Shimmer placeholder while something loads. `lines` renders a stack of text-like bars. */
export function Skeleton({ className = '', width, height = '1rem', rounded = '0.75rem', lines }: {
  className?: string
  width?: number | string
  height?: number | string
  rounded?: number | string
  lines?: number
}) {
  if (lines && lines > 1) {
    return (
      <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="shimmer" style={{ height, borderRadius: rounded, width: i === lines - 1 ? '62%' : width ?? '100%' }} />
        ))}
      </div>
    )
  }
  return <div className={`shimmer ${className}`} aria-hidden="true" style={{ width: width ?? '100%', height, borderRadius: rounded }} />
}

// ─── Pressable ───────────────────────────────────────────────

let tapSound: (() => void) | null = null
/** Register the tap sound used by <Pressable> (e.g. `setTapSound(() => settings.soundEffects && playSfx('tap'))`). */
export function setTapSound(fn: (() => void) | null): void { tapSound = fn }

/** <button> with the tactile `.press` effect + haptic + optional tap sfx. Accepts every button prop. */
export function Pressable({ haptics = 'light', sound = true, className = '', onClick, type = 'button', ...rest }: ComponentProps<'button'> & {
  /** Haptic on tap; false for none. Default 'light'. */
  haptics?: HapticKind | false
  /** Play the registered tap sound (see setTapSound). Default true. */
  sound?: boolean
}) {
  return (
    <button
      type={type}
      {...rest}
      className={`press ${className}`}
      onClick={(e) => {
        if (!rest.disabled) {
          if (haptics) haptic(haptics)
          if (sound) try { tapSound?.() } catch { /* ignore */ }
        }
        onClick?.(e)
      }}
    />
  )
}
