// <MotivationOverlays/>: shows queued celebrations one at a time via <CelebrationOverlay>.
import { celebrate, CelebrationOverlay, haptic } from '../motion'
import { useProgress } from '../progress'
import { ACHIEVEMENT_BY_ID } from './achievements'
import { Chest, FreezeIcon, Medal, Ring } from './art'
import { useMotivation } from './context'
import { LEVEL_TITLES, titleForLevel } from './levels'
import { CHEST_XP } from './quests'
import type { Celebration } from './state'

const STREAK_LINES: Record<number, string> = {
  3: 'En vana börjar ta form!',
  7: 'En hel vecka – Pānpan är imponerad!',
  14: 'Två veckor i sträck. Du är på riktigt!',
  30: 'En hel månad! Det här är äkta disciplin.',
  50: 'Femtio dagar. Legendariskt!',
  100: 'Hundra dagar! 一百天 – yī bǎi tiān!',
}

/**
 * Global overlay host. Place once near the root (inside MotivationProvider).
 * `paused`: hold celebrations (e.g. while a lesson's own result screen is showing);
 * queued items appear as soon as it becomes false.
 */
export function MotivationOverlays({ paused = false }: { paused?: boolean }) {
  const m = useMotivation()
  const { state } = useProgress()
  const head: Celebration | undefined = paused ? undefined : m.queue[0]

  // Batch: 3+ achievements in a row are shown together (e.g. after the placement test).
  let batch = 1
  if (head?.kind === 'achievement') {
    while (batch < m.queue.length && m.queue[batch].kind === 'achievement') batch++
    if (batch < 3) batch = 1
  }

  const key = head ? `${m.queue.length}:${JSON.stringify(head)}` : ''
  // CelebrationOverlay fires confetti + haptic itself on open; `key` remounts it per item.
  const fx = (k: Celebration) => (k.kind === 'level' || (k.kind === 'streak' && k.days >= 30) ? 'fireworks' : k.kind === 'chest' ? 'stars' : 'confetti') as 'fireworks' | 'stars' | 'confetti'

  if (!head) return null
  const close = () => m.dismiss(batch)

  if (head.kind === 'level') {
    const t = titleForLevel(head.level)
    const newTitle = t.from === head.level
    const nextTitle = LEVEL_TITLES.find((x) => x.from > head.level)
    return (
      <CelebrationOverlay key={key} open confetti={fx(head)} title={`Nivå ${head.level}!`} mood="cheer" onClose={close}
        subtitle={newTitle ? `Ny titel: ${t.sv} ${t.emoji}` : nextTitle ? `Nästa titel, ${nextTitle.sv}, väntar på nivå ${nextTitle.from}!` : 'Du är en sann legend 👑'}>
        <div className="flex flex-col items-center gap-2">
          <Ring value={1} size={112} stroke={10} color="var(--color-sky)">
            <span className="text-5xl font-black text-sky-dark">{head.level}</span>
          </Ring>
          {newTitle && <p className="font-bold text-ink-muted">{t.pinyin}{state.settings.showHanzi ? ` · ${t.hanzi}` : ''}</p>}
        </div>
      </CelebrationOverlay>
    )
  }

  if (head.kind === 'achievement') {
    const items = m.queue.slice(0, batch).flatMap((c) => (c.kind === 'achievement' && ACHIEVEMENT_BY_ID[c.id] ? [ACHIEVEMENT_BY_ID[c.id]] : []))
    if (items.length === 0) { window.setTimeout(close, 0); return null } // unknown id (unreachable)
    if (items.length > 1) {
      return (
        <CelebrationOverlay key={key} open confetti={fx(head)} title={`${items.length} nya utmärkelser!`} subtitle="Du har varit flitig 🌟" mood="proud" onClose={close}>
          <div className="flex max-w-xs flex-wrap justify-center gap-2">
            {items.slice(0, 8).map((a, i) => <Medal key={a.id} tier={a.tier} emoji={a.emoji} size={56} seed={i} />)}
          </div>
        </CelebrationOverlay>
      )
    }
    const a = items[0]
    return (
      <CelebrationOverlay key={key} open confetti={fx(head)} title={a.title} subtitle={`Ny utmärkelse! ${a.desc}`} mood="proud" onClose={close}>
        <div className="animate-pop"><Medal tier={a.tier} emoji={a.emoji} size={120} /></div>
      </CelebrationOverlay>
    )
  }

  if (head.kind === 'streak') {
    const earnedFreeze = head.days % 7 === 0 && m.streak.freezes > 0
    return (
      <CelebrationOverlay key={key} open confetti={fx(head)} title={`${head.days} dagar i rad! 🔥`} subtitle={STREAK_LINES[head.days] ?? 'Din låga brinner starkt!'} mood="cheer" onClose={close}>
        <div className="flex flex-col items-center gap-2">
          {head.badgeId && ACHIEVEMENT_BY_ID[head.badgeId] && (
            <Medal tier={ACHIEVEMENT_BY_ID[head.badgeId].tier} emoji={ACHIEVEMENT_BY_ID[head.badgeId].emoji} size={96} />
          )}
          {earnedFreeze && (
            <p className="flex items-center gap-2 rounded-2xl bg-sky-soft px-3 py-2 text-sm font-extrabold text-sky-dark">
              <FreezeIcon size={24} /> Du har {m.streak.freezes} streakskydd i lager
            </p>
          )}
        </div>
      </CelebrationOverlay>
    )
  }

  // chest
  const claim = () => {
    // claimChest() also removes the chest from the queue; only dismiss if it failed.
    if (m.claimChest()) { haptic('success'); celebrate('burst') } else close()
  }
  return (
    <CelebrationOverlay key={key} open confetti={fx(head)} title="Dagens kista!" subtitle="Alla tre uppdrag klara – snyggt jobbat!" mood="cheer" onClose={close}>
      <div className="flex flex-col items-center gap-3">
        <div className="animate-wiggle"><Chest state="ready" size={110} /></div>
        {m.chestReady && (
          <button type="button" onClick={claim}
            className="rounded-2xl border-2 border-b-4 border-gold-dark bg-gold px-6 py-3 text-[15px] font-extrabold tracking-wide text-ink uppercase active:translate-y-0.5 active:border-b-2">
            Öppna · +{CHEST_XP} XP
          </button>
        )}
      </div>
    </CelebrationOverlay>
  )
}
