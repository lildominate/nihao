// UI: LevelBadge, DailyQuestsCard, AchievementsSection, WeeklyRecapCard, StreakFreezeInfo.
import { useState } from 'react'
import { useProgress } from '../progress'
import { celebrate, CountUp, haptic } from '../motion'
import { Card } from '../ui/Card'
import { Sheet } from '../ui/Sheet'
import type { AchievementView } from './achievements'
import { Bar, Chest, FreezeIcon, Medal, Ring, TIER_LABEL } from './art'
import { useMotivation } from './context'
import { LEVEL_TITLES } from './levels'
import { CHEST_XP } from './quests'
import { MAX_FREEZES } from './streak'

const fmt = (n: number) => n.toLocaleString('sv-SE')
const WEEKDAYS = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
const WEEKDAYS_LONG = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']
function dowIndex(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return (new Date(y, m - 1, d, 12).getDay() + 6) % 7
}
function prettyDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Level ───────────────────────────────────────────────────

/** Small level chip (ring + "Nivå 4") for the top bar. Tap opens level details. */
export function LevelBadge({ compact = false }: { compact?: boolean }) {
  const { level } = useMotivation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-0.5 active:bg-surface-2"
        aria-label={`Nivå ${level.level}, ${level.title.sv}. ${level.isMax ? 'Maxnivå' : `${level.xpToNext} XP till nästa nivå`}`}>
        <Ring value={level.progress} size={36} stroke={4} color="var(--color-sky)">
          <span className="text-[15px] font-black text-sky-dark">{level.level}</span>
        </Ring>
        {!compact && (
          <span className="text-left text-sm leading-tight font-extrabold">
            <span className="block">Nivå {level.level}</span>
            <span className="block text-[10px] tracking-wide text-ink-muted uppercase">{level.isMax ? 'Max' : `${level.xpToNext} XP kvar`}</span>
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="level-sheet-title">
        <LevelDetails />
      </Sheet>
    </>
  )
}

function LevelDetails() {
  const { level, bonusXp } = useMotivation()
  const { state } = useProgress()
  const t = level.title
  return (
    <div className="max-h-[75dvh] overflow-y-auto">
      <div className="flex items-center gap-4">
        <Ring value={level.progress} size={84} stroke={8} color="var(--color-sky)">
          <span className="text-3xl font-black text-sky-dark">{level.level}</span>
        </Ring>
        <div className="min-w-0">
          <h2 id="level-sheet-title" className="text-2xl font-black">{t.emoji} {t.sv}</h2>
          <p className="font-bold text-ink-muted">{t.pinyin}{state.settings.showHanzi ? ` · ${t.hanzi}` : ''}</p>
          <p className="mt-1 text-sm font-bold">
            {level.isMax ? 'Högsta nivån – legendariskt! 👑' : <>{fmt(level.xpToNext)} XP till nivå {level.level + 1}</>}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-muted">
        Totalt {fmt(level.xp)} XP{bonusXp > 0 && <> (varav {fmt(bonusXp)} från dagskistor)</>}.
      </p>
      <h3 className="mt-4 mb-2 text-xs font-black tracking-wide text-ink-muted uppercase">Titlar</h3>
      <ul className="space-y-1.5">
        {LEVEL_TITLES.map((x) => {
          const reached = level.level >= x.from
          const current = x === t
          return (
            <li key={x.from} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${current ? 'border-sky/50 bg-sky-soft' : 'border-line'} ${reached ? '' : 'opacity-50'}`}>
              <span className="text-2xl" aria-hidden="true">{reached ? x.emoji : '🔒'}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{x.sv}</span>
                <span className="block text-xs text-ink-muted">{x.pinyin}</span>
              </span>
              <span className="text-xs font-black text-ink-muted">Nivå {x.from}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Daily quests ────────────────────────────────────────────

/** Home-screen card: today's 3 quests + bonus chest. */
export function DailyQuestsCard() {
  const m = useMotivation()
  const [justOpened, setJustOpened] = useState(false)
  const open = () => {
    if (m.claimChest()) {
      setJustOpened(true)
      haptic('success')
      celebrate('burst')
    }
  }
  const chestState = m.chestClaimed ? 'open' : m.chestReady ? 'ready' : 'locked'
  return (
    <Card className="relative">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">Dagens uppdrag</h2>
          <p className="text-xs font-bold text-ink-muted">
            {m.chestClaimed ? 'Kistan är öppnad – nya uppdrag i morgon!' : m.chestReady ? 'Allt klart – öppna kistan!' : `${m.questsDone}/3 klara · kistan väntar`}
          </p>
        </div>
        <button type="button" onClick={open} disabled={!m.chestReady}
          className={`-my-1 shrink-0 ${m.chestReady ? 'animate-wiggle' : ''} ${justOpened ? 'animate-pop' : ''}`}
          aria-label={m.chestReady ? `Öppna kistan, ${CHEST_XP} bonus-XP` : m.chestClaimed ? 'Kistan är öppnad' : 'Kistan öppnas när alla uppdrag är klara'}>
          <Chest state={chestState} size={52} />
        </button>
      </div>
      <ul className="space-y-3">
        {m.quests.map((q) => (
          <li key={q.id} className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border-2 text-xl ${q.done ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2'}`} aria-hidden="true">
              {q.done ? <Check /> : q.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-[15px] font-extrabold ${q.done ? 'text-ink-muted line-through decoration-2' : ''}`}>{q.title}</span>
                <span className="shrink-0 text-xs font-black text-ink-muted">{q.value}/{q.target}</span>
              </div>
              <Bar value={q.ratio} color={q.done ? 'bg-brand' : 'bg-warn'} className="mt-1" />
            </div>
          </li>
        ))}
      </ul>
      {m.chestReady && (
        <button type="button" onClick={open}
          className="mt-4 w-full rounded-2xl border-2 border-b-4 border-gold-dark bg-gold px-4 py-3 text-[15px] font-extrabold tracking-wide text-ink uppercase active:translate-y-0.5 active:border-b-2">
          Öppna kistan · +{CHEST_XP} XP
        </button>
      )}
      {justOpened && (
        <p className="mt-3 animate-pop text-center text-sm font-black text-gold-dark" role="status">+{CHEST_XP} bonus-XP! 🎉</p>
      )}
    </Card>
  )
}

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 L10 17 L19 7" fill="none" stroke="var(--color-brand)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Streak freeze ───────────────────────────────────────────

/** Small card explaining "Streakskydd" with the current stock. */
export function StreakFreezeInfo() {
  const { streak } = useMotivation()
  const lastFrozen = streak.frozenDays[streak.frozenDays.length - 1]
  return (
    <Card className="flex items-center gap-3">
      <div className="flex shrink-0 gap-0.5">
        {Array.from({ length: MAX_FREEZES }, (_, i) => <FreezeIcon key={i} size={30} dim={i >= streak.freezes} />)}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-extrabold">Streakskydd: {streak.freezes}/{MAX_FREEZES}</p>
        <p className="text-ink-muted">
          {streak.daysToNextFreeze === null
            ? 'Fullt lager! Missar du en dag skyddas din streak automatiskt.'
            : `Öva ${streak.daysToNextFreeze} ${streak.daysToNextFreeze === 1 ? 'dag' : 'dagar'} till i rad för att tjäna ett skydd.`}
          {lastFrozen && ` Senast använt ${prettyDate(lastFrozen)}.`}
        </p>
      </div>
    </Card>
  )
}

// ─── Achievements ────────────────────────────────────────────

/** Profile section: level card, streak freezes and the medal grid with a detail sheet. */
export function AchievementsSection() {
  const m = useMotivation()
  const [sel, setSel] = useState<AchievementView | null>(null)
  const sorted = [...m.achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.ratio - a.ratio)
  return (
    <section className="space-y-3">
      <LevelCard />
      <StreakFreezeInfo />
      <div className="flex items-baseline justify-between pt-2">
        <h2 className="text-sm font-black tracking-wide text-ink-muted uppercase">Utmärkelser</h2>
        <span className="text-sm font-black text-ink-muted">{m.unlockedCount}/{m.achievements.length}</span>
      </div>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
        {sorted.map((a, i) => (
          <li key={a.id}>
            <button type="button" onClick={() => setSel(a)} className="flex w-full flex-col items-center gap-1 rounded-2xl p-1 active:bg-surface-2"
              aria-label={`${a.title}${a.unlocked ? ', upplåst' : `, låst, ${a.value} av ${a.target}`}`}>
              <Medal tier={a.tier} emoji={a.emoji} locked={!a.unlocked} size={54} seed={i} />
              <span className={`line-clamp-2 text-center text-[11px] leading-tight font-extrabold ${a.unlocked ? '' : 'text-ink-muted'}`}>{a.title}</span>
              {!a.unlocked && a.ratio > 0 && <Bar value={a.ratio} color="bg-sky" className="h-1.5 w-10" />}
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!sel} onClose={() => setSel(null)} labelledBy="ach-sheet-title">
        {sel && <AchievementDetail a={sel} />}
      </Sheet>
    </section>
  )
}

function AchievementDetail({ a }: { a: AchievementView }) {
  return (
    <div className="flex flex-col items-center pb-2 text-center">
      <div className={a.unlocked ? 'animate-pop' : ''}><Medal tier={a.tier} emoji={a.emoji} locked={!a.unlocked} size={110} /></div>
      <span className={`mt-2 rounded-full px-2.5 py-0.5 text-xs font-black tracking-wide uppercase ${a.tier === 'gold' ? 'bg-gold/30 text-gold-dark' : a.tier === 'silver' ? 'bg-surface-2 text-ink-muted' : 'bg-orange-100 text-orange-800'}`}>{TIER_LABEL[a.tier]}</span>
      <h2 id="ach-sheet-title" className="mt-2 text-2xl font-black">{a.title}</h2>
      <p className="mt-1 text-ink-muted">{a.desc}</p>
      {a.unlocked ? (
        <p className="mt-4 font-extrabold text-brand">Upplåst {a.unlockedAt ? prettyDate(a.unlockedAt) : ''} 🎉</p>
      ) : (
        <div className="mt-4 w-full max-w-xs">
          <Bar value={a.ratio} color="bg-sky" />
          <p className="mt-1.5 text-sm font-bold text-ink-muted">{fmt(a.value)} / {fmt(a.target)} – {a.ratio >= 0.5 ? 'nästan där!' : 'du är på väg!'}</p>
        </div>
      )}
    </div>
  )
}

function LevelCard() {
  const { level } = useMotivation()
  return (
    <Card className="flex items-center gap-4">
      <Ring value={level.progress} size={64} stroke={7} color="var(--color-sky)">
        <span className="text-2xl font-black text-sky-dark">{level.level}</span>
      </Ring>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black tracking-wide text-ink-muted uppercase">Nivå {level.level}</p>
        <p className="truncate text-lg font-black">{level.title.emoji} {level.title.sv}</p>
        <Bar value={level.progress} color="bg-sky" className="mt-1" />
        <p className="mt-1 text-xs font-bold text-ink-muted">
          {level.isMax ? `${fmt(level.xp)} XP – maxnivå!` : `${fmt(level.xp - level.levelStartXp)} / ${fmt((level.nextLevelXp ?? 0) - level.levelStartXp)} XP`}
        </p>
      </div>
    </Card>
  )
}

// ─── Weekly recap ────────────────────────────────────────────

/** "Veckan hittills": XP vs last week, words learned, best day. */
export function WeeklyRecapCard() {
  const { recap, today } = useMotivation()
  const max = Math.max(1, ...recap.days.map((d) => d.xp))
  const diff = recap.thisWeekXp - recap.lastWeekXp
  const pct = recap.lastWeekXp > 0 ? Math.round((diff / recap.lastWeekXp) * 100) : null
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">Veckan hittills</h2>
          <p className="text-xs font-bold text-ink-muted">
            {recap.lastWeekXp === 0 ? 'Din första vecka – snyggt!' : diff > 0 ? `${pct !== null ? `+${pct} %` : 'Mer'} jämfört med förra veckan 🚀` : `Förra veckan: ${fmt(recap.lastWeekXp)} XP`}
          </p>
        </div>
        <div className="text-right">
          <CountUp value={recap.thisWeekXp} className="text-2xl font-black text-warn" />
          <span className="block text-[10px] font-black tracking-wide text-ink-muted uppercase">XP</span>
        </div>
      </div>
      <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden="true">
        {recap.days.map((d, i) => {
          const best = recap.bestDay?.day === d.day
          const future = d.day > today
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div className={`w-full rounded-lg ${best ? 'bg-gold' : d.xp > 0 ? 'bg-warn/70' : 'bg-line'}`}
                  style={{ height: d.xp > 0 ? `${Math.max(10, (d.xp / max) * 100)}%` : '6px', opacity: future ? 0.4 : 1 }} />
              </div>
              <span className={`text-[10px] font-black uppercase ${d.day === today ? 'text-ink' : 'text-ink-muted'}`}>{WEEKDAYS[i]}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={recap.wordsThisWeek} label="nya ord" />
        <Stat value={recap.activeDays} label={recap.activeDays === 1 ? 'aktiv dag' : 'aktiva dagar'} />
        <Stat value={recap.bestDay ? WEEKDAYS_LONG[dowIndex(recap.bestDay.day)] : '–'} label="bästa dag" />
      </div>
    </Card>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-1 py-2">
      <div className="truncate text-base font-black">{typeof value === 'number' ? fmt(value) : value}</div>
      <div className="text-[10px] font-bold tracking-wide text-ink-muted uppercase">{label}</div>
    </div>
  )
}
