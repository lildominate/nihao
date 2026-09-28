// OWNER: Games agent. Ordregn — words rain down, tap the matching answer before they land.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Word } from '../../types'
import { PinyinText, playSfx, speak } from '../../speech'
import { celebrate, haptic } from '../../motion'
import { pickOptions, svLabel, WordDeck } from '../logic/pool'
import { ORDREGN_LIVES, ordregnFallMs, ordregnLevel, ordregnPoints } from '../logic/scoring'
import { AnswerTracker, wordRef } from '../logic/session'
import { burst, floatText, GameFrame, MissMeter, practisedWords, ScorePill, useGameLoop, usePause, type GameProps } from '../ui/kit'

interface Round { n: number; word: Word; options: Word[] }
type Feedback = { kind: 'hit' | 'wrong' | 'ground'; picked?: string } | null

export function Ordregn({ words, weights, extra, mode, reduced, toneColors, onEnd, onExit }: GameProps) {
  const reverse = mode === 'reverse' // pinyin falls, pick Swedish
  const label = reverse ? svLabel : (w: Word) => w.pinyin
  const byId = useMemo(() => new Map([...extra, ...words].map((w) => [w.id, w])), [words, extra])

  const deck = useRef<WordDeck>(null as unknown as WordDeck)
  const tracker = useRef(new AnswerTracker())
  const [paused, setPaused] = usePause()

  const makeRound = (n: number): Round => {
    const word = deck.current.next()
    return { n, word, options: pickOptions(word, words, label, 4, Math.random, extra) }
  }
  const [round, setRound] = useState<Round>(() => {
    deck.current = new WordDeck(words, Math.random, 3, weights)
    return makeRound(0)
  })
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [levelFlash, setLevelFlash] = useState<number | null>(null)

  const areaRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  // Hot loop state lives in refs (no React renders per frame).
  const fall = useRef({ progress: 0, x: 0, travel: 0, elW: 0, elH: 0, fallMs: ordregnFallMs(0), live: false })
  const playMs = useRef(0)
  const hitsRef = useRef(0)
  const over = useRef(false)

  // Measure once per spawn (not per frame) and place the drop at a random lane.
  useLayoutEffect(() => {
    const area = areaRef.current, el = dropRef.current
    if (!area || !el) return
    const aw = area.clientWidth, ah = area.clientHeight
    const ew = el.offsetWidth, eh = el.offsetHeight
    const margin = 10
    const x = margin + Math.random() * Math.max(0, aw - ew - margin * 2)
    fall.current = { progress: 0, x, travel: Math.max(40, ah - eh - 14), elW: ew, elH: eh, fallMs: ordregnFallMs(hitsRef.current), live: true }
    el.style.transform = `translate3d(${x}px, 0px, 0)`
    el.style.opacity = '1'
  }, [round.n])

  const dropCenter = () => {
    const f = fall.current
    return { x: f.x + f.elW / 2, y: f.progress * f.travel + f.elH / 2 }
  }

  const finish = () => {
    over.current = true
    const result = tracker.current.result(playMs.current)
    const level = ordregnLevel(hitsRef.current)
    onEnd({
      score: scoreRef.current,
      result,
      practised: practisedWords(result, byId),
      headline: level > 1 ? `Du nådde nivå ${level}!` : hitsRef.current > 0 ? `${hitsRef.current} träffar – bra jobbat!` : "Nästa gång fångar du dem!",
      stats: [
        { label: 'Träffar', value: String(hitsRef.current) },
        { label: 'Nivå', value: String(level) },
        { label: 'Tid', value: `${Math.round(playMs.current / 1000)} s` },
      ],
    })
  }
  const scoreRef = useRef(0)

  const next = (delay: number) => {
    window.setTimeout(() => {
      if (over.current) return
      setFeedback(null)
      setRound((r) => makeRound(r.n + 1))
    }, delay)
  }

  const miss = (kind: 'wrong' | 'ground', picked?: string) => {
    const f = fall.current
    f.live = false
    const w = round.word
    tracker.current.record(wordRef(w.id), false)
    deck.current.miss(w)
    playSfx('wrong')
    haptic('error')
    void speak(w.hanzi)
    setFeedback({ kind, picked })
    const m = misses + 1
    setMisses(m)
    if (dropRef.current && kind === 'ground') {
      const c = dropCenter()
      burst(layerRef.current, c.x, c.y + f.elH / 2, { reduced, count: 6, colors: ['#0ea5e9', '#7dd3fc', '#bae6fd'] })
    }
    if (m >= ORDREGN_LIVES) window.setTimeout(finish, 1300)
    else next(1300)
  }

  const answer = (opt: Word) => {
    const f = fall.current
    if (!f.live || paused || over.current) return
    if (opt.id !== round.word.id) { miss('wrong', opt.id); return }
    f.live = false
    void speak(round.word.hanzi)
    playSfx('correct')
    haptic('success')
    tracker.current.record(wordRef(round.word.id), true)
    const level = ordregnLevel(hitsRef.current)
    const pts = ordregnPoints(level, f.progress)
    scoreRef.current += pts
    setScore(scoreRef.current)
    hitsRef.current += 1
    setHits(hitsRef.current)
    const c = dropCenter()
    celebrate('burst', { from: dropRef.current ?? undefined, intensity: 0.8 })
    floatText(layerRef.current, c.x, c.y, `+${pts}`)
    if (dropRef.current) dropRef.current.style.opacity = '0'
    const newLevel = ordregnLevel(hitsRef.current)
    if (newLevel > level) {
      setLevelFlash(newLevel)
      window.setTimeout(() => setLevelFlash(null), 1200)
      if (!reduced) celebrate('stars')
    }
    setFeedback({ kind: 'hit', picked: opt.id })
    next(reverse ? 700 : 450)
  }

  useGameLoop(paused || !!feedback, (dt) => {
    playMs.current += dt
    const f = fall.current
    if (!f.live || !dropRef.current) return
    f.progress += dt / f.fallMs
    if (f.progress >= 1) {
      f.progress = 1
      dropRef.current.style.transform = `translate3d(${f.x}px, ${f.travel}px, 0)`
      miss('ground')
      return
    }
    dropRef.current.style.transform = `translate3d(${f.x}px, ${f.progress * f.travel}px, 0)`
  })

  const level = ordregnLevel(hits)
  const hud = (
    <div className="flex items-center justify-between gap-2">
      <MissMeter misses={misses} max={ORDREGN_LIVES} />
      <span className="rounded-full bg-sky-soft px-3 py-1 text-sm font-black text-sky-dark">Nivå {level}</span>
      <ScorePill score={score} />
    </div>
  )

  const showAnswer = feedback && feedback.kind !== 'hit'
  return (
    <GameFrame title="Ordregn" paused={paused} setPaused={setPaused} onExit={() => onExit(tracker.current.answered ? tracker.current.result(playMs.current) : null)} hud={hud} reduced={reduced}>
      <div className="flex h-full flex-col">
        <div ref={areaRef} className="relative mx-3 mt-1 min-h-0 flex-1 overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-50">
          {/* scenery */}
          <svg className="pointer-events-none absolute top-3 left-4 h-10 w-24 text-white/90 g-drift" viewBox="0 0 96 40" aria-hidden="true"><path fill="currentColor" d="M20 36h56a14 14 0 0 0 0-28 18 18 0 0 0-33-4A13 13 0 0 0 20 36Z" /></svg>
          <svg className="pointer-events-none absolute top-14 right-3 h-8 w-20 text-white/70 g-drift [animation-delay:1.2s]" viewBox="0 0 96 40" aria-hidden="true"><path fill="currentColor" d="M20 36h56a14 14 0 0 0 0-28 18 18 0 0 0-33-4A13 13 0 0 0 20 36Z" /></svg>
          <div className="absolute inset-x-0 bottom-0 h-3 bg-emerald-400/80" />
          {/* the falling word */}
          <div
            ref={dropRef}
            className={`absolute top-0 left-0 max-w-[80%] rounded-2xl border-b-4 px-4 py-2.5 text-center text-xl font-black shadow-lg will-change-transform
              ${showAnswer ? 'border-red-700 bg-danger text-white' : 'border-sky-dark bg-white text-ink'}`}
            style={{ transform: 'translate3d(-999px,0,0)' }}
          >
            {reverse ? <PinyinText pinyin={round.word.pinyin} colored={toneColors && !showAnswer} /> : svLabel(round.word)}
            {showAnswer && (
              <div className="mt-0.5 text-sm font-extrabold opacity-95">
                = {reverse ? svLabel(round.word) : round.word.pinyin}
              </div>
            )}
          </div>
          <div ref={layerRef} className="pointer-events-none absolute inset-0" />
          {levelFlash && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="g-pop rounded-3xl bg-gold px-6 py-3 text-2xl font-black text-ink shadow-xl">Nivå {levelFlash}! Snabbare!</div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {round.options.map((o) => {
            const isRight = o.id === round.word.id
            const picked = feedback?.picked === o.id
            const tone = feedback
              ? isRight ? 'border-brand-dark bg-brand text-white' : picked ? 'g-shake border-red-700 bg-danger text-white' : 'opacity-50 border-line bg-surface'
              : 'border-line bg-surface active:translate-y-0.5 active:border-b-2'
            return (
              <button
                key={`${round.n}-${o.id}`}
                type="button"
                disabled={!!feedback}
                onPointerDown={(e) => { e.preventDefault(); answer(o) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') answer(o) }}
                className={`press flex min-h-16 items-center justify-center rounded-2xl border-2 border-b-4 px-2 py-2 text-center text-lg leading-tight font-extrabold transition-colors ${tone}`}
              >
                {reverse ? svLabel(o) : <PinyinText pinyin={o.pinyin} colored={toneColors && !(feedback && (isRight || picked))} />}
              </button>
            )
          })}
        </div>
      </div>
    </GameFrame>
  )
}
