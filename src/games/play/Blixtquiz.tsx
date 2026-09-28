// OWNER: Games agent. Blixtquiz — as many right answers as possible in 60 s. Combos multiply.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Word } from '../../types'
import { PinyinText, playSfx, SpeakButton, speak } from '../../speech'
import { celebrate, haptic } from '../../motion'
import { pickOptions, svLabel, WordDeck } from '../logic/pool'
import { BLIXT_DURATION_MS, blixtMultiplier, blixtPoints, blixtTimeBonus } from '../logic/scoring'
import { AnswerTracker, wordRef } from '../logic/session'
import { centerIn, floatText, GameFrame, practisedWords, ScorePill, useGameLoop, usePause, type GameProps } from '../ui/kit'

type Kind = 'listen' | 'sv2py'
interface Q { n: number; kind: Kind; word: Word; options: Word[] }

export function Blixtquiz({ words, extra, reduced, toneColors, onEnd, onExit }: GameProps) {
  const byId = useMemo(() => new Map([...extra, ...words].map((w) => [w.id, w])), [words, extra])
  const deck = useRef<WordDeck>(null as unknown as WordDeck)
  const tracker = useRef(new AnswerTracker())
  const [paused, setPaused] = usePause()

  const makeQ = (n: number): Q => {
    const word = deck.current.next()
    const kind: Kind = Math.random() < 0.5 ? 'listen' : 'sv2py'
    const label = kind === 'listen' ? svLabel : (w: Word) => w.pinyin
    return { n, kind, word, options: pickOptions(word, words, label, 4, Math.random, extra) }
  }
  const [q, setQ] = useState<Q>(() => { deck.current = new WordDeck(words); return makeQ(0) })
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [feedback, setFeedback] = useState<{ picked: string; ok: boolean } | null>(null)
  const [bonus, setBonus] = useState(0)

  const left = useRef(BLIXT_DURATION_MS)
  const playMs = useRef(0)
  const over = useRef(false)
  const stats = useRef({ score: 0, best: 0, right: 0 })
  const barRef = useRef<HTMLDivElement>(null)
  const secRef = useRef<HTMLSpanElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const shown = useRef(-1)
  const comboRef = useRef<HTMLSpanElement>(null)

  // Listening questions speak on arrival.
  useEffect(() => {
    if (q.kind !== 'listen') return
    const t = window.setTimeout(() => { if (!over.current) void speak(q.word.hanzi) }, 120)
    return () => window.clearTimeout(t)
  }, [q])

  const finish = () => {
    if (over.current) return
    over.current = true
    playSfx('complete')
    const result = tracker.current.result(playMs.current)
    onEnd({
      score: stats.current.score,
      result,
      practised: practisedWords(result, byId),
      headline: `${stats.current.right} rätt på en minut!`,
      stats: [
        { label: 'Rätt', value: String(stats.current.right) },
        { label: 'Bästa kombo', value: String(stats.current.best) },
        { label: 'Träffsäkerhet', value: `${tracker.current.answered ? Math.round((stats.current.right / tracker.current.answered) * 100) : 0} %` },
      ],
    })
  }

  useGameLoop(paused, (dt) => {
    if (over.current) return
    playMs.current += dt
    left.current -= dt
    if (left.current <= 0) { left.current = 0; finish() }
    const frac = Math.min(1, left.current / BLIXT_DURATION_MS)
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${frac})`
    }
    const s = Math.ceil(left.current / 1000)
    if (s !== shown.current && secRef.current) {
      shown.current = s
      secRef.current.textContent = String(s)
      if (barRef.current) barRef.current.style.backgroundColor = s <= 10 ? '#dc2626' : '#f59e0b'
    }
  })

  const answer = (opt: Word, el: HTMLElement) => {
    if (feedback || paused || over.current) return
    const ok = opt.id === q.word.id
    tracker.current.record(wordRef(q.word.id), ok)
    setFeedback({ picked: opt.id, ok })
    if (ok) {
      if (q.kind === 'sv2py') void speak(q.word.hanzi)
      playSfx('correct')
      haptic('success')
      const c = combo + 1
      const pts = blixtPoints(c)
      stats.current.score += pts
      stats.current.right += 1
      stats.current.best = Math.max(stats.current.best, c)
      setCombo(c)
      setScore(stats.current.score)
      const p = centerIn(el, layerRef.current)
      celebrate('burst', { from: el, intensity: Math.min(1.6, 0.6 + c * 0.1) })
      floatText(layerRef.current, p.x, p.y - 10, `+${pts}`)
      const tb = blixtTimeBonus(c)
      if (tb) {
        left.current += tb
        setBonus((b) => b + 1)
        celebrate('stars', { from: comboRef.current ?? undefined })
      }
    } else {
      void speak(q.word.hanzi)
      playSfx('wrong')
      haptic('error')
      deck.current.miss(q.word)
      setCombo(0)
    }
    window.setTimeout(() => {
      if (over.current) return
      setFeedback(null)
      setQ((cur) => makeQ(cur.n + 1))
    }, ok ? 380 : 1100)
  }

  const mult = blixtMultiplier(combo)
  const hud = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-warn" fill="currentColor" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M12 9v4l2.5 2" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" /><rect x="10" y="2" width="4" height="3" rx="1" /></svg>
        <span ref={secRef} className="w-8 text-2xl font-black tabular-nums">60</span>
      </div>
      <span ref={comboRef} key={`${mult}-${combo}`} className={`rounded-full px-3 py-1 text-sm font-black ${combo >= 3 ? 'g-bump bg-flame text-white' : 'bg-surface-2 text-ink-muted'}`}>
        {combo >= 1 ? `Kombo ${combo} · ×${mult}` : 'Kombo ×1'}
      </span>
      <ScorePill score={score} />
    </div>
  )

  return (
    <GameFrame title="Blixtquiz" paused={paused} setPaused={setPaused} reduced={reduced} hud={hud}
      onExit={() => onExit(tracker.current.answered ? tracker.current.result(playMs.current) : null)}>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2">
          <div ref={barRef} className="h-full w-full origin-left rounded-full bg-warn will-change-transform" />
        </div>
        {bonus > 0 && <div key={bonus} className="g-pop mt-2 self-center rounded-full bg-brand px-3 py-1 text-sm font-black text-white">+5 sekunder! 5 i rad</div>}
        <div key={q.n} className="g-in flex flex-1 flex-col items-center justify-center gap-3 py-2">
          {q.kind === 'listen' ? (
            <>
              <span className="text-sm font-extrabold uppercase tracking-wider text-ink-muted">Vad betyder det?</span>
              <SpeakButton hanzi={q.word.hanzi} size="lg" label="Lyssna igen" />
              {feedback && <PinyinText pinyin={q.word.pinyin} colored={toneColors} className="g-pop text-2xl font-black" />}
            </>
          ) : (
            <>
              <span className="text-sm font-extrabold uppercase tracking-wider text-ink-muted">Hur säger man…</span>
              <span className="text-center text-3xl font-black">{svLabel(q.word)}</span>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {q.options.map((o) => {
            const isRight = o.id === q.word.id
            const picked = feedback?.picked === o.id
            const style = feedback
              ? isRight ? 'border-brand-dark bg-brand text-white' : picked ? 'g-shake border-red-700 bg-danger text-white' : 'opacity-50 border-line bg-surface'
              : 'border-line bg-surface active:translate-y-0.5 active:border-b-2'
            return (
              <button key={`${q.n}-${o.id}`} type="button" disabled={!!feedback}
                onPointerDown={(e) => { e.preventDefault(); answer(o, e.currentTarget) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') answer(o, e.currentTarget) }}
                className={`press flex min-h-18 items-center justify-center rounded-2xl border-2 border-b-4 px-2 py-3 text-center text-lg leading-tight font-extrabold transition-colors ${style}`}>
                {q.kind === 'listen' ? svLabel(o) : <PinyinText pinyin={o.pinyin} colored={toneColors && !(feedback && (isRight || picked))} />}
              </button>
            )
          })}
        </div>
        <div ref={layerRef} className="pointer-events-none absolute inset-0" />
      </div>
    </GameFrame>
  )
}
