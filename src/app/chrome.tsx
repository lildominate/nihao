// App chrome: top bar, bottom tab bar, streak/XP chips, iOS install hint.
import { useState, type ReactNode } from 'react'
import { useProgress } from '../progress'
import { useEffectiveStreak } from '../motivation'
import { ProgressRing } from '../ui/ProgressRing'
import type { Tab } from './router'
import { BoltIcon, CloseIcon, FlameIcon, GamesTabIcon, PathTabIcon, PracticeTabIcon, ProfileTabIcon, ShareIcon, WordsTabIcon, BackIcon } from './icons'
import { safeGet, safeSet } from './util'
import { isIOS, isStandalonePwa } from '../speech'
import { PandaFace } from '../mascot/Panda'
import { CountUp, haptic } from '../motion'
export { EmptyState } from '../ui/kit'

export function TopBar({ title, right, left, onBack }: { title?: ReactNode; right?: ReactNode; left?: ReactNode; onBack?: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 pt-safe backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-14 items-center gap-2.5 px-4">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Tillbaka" className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-ink-muted active:bg-surface-2">
            <BackIcon size={24} />
          </button>
        )}
        {left}
        <div className="min-w-0 flex-1 truncate font-display text-[22px] font-semibold">{title}</div>
        {right}
      </div>
    </header>
  )
}

/** Brand wordmark for the home top bar. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft"><PandaFace size={30} /></span>
      <span className="font-display text-[22px] font-semibold text-brand-dark dark:text-brand">Nǐ hǎo</span>
    </span>
  )
}

export function StreakBadge() {
  const { current: n, activeToday } = useEffectiveStreak()
  // grey = no streak; full colour = done today; dimmed = streak alive but today not done yet.
  const cls = n === 0 ? 'bg-surface-2 text-ink-faint' : activeToday ? 'bg-flame-soft text-flame' : 'bg-surface-2 text-flame/60'
  return (
    <span className={`flex h-9 items-center gap-1 rounded-full px-2.5 font-display text-lg font-semibold ${cls}`}
      aria-label={`Streak: ${n} dagar${n > 0 && !activeToday ? ', öva idag för att hålla den vid liv' : ''}`}>
      <span className={n > 0 && activeToday ? 'glow grid place-items-center' : 'grid place-items-center'}><FlameIcon size={22} className={n > 0 && !activeToday ? 'opacity-60' : ''} /></span>
      {n}
    </span>
  )
}

export function DailyGoalRing({ size = 34 }: { size?: number }) {
  const { todayXp, state } = useProgress()
  const xp = todayXp()
  const goal = state.settings.dailyGoalXp || 30
  const done = xp >= goal
  return (
    <span id="xp-target" data-xp-target="" className="flex items-center gap-1.5" aria-label={`Dagens XP: ${xp} av ${goal}`}>
      <ProgressRing value={xp / goal} size={size} stroke={4.5} gradient={done ? ['#34c79a', '#12a179'] : ['#ffd35c', '#f59e0b']}>
        <BoltIcon size={size * 0.46} className={done ? 'text-brand' : 'text-warn'} />
      </ProgressRing>
      <span className="font-display text-[15px] leading-none font-semibold">
        <CountUp value={xp} className={done ? 'text-brand' : 'text-ink'} /><span className="text-ink-faint">/{goal}</span>
      </span>
    </span>
  )
}

const TAB_DEFS: { id: Tab; label: string; Icon: typeof PathTabIcon; color: string }[] = [
  { id: 'learn', label: 'Lär dig', Icon: PathTabIcon, color: 'var(--color-brand)' },
  { id: 'practice', label: 'Öva', Icon: PracticeTabIcon, color: 'var(--color-sky)' },
  { id: 'games', label: 'Spel', Icon: GamesTabIcon, color: 'var(--color-lacquer)' },
  { id: 'words', label: 'Ord', Icon: WordsTabIcon, color: 'var(--color-plum)' },
  { id: 'profile', label: 'Profil', Icon: ProfileTabIcon, color: 'var(--color-gold-dark)' },
]

export function TabBar({ tab, onTab, reviewBadge }: { tab: Tab; onTab: (t: Tab) => void; reviewBadge?: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md rounded-t-[26px] border-t border-line/80 bg-surface/92 pb-safe px-safe shadow-[0_-10px_30px_-18px_rgb(60_35_15/0.35)] backdrop-blur-xl" aria-label="Huvudmeny">
      <ul className="grid grid-cols-5 px-1.5 pt-1.5 pb-1">
        {TAB_DEFS.map(({ id, label, Icon, color }) => {
          const active = tab === id
          return (
            <li key={id}>
              <button type="button" onClick={() => { if (!active) haptic('select'); onTab(id) }} aria-current={active ? 'page' : undefined}
                className="press relative flex w-full flex-col items-center gap-0.5 py-1 text-[11px] font-extrabold"
                style={{ color: active ? color : 'var(--color-ink-faint)' }}>
                <span className="relative grid h-9 w-14 place-items-center rounded-2xl transition-colors duration-200"
                  style={{ background: active ? `color-mix(in oklab, ${color} 15%, transparent)` : 'transparent' }}>
                  <Icon size={26} />
                  {!!reviewBadge && id === 'practice' && (
                    <span className="absolute -top-1 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-lacquer px-1 text-[10px] leading-none text-white">
                      {reviewBadge > 99 ? '99+' : reviewBadge}
                    </span>
                  )}
                </span>
                <span className={active ? '' : 'text-ink-muted'}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const HINT_KEY = 'nihao/install-hint-dismissed'

/** iOS Safari (not installed): dismissible "add to home screen" hint. */
export function InstallHint() {
  const [show, setShow] = useState(() => isIOS && !isStandalonePwa() && safeGet(HINT_KEY) !== '1')
  if (!show) return null
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-sky/25 bg-sky-soft p-3 text-sm text-sky-dark dark:text-sky">
      <ShareIcon size={22} className="mt-0.5 shrink-0" />
      <p className="flex-1 font-semibold">
        <b className="font-extrabold">Installera:</b> tryck på Dela-knappen → <b className="font-extrabold">Lägg till på hemskärmen</b>
      </p>
      <button type="button" aria-label="Stäng tipset" className="-m-1 p-1" onClick={() => { safeSet(HINT_KEY, '1'); setShow(false) }}>
        <CloseIcon size={18} />
      </button>
    </div>
  )
}
