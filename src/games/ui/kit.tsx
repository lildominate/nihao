// OWNER: Games agent. Shared game chrome: full-screen frame, pause sheet, particles, helpers.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LessonResult, Word } from '../../types'
import { useProgress } from '../../progress'
import { useReducedMotion } from '../../motion'
import { playSfx } from '../../speech'

// ─── Types shared by all games ───────────────────────────────

export interface Practised { key: string; hanzi: string; pinyin: string; sv: string; correct: boolean }

export interface GameOutcome {
  score: number
  result: LessonResult
  stats: { label: string; value: string }[]
  practised: Practised[]
  /** Heading for the practised list (default "Övade ord"). */
  practisedLabel?: string
  /** Short line under the score, e.g. "Nivå 4 nådd!" */
  headline?: string
}

export interface GameProps {
  words: Word[]
  /** Distractor reserve (whole course) — never scored. */
  extra: Word[]
  mode: string
  reduced: boolean
  toneColors: boolean
  onEnd(outcome: GameOutcome): void
  onExit(partial: LessonResult | null): void
}

export function practisedWords(result: LessonResult, byId: Map<string, Word>): Practised[] {
  return result.items.flatMap((it) => {
    const w = byId.get(it.item.id)
    return w && it.item.kind === 'word' ? [{ key: w.id, hanzi: w.hanzi, pinyin: w.pinyin, sv: w.sv, correct: it.correct }] : []
  })
}

// ─── Reduced motion (OS + app setting + motion module) ───────

export function useGamesReducedMotion(): boolean {
  const fromMotion = useReducedMotion()
  const setting = useProgress().state.settings.reduceMotion === true
  const [os, setOs] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setOs(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return fromMotion || setting || os
}

// ─── Particles (imperative DOM + WAAPI; transform/opacity only) ──

const BURST_COLORS = ['#facc15', '#16a34a', '#0ea5e9', '#f97316', '#e11d48', '#9333ea']

/** Pop particles at (x, y) relative to `layer` (a positioned, pointer-events-none element). */
export function burst(layer: HTMLElement | null, x: number, y: number, opts: { reduced?: boolean; count?: number; colors?: string[] } = {}) {
  if (!layer) return
  const n = opts.reduced ? 0 : (opts.count ?? 14)
  const colors = opts.colors ?? BURST_COLORS
  // A soft ring always (also with reduced motion it's a short fade, no travel).
  const ring = document.createElement('span')
  ring.style.cssText = `position:absolute;left:${x - 28}px;top:${y - 28}px;width:56px;height:56px;border-radius:999px;border:4px solid ${colors[0]};pointer-events:none;will-change:transform,opacity`
  layer.appendChild(ring)
  const ra = ring.animate(
    opts.reduced ? [{ opacity: 0.8 }, { opacity: 0 }] : [{ transform: 'scale(.4)', opacity: 0.9 }, { transform: 'scale(2)', opacity: 0 }],
    { duration: opts.reduced ? 250 : 520, easing: 'ease-out' },
  )
  ra.onfinish = () => ring.remove()
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span')
    const size = 6 + Math.random() * 7
    const round = Math.random() > 0.4
    p.style.cssText = `position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${round ? '999px' : '3px'};pointer-events:none;will-change:transform,opacity`
    layer.appendChild(p)
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5
    const dist = 50 + Math.random() * 60
    const dx = Math.cos(ang) * dist
    const dy = Math.sin(ang) * dist - 20
    const a = p.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy + 40}px) scale(.3) rotate(${Math.random() * 360}deg)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 240, easing: 'cubic-bezier(.2,.7,.4,1)' },
    )
    a.onfinish = () => p.remove()
  }
}

/** Floating "+20" text at (x, y) inside `layer`. */
export function floatText(layer: HTMLElement | null, x: number, y: number, text: string, color = '#16a34a') {
  if (!layer) return
  const el = document.createElement('span')
  el.textContent = text
  el.className = 'g-float'
  el.style.cssText = `position:absolute;left:${x}px;top:${y - 20}px;font-weight:900;font-size:22px;color:${color};text-shadow:0 2px 0 rgba(0,0,0,.12);pointer-events:none;white-space:nowrap`
  layer.appendChild(el)
  setTimeout(() => el.remove(), 850)
}

/** Center of an element relative to `layer`. */
export function centerIn(el: Element | null, layer: HTMLElement | null): { x: number; y: number } {
  if (!el || !layer) return { x: 0, y: 0 }
  const a = el.getBoundingClientRect()
  const b = layer.getBoundingClientRect()
  return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 }
}

// ─── Pause handling ──────────────────────────────────────────

/** Paused state that also auto-pauses when the app is backgrounded. */
export function usePause(): [boolean, (p: boolean) => void] {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') setPaused(true) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return [paused, setPaused]
}

/** Pause-aware game clock: returns a ref with elapsed play-ms, advanced every frame by `onFrame`. */
export function useGameLoop(paused: boolean, onFrame: (dtMs: number) => void) {
  const cb = useRef(onFrame)
  useEffect(() => { cb.current = onFrame })
  useEffect(() => {
    if (paused) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) // clamp after jank / tab switches
      last = now
      cb.current(dt)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paused])
}

// ─── Frame ───────────────────────────────────────────────────

function IconX() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
}
function IconPause() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
}

export function GameFrame({ title, paused, setPaused, onExit, hud, children, bg = 'bg-surface', reduced }: {
  title: string
  paused: boolean
  setPaused(p: boolean): void
  onExit(): void
  hud?: ReactNode
  children: ReactNode
  bg?: string
  reduced?: boolean
}) {
  return (
    <div className={`fixed inset-0 z-50 flex justify-center ${bg} text-ink ${reduced ? 'g-reduced' : ''}`}>
      <div className="g-noselect relative flex h-full w-full max-w-md flex-col px-safe pt-safe pb-safe">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <button type="button" aria-label="Pausa" onClick={() => { playSfx('tap'); setPaused(true) }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black/5 text-ink-muted active:scale-95">
            <IconPause />
          </button>
          <div className="min-w-0 flex-1">{hud ?? <div className="truncate text-center text-lg font-black">{title}</div>}</div>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
        {paused && (
          <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/45 animate-fade" role="dialog" aria-modal="true" aria-label="Paus">
            <div className="w-full rounded-t-3xl bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet">
              <div className="mb-1 text-center text-2xl font-black">Paus</div>
              <div className="mb-5 text-center text-ink-muted">{title} väntar på dig.</div>
              <button type="button" onClick={() => { playSfx('tap'); setPaused(false) }}
                className="mb-3 w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
                Fortsätt spela
              </button>
              <button type="button" onClick={onExit}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-line bg-surface py-3.5 font-extrabold text-ink-muted active:translate-y-0.5 active:border-b-2">
                <IconX /> Avsluta spelet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Row of hearts-free "miss" markers (drops). */
export function MissMeter({ misses, max }: { misses: number; max: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${max - misses} försök kvar`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 20 24" className={`h-6 w-5 transition-transform ${i < max - misses ? '' : 'scale-75 opacity-25'}`}>
          <path d="M10 2C10 2 3 11 3 15.5a7 7 0 0 0 14 0C17 11 10 2 10 2Z" fill={i < max - misses ? '#0ea5e9' : '#9ca3af'} />
          <ellipse cx="7.5" cy="15" rx="1.6" ry="2.4" fill="#fff" opacity=".6" />
        </svg>
      ))}
    </div>
  )
}

/** Score pill used in HUDs. Bumps when the value changes. */
export function ScorePill({ score, label = 'Poäng' }: { score: number; label?: string }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">{label}</span>
      <span key={score} className="g-bump text-2xl font-black tabular-nums">{score}</span>
    </div>
  )
}
