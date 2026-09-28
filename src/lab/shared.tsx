// OWNER: Speech/Lab agent. Shared lab UI: full-screen shell, session bookkeeping, summary screen.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ItemResult } from '../types'
import { useProgress } from '../progress'
import { playSfx } from '../speech'
import { celebrate, CountUp, haptic } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'

export function CloseIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/** Full-screen layer used by every lab mode. */
export function LabScreen({ title, emoji, progress, onClose, children, footer }: {
  title: string
  emoji: string
  /** 0–1, shows a progress bar */
  progress?: number
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-surface-2/70" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface px-safe sm:border-x-2 sm:border-line">
        <header className="sticky top-0 z-10 bg-surface/95 pt-safe backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={onClose} aria-label="Stäng"
              className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink active:scale-95">
              <CloseIcon />
            </button>
            {progress !== undefined ? (
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div className="relative h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${Math.max(4, progress * 100)}%` }}>
                  <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
                </div>
              </div>
            ) : (
              <h1 className="flex-1 truncate text-lg font-black">{emoji} {title}</h1>
            )}
          </div>
        </header>
        <main className="flex flex-1 flex-col px-4 pb-4">{children}</main>
        {footer && <footer className="sticky bottom-0 border-t-2 border-line bg-surface/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">{footer}</footer>}
      </div>
    </div>
  )
}

/** Collects item results and reports the session to progress (XP, quests, SRS). */
export function useLabSession() {
  const { finishSession } = useProgress()
  const started = useRef(Date.now())
  const results = useRef<{ key: string; item?: ItemResult['item']; correct: boolean }[]>([])
  const done = useRef(false)

  const record = useCallback((key: string, item: ItemResult['item'] | undefined, correct: boolean) => {
    if (results.current.some((r) => r.key === key)) return // first attempt counts
    results.current.push({ key, item, correct })
  }, [])

  /** Calls finishSession once; returns xp earned and stats. */
  const finish = useCallback((opts?: { passive?: boolean }) => {
    const all = results.current
    const correct = all.filter((r) => r.correct).length
    const durationMs = Date.now() - started.current
    if (done.current) return { xp: 0, correct, total: all.length, durationMs }
    done.current = true
    const items: ItemResult[] = opts?.passive ? [] : all.filter((r) => r.item).map((r) => ({ item: r.item!, correct: r.correct }))
    const total = opts?.passive ? 0 : all.length
    const { xpEarned } = finishSession({
      lessonId: null, source: 'lab', total, correct: opts?.passive ? 0 : correct, mistakes: total - (opts?.passive ? 0 : correct), durationMs, items,
    })
    return { xp: xpEarned, correct, total: all.length, durationMs }
  }, [finishSession])

  const count = useCallback(() => results.current.length, [])
  return { record, finish, count }
}

export function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  return m ? `${m} min ${s % 60 ? `${s % 60} s` : ''}`.trim() : `${s} s`
}

/** End-of-session screen with Pānpan, stats and confetti. */
export function LabSummary({ title, subtitle, stats, onClose, onAgain }: {
  title: string
  subtitle?: string
  stats: { xp: number; correct: number; total: number; durationMs: number; passive?: boolean }
  onClose: () => void
  onAgain?: () => void
}) {
  const [shown, setShown] = useState(false)
  const ratio = stats.total ? stats.correct / stats.total : 1
  useEffect(() => {
    const t = setTimeout(() => {
      setShown(true)
      playSfx('complete')
      haptic('success')
      celebrate(ratio >= 0.8 ? 'fireworks' : 'confetti')
    }, 150)
    return () => clearTimeout(t)
  }, [ratio])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-6 text-center">
      <div className={shown ? 'animate-pop' : 'opacity-0'}>
        <Panda mood={ratio >= 0.8 ? 'cheer' : 'proud'} size={140} />
      </div>
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        {subtitle && <p className="mt-1 font-semibold text-ink-muted">{subtitle}</p>}
      </div>
      <div className="grid w-full grid-cols-3 gap-3">
        <Stat label="XP" color="text-gold-dark" border="border-gold" bg="bg-gold"><CountUp value={stats.xp} /></Stat>
        {stats.passive
          ? <Stat label="Hört" color="text-sky-dark" border="border-sky" bg="bg-sky"><CountUp value={stats.total} /></Stat>
          : <Stat label="Rätt" color="text-brand-dark" border="border-brand" bg="bg-brand"><CountUp value={stats.correct} />/{stats.total}</Stat>}
        <Stat label="Tid" color="text-flame" border="border-flame" bg="bg-flame">{formatDuration(stats.durationMs)}</Stat>
      </div>
      <div className="mt-2 flex w-full flex-col gap-3">
        <Button onClick={onClose} className="w-full">Klart</Button>
        {onAgain && <Button variant="secondary" onClick={onAgain} className="w-full">Kör igen</Button>}
      </div>
    </div>
  )
}

function Stat({ label, color, border, bg, children }: { label: string; color: string; border: string; bg: string; children: ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-2xl border-2 ${border}`}>
      <div className={`py-1 text-xs font-black uppercase tracking-wide text-white ${bg}`}>{label}</div>
      <div className={`px-1 py-3 text-lg font-black ${color}`}>{children}</div>
    </div>
  )
}

/** Small pill showing which voice spoke. */
export function VoiceChip({ name }: { name: string | null }) {
  if (!name) return null
  const short = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/Microsoft |Google |Online|Natural|- Chinese.*$/gi, '').trim()
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-soft px-2.5 py-0.5 text-xs font-bold text-sky-dark">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true"><circle cx="8" cy="5" r="3" fill="currentColor" /><path d="M2.5 14a5.5 5.5 0 0 1 11 0" fill="currentColor" /></svg>
      {short || name}
    </span>
  )
}

export function MicIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function StopIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" /></svg>
}

/** Big round record button. */
export function RecordButton({ recording, starting, onClick, disabled, label }: { recording: boolean; starting?: boolean; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={recording ? 'Sluta spela in' : (label ?? 'Spela in')} aria-pressed={recording}
      className={`relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-b-4 text-white select-none transition-transform duration-100 press active:translate-y-0.5 active:border-b-2 disabled:opacity-40
        ${recording ? 'scale-105 border-red-800 bg-danger' : 'border-red-700 bg-tone-1'} ${starting ? 'animate-pulse' : ''}`}>
      {recording && <span className="pointer-events-none absolute -inset-2 animate-ping rounded-full border-4 border-danger/40" />}
      {recording ? <StopIcon className="relative h-8 w-8" /> : <MicIcon className="relative h-9 w-9" />}
    </button>
  )
}

/** Round speaker button (uses the multi-voice rotation). */
export function ListenButton({ onClick, speaking, slow, label }: { onClick: () => void; speaking?: boolean; slow?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label ?? (slow ? 'Lyssna långsamt' : 'Lyssna')}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-2xl border-b-4 select-none transition-transform duration-100 press active:translate-y-0.5 active:border-b-2
        ${slow ? 'h-14 w-14 border-sky/40 bg-sky-soft text-sky-dark' : 'h-16 w-16 border-sky-dark bg-sky text-white'} ${speaking ? 'scale-105' : ''}`}>
      {speaking && <span className="pointer-events-none absolute inset-0 animate-ping rounded-2xl bg-sky/30" />}
      {slow ? (
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
          <path d="M4 15.5c0-4 3.1-7 7-7s7 3 7 7H4Z" fill="currentColor" />
          <circle cx="20" cy="13.2" r="2.2" fill="currentColor" />
          <path d="M6 15.5v2.3M15.5 15.5v2.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
          <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" fill="currentColor" />
          <path d="M16.2 9a4 4 0 0 1 0 6M18.8 6.4a7.6 7.6 0 0 1 0 11.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
