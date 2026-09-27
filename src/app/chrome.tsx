// App chrome (Shell): top bar, bottom tab bar, iOS install hint, empty state.
import { useState, type ReactNode } from 'react'
import { displayStreak, localDay, useProgress } from '../progress'
import { ProgressRing } from '../ui/ProgressRing'
import type { Tab } from './router'
import { BoltIcon, CloseIcon, FlameIcon, PathTabIcon, ProfileTabIcon, ReviewTabIcon, ShareIcon, WordsTabIcon } from './icons'
import { safeGet, safeSet } from './util'
import { isIOS, isStandalonePwa } from '../speech'

export function TopBar({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b-2 border-line bg-surface/95 pt-safe backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="min-w-0 flex-1 truncate text-xl font-black">{title}</div>
        {right}
      </div>
    </header>
  )
}

export function StreakBadge() {
  const { state } = useProgress()
  const n = displayStreak(state, localDay())
  return (
    <span className={`flex items-center gap-1 text-lg font-black ${n > 0 ? 'text-flame' : 'text-gray-300'}`} aria-label={`Streak: ${n} dagar`}>
      <FlameIcon size={26} />
      {n}
    </span>
  )
}

export function DailyGoalRing({ size = 40 }: { size?: number }) {
  const { todayXp, state } = useProgress()
  const xp = todayXp()
  const goal = state.settings.dailyGoalXp || 30
  const done = xp >= goal
  return (
    <span className="flex items-center gap-1.5" aria-label={`Dagens XP: ${xp} av ${goal}`}>
      <ProgressRing value={xp / goal} size={size} stroke={5} color={done ? 'var(--color-brand)' : 'var(--color-warn)'}>
        <BoltIcon size={size * 0.45} className={done ? 'text-brand' : 'text-warn'} />
      </ProgressRing>
      <span className="text-sm leading-tight font-extrabold">
        <span className={done ? 'text-brand' : 'text-ink'}>{xp}</span>
        <span className="text-ink-muted">/{goal}</span>
        <span className="block text-[10px] tracking-wide text-ink-muted uppercase">XP idag</span>
      </span>
    </span>
  )
}

const TABS: { id: Tab; label: string; Icon: typeof PathTabIcon }[] = [
  { id: 'learn', label: 'Lär dig', Icon: PathTabIcon },
  { id: 'review', label: 'Repetera', Icon: ReviewTabIcon },
  { id: 'words', label: 'Ord', Icon: WordsTabIcon },
  { id: 'profile', label: 'Profil', Icon: ProfileTabIcon },
]

export function TabBar({ tab, onTab, reviewBadge }: { tab: Tab; onTab: (t: Tab) => void; reviewBadge?: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t-2 border-line bg-surface pb-safe px-safe" aria-label="Huvudmeny">
      <ul className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-2xl border-2 py-1.5 text-[11px] font-extrabold tracking-wide uppercase transition-colors ${active ? 'border-sky/40 bg-sky-soft text-sky-dark' : 'border-transparent text-gray-400 active:bg-surface-2'}`}
              >
                <Icon size={26} />
                {label}
                {!!reviewBadge && id === 'review' && (
                  <span className="absolute top-0.5 right-[calc(50%-24px)] grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-danger px-1 text-[10px] text-white">
                    {reviewBadge > 99 ? '99+' : reviewBadge}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const HINT_KEY = 'nihao/install-hint-dismissed'
function isIosSafariBrowser(): boolean {
  return isIOS && !isStandalonePwa()
}

/** iOS Safari (not installed): dismissible "add to home screen" hint. */
export function InstallHint() {
  const [show, setShow] = useState(() => isIosSafariBrowser() && safeGet(HINT_KEY) !== '1')
  if (!show) return null
  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border-2 border-sky/30 bg-sky-soft p-3 text-sm text-sky-dark">
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

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-6xl">{emoji}</div>
      <h2 className="text-xl font-black">{title}</h2>
      {children && <div className="mt-2 text-ink-muted">{children}</div>}
    </div>
  )
}
