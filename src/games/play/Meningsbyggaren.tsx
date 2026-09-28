// OWNER: Games agent. Meningsbyggaren på tid — build pinyin sentences against the clock.
import { useMemo, useRef, useState } from 'react'
import type { Sentence } from '../../types'
import { course } from '../../data/course'
import { PinyinText, playSfx, speak } from '../../speech'
import { celebrate, haptic } from '../../motion'
import { builderTiles, isNextChunk, playableSentences, sentenceChunks, type Tile } from '../logic/builder'
import { unitWordIds } from '../logic/pool'
import { shuffle } from '../logic/random'
import { BUILDER_DURATION_MS, builderPoints } from '../logic/scoring'
import { AnswerTracker } from '../logic/session'
import { floatText, GameFrame, ScorePill, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'

export function sentencesFor(wordIds: string[]): Sentence[] {
  const own = playableSentences(course, wordIds)
  if (own.length >= 4) return own
  const ids = new Set(own.map((s) => s.id))
  return [...own, ...playableSentences(course, [...wordIds, ...unitWordIds(course, 0)]).filter((s) => !ids.has(s.id))]
}

interface Round { n: number; s: Sentence; tiles: Tile[] }

export function Meningsbyggaren({ words, reduced, toneColors, onEnd, onExit }: GameProps) {
  const pool = useMemo(() => shuffle(sentencesFor(words.map((w) => w.id))), [words])
  const distractors = useMemo(() => [...new Set(pool.flatMap(sentenceChunks))], [pool])
  const idx = useRef(0)
  const make = (n: number): Round => {
    const s = pool[idx.current++ % pool.length]
    return { n, s, tiles: builderTiles(s, distractors) }
  }
  const [round, setRound] = useState<Round>(() => make(0))
  const [placed, setPlaced] = useState<Tile[]>([])
  const [wrongTile, setWrongTile] = useState<{ id: number; k: number } | null>(null)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState(0)
  const [paused, setPaused] = usePause()
  const tracker = useRef(new AnswerTracker())
  const roundMistakes = useRef(0)
  const built = useRef(0)
  const scoreRef = useRef(0)
  const left = useRef(BUILDER_DURATION_MS)
  const playMs = useRef(0)
  const over = useRef(false)
  const barRef = useRef<HTMLDivElement>(null)
  const secRef = useRef<HTMLSpanElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const shown = useRef(-1)
  const builtRef = useRef<HTMLDivElement>(null)

  const finish = () => {
    if (over.current) return
    over.current = true
    playSfx('complete')
    const result = tracker.current.result(playMs.current)
    const practised: Practised[] = result.items.map((it) => {
      const s = course.sentences[it.item.id]
      return { key: s.id, hanzi: s.hanzi, pinyin: sentenceChunks(s).join(' '), sv: s.sv, correct: it.correct }
    })
    onEnd({
      score: scoreRef.current,
      result,
      practised,
      practisedLabel: 'Övade meningar',
      headline: `${built.current} meningar på 90 sekunder`,
      stats: [
        { label: 'Meningar', value: String(built.current) },
        { label: 'Felfria', value: String(result.correct) },
        { label: 'Misstag', value: String(result.mistakes) },
      ],
    })
  }

  useGameLoop(paused, (dt) => {
    if (over.current) return
    playMs.current += dt
    left.current -= dt
    if (left.current <= 0) { left.current = 0; finish() }
    if (barRef.current) barRef.current.style.transform = `scaleX(${left.current / BUILDER_DURATION_MS})`
    const s = Math.ceil(left.current / 1000)
    if (s !== shown.current && secRef.current) { shown.current = s; secRef.current.textContent = String(s) }
  })

  const tap = (t: Tile, el: HTMLElement) => {
    if (done || paused || over.current) return
    const ref = { kind: 'sentence' as const, id: round.s.id }
    if (!isNextChunk(round.s, placed.length, t.text)) {
      roundMistakes.current++
      tracker.current.record(ref, false)
      playSfx('wrong')
      haptic('error')
      setWrongTile({ id: t.id, k: Date.now() })
      return
    }
    playSfx('tap')
    const np = [...placed, t]
    setPlaced(np)
    if (np.length === sentenceChunks(round.s).length) {
      if (roundMistakes.current === 0) tracker.current.record(ref, true)
      setDone(true)
      built.current++
      const pts = builderPoints(np.length, roundMistakes.current)
      scoreRef.current += pts
      setScore(scoreRef.current)
      void speak(round.s.hanzi)
      playSfx('correct')
      haptic('success')
      const r = el.getBoundingClientRect(), L = layerRef.current?.getBoundingClientRect()
      const x = L ? L.width / 2 : 0, y = L ? r.top - L.top - 60 : 0
      celebrate('burst', { from: builtRef.current ?? el })
      floatText(layerRef.current, x, y, `+${pts}`)
      window.setTimeout(() => {
        if (over.current) return
        roundMistakes.current = 0
        setPlaced([])
        setDone(false)
        setRound((cur) => make(cur.n + 1))
      }, 1300)
    }
  }

  const placedIds = new Set(placed.map((t) => t.id))
  const hud = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1"><span ref={secRef} className="w-9 text-2xl font-black tabular-nums">90</span><span className="text-xs font-bold text-ink-muted">sek</span></div>
      <span className="text-lg font-black">Meningsbyggaren</span>
      <ScorePill score={score} />
    </div>
  )

  return (
    <GameFrame title="Meningsbyggaren" paused={paused} setPaused={setPaused} reduced={reduced} hud={hud}
      onExit={() => onExit(tracker.current.answered ? tracker.current.result(playMs.current) : null)}>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2">
          <div ref={barRef} className="h-full w-full origin-left rounded-full bg-emerald-500 will-change-transform" />
        </div>
        <div key={round.n} className="g-in flex flex-1 flex-col justify-center gap-4 py-3">
          <div className="text-center">
            <div className="text-sm font-extrabold uppercase tracking-wider text-ink-muted">Bygg på kinesiska</div>
            <div className="mt-1 text-2xl font-black">”{round.s.sv}”</div>
          </div>
          <div ref={builtRef} className={`flex min-h-20 flex-wrap content-center items-center justify-center gap-2 rounded-2xl border-2 p-3 ${done ? 'border-brand bg-brand-soft' : 'border-dashed border-line bg-surface-2/60'}`}>
            {placed.length === 0 && <span className="text-sm font-bold text-ink-muted">Tryck på bitarna i rätt ordning</span>}
            {placed.map((t) => (
              <span key={t.id} className="g-pop rounded-xl border-2 border-b-4 border-line bg-surface px-3 py-2 text-lg font-extrabold">
                <PinyinText pinyin={t.text} colored={toneColors} />
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {round.tiles.map((t) => {
            const used = placedIds.has(t.id)
            const shake = wrongTile?.id === t.id
            return (
              <button key={`${round.n}-${t.id}-${shake ? wrongTile!.k : 0}`} type="button" disabled={used || done}
                onPointerDown={(e) => { e.preventDefault(); tap(t, e.currentTarget) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tap(t, e.currentTarget) }}
                className={`press min-h-14 min-w-16 rounded-2xl border-2 border-b-4 px-4 py-2 text-xl font-extrabold transition-opacity
                  ${used ? 'border-transparent bg-surface-2 opacity-30' : shake ? 'g-shake border-red-400 bg-danger-soft' : 'border-line bg-surface active:translate-y-0.5 active:border-b-2'}`}>
                <PinyinText pinyin={t.text} colored={toneColors} />
              </button>
            )
          })}
        </div>
        <div ref={layerRef} className="pointer-events-none absolute inset-0" />
      </div>
    </GameFrame>
  )
}
