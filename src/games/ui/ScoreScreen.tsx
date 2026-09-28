// OWNER: Games agent. End-of-game screen: Panda, score, record, words practised, "Spela igen".
import { useEffect } from 'react'
import { Panda } from '../../mascot/Panda'
import { celebrate, CountUp } from '../../motion'
import { PinyinText, playSfx, SpeakButton } from '../../speech'
import type { GameOutcome } from './kit'

export function ScoreScreen({ title, outcome, best, isNewRecord, xp, toneColors, reduced, onAgain, onClose }: {
  title: string
  outcome: GameOutcome
  best: number
  isNewRecord: boolean
  xp: number
  toneColors: boolean
  reduced: boolean
  onAgain(): void
  onClose(): void
}) {
  useEffect(() => {
    playSfx('complete')
    if (isNewRecord) {
      const t = window.setTimeout(() => celebrate(reduced ? 'stars' : 'fireworks'), 250)
      return () => window.clearTimeout(t)
    }
  }, [isNewRecord, reduced])

  const { practised } = outcome
  const right = practised.filter((p) => p.correct).length
  return (
    <div className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-surface text-ink ${reduced ? 'g-reduced' : ''}`}>
      <div className="flex w-full max-w-md flex-col px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center text-center">
          <div className={isNewRecord ? 'g-pop' : ''}><Panda mood={isNewRecord ? 'cheer' : outcome.score > 0 ? 'proud' : 'happy'} size={112} /></div>
          <div className="mt-1 text-sm font-extrabold uppercase tracking-widest text-ink-muted">{title}</div>
          {isNewRecord && (
            <div className="g-pop mt-2 rounded-full bg-gold px-4 py-1.5 text-base font-black text-ink shadow-[0_3px_0_var(--color-gold-dark)]">
              Nytt rekord!
            </div>
          )}
          <CountUp from={0} value={outcome.score} className="mt-2 text-6xl font-black tabular-nums" durationMs={900} />
          <div className="text-sm font-bold text-ink-muted">poäng · rekord {best}</div>
          {outcome.headline && <div className="mt-2 text-lg font-extrabold">{outcome.headline}</div>}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {outcome.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border-2 border-line p-2.5 text-center">
              <div className="text-xl font-black tabular-nums">{s.value}</div>
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink-muted">{s.label}</div>
            </div>
          ))}
        </div>
        {xp > 0 && <div className="mt-3 self-center rounded-full bg-gold/25 px-3 py-1 text-sm font-black text-gold-dark">+{xp} XP</div>}

        {practised.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-black">{outcome.practisedLabel ?? 'Övade ord'}</h3>
              <span className="text-sm font-bold text-ink-muted">{right}/{practised.length} rätt direkt</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {practised.map((p) => (
                <li key={p.key} className="flex items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2">
                  <SpeakButton hanzi={p.hanzi} size="sm" />
                  <div className="min-w-0 flex-1">
                    <PinyinText pinyin={p.pinyin} colored={toneColors} className="block text-lg leading-tight font-black" />
                    <div className="truncate text-sm text-ink-muted">{p.sv.split('/').slice(0, 2).join(' / ')}</div>
                  </div>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black text-white ${p.correct ? 'bg-brand' : 'bg-warn'}`}
                    aria-label={p.correct ? 'Rätt direkt' : 'Kommer tillbaka i repetitionen'}>
                    {p.correct ? '✓' : '↻'}
                  </span>
                </li>
              ))}
            </ul>
            {practised.some((p) => !p.correct) && <p className="mt-2 text-center text-xs font-bold text-ink-muted">↻ = kommer tillbaka i repetitionen</p>}
          </div>
        )}

        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-surface pt-4">
          <button type="button" onClick={onAgain}
            className="w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
            Spela igen
          </button>
          <button type="button" onClick={onClose}
            className="w-full rounded-2xl border-2 border-b-4 border-line bg-surface py-3 font-extrabold text-ink-muted active:translate-y-0.5 active:border-b-2">
            Tillbaka till Spelhallen
          </button>
        </div>
      </div>
    </div>
  )
}
