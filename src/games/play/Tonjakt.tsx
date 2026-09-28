// OWNER: Games agent. Tonjakt — hear a syllable, swipe (or tap) the tone's direction.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Word } from '../../types'
import { course } from '../../data/course'
import { PinyinText, playSfx, speak } from '../../speech'
import { celebrate, haptic } from '../../motion'
import { unitWordIds, svLabel } from '../logic/pool'
import { shuffle } from '../logic/random'
import { STREAK_METER_MAX, TONJAKT_LIVES, tonjaktLevel, tonjaktPoints, tonjaktSyllables } from '../logic/scoring'
import { classifySwipe, TONE_INFO, TONE_PATH, tonePrompts, type PlayTone, type Point, type TonePrompt } from '../logic/tones'
import { AnswerTracker, wordRef } from '../logic/session'
import { floatText, GameFrame, MissMeter, practisedWords, ScorePill, usePause, type GameProps } from '../ui/kit'

const TONE_BG: Record<PlayTone, string> = {
  1: 'bg-tone-1 border-rose-800',
  2: 'bg-tone-2 border-green-800',
  3: 'bg-tone-3 border-blue-800',
  4: 'bg-tone-4 border-purple-800',
}

export function ToneGlyph({ tone, className = 'h-8 w-8', stroke = 'currentColor' }: { tone: PlayTone; className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path d={TONE_PATH[tone]} stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Prompt sets: pool words first, topped up from units 1–2 so there's always enough variety. */
function buildPrompts(words: Word[]) {
  const reserve = [...unitWordIds(course, 0), ...unitWordIds(course, 1)].map((id) => course.words[id]).filter(Boolean)
  const merge = (n: 1 | 2, min: number) => {
    const own = tonePrompts(words, n)
    if (own.length >= min) return own
    const have = new Set(own.map((p) => p.word.id))
    return [...own, ...tonePrompts(reserve, n).filter((p) => !have.has(p.word.id))]
  }
  return { one: merge(1, 6), two: merge(2, 4) }
}

class PromptDeck {
  private q: TonePrompt[] = []
  private last = ''
  private all: TonePrompt[]
  constructor(all: TonePrompt[]) { this.all = all }
  next(): TonePrompt {
    if (!this.q.length) {
      this.q = shuffle(this.all)
      if (this.q.length > 1 && this.q[this.q.length - 1].word.id === this.last) this.q.reverse()
    }
    const p = this.q.pop()!
    this.last = p.word.id
    return p
  }
}

interface Round { n: number; prompt: TonePrompt }

export function Tonjakt({ words, reduced, toneColors, onEnd, onExit }: GameProps) {
  const poolIds = useMemo(() => new Set(words.map((w) => w.id)), [words])
  const prompts = useMemo(() => buildPrompts(words), [words])
  const decks = useRef({ one: new PromptDeck(prompts.one), two: new PromptDeck(prompts.two.length ? prompts.two : prompts.one) })
  const byId = useMemo(() => new Map(Object.values(course.words).map((w) => [w.id, w])), [])
  const tracker = useRef(new AnswerTracker())
  const [paused, setPaused] = usePause()

  const solvedRef = useRef(0)
  const pick = (n: number): Round => {
    const syl = prompts.two.length ? tonjaktSyllables(tonjaktLevel(solvedRef.current)) : 1
    return { n, prompt: (syl === 2 ? decks.current.two : decks.current.one).next() }
  }
  const [round, setRound] = useState<Round>(() => pick(0))
  const [answers, setAnswers] = useState<(PlayTone | null)[]>([])
  const [state, setState] = useState<'ask' | 'right' | 'wrong'>('ask')
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [solved, setSolved] = useState(0)
  const [misses, setMisses] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)
  const start = useRef(0)
  useEffect(() => { start.current = performance.now() }, [])
  const pausedMs = useRef(0)
  const pauseAt = useRef<number | null>(null)
  const over = useRef(false)
  const scoreRef = useRef(0)
  const bestStreak = useRef(0)

  const padRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<SVGPolylineElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const stroke = useRef<{ pts: Point[]; rect: DOMRect | null; id: number | null }>({ pts: [], rect: null, id: null })

  useEffect(() => {
    if (paused) pauseAt.current = performance.now()
    else if (pauseAt.current !== null) { pausedMs.current += performance.now() - pauseAt.current; pauseAt.current = null }
  }, [paused])

  const elapsed = () => performance.now() - start.current - pausedMs.current

  // Speak each new prompt.
  useEffect(() => {
    const t = window.setTimeout(() => { if (!over.current) void speak(round.prompt.word.hanzi) }, 200)
    return () => window.clearTimeout(t)
  }, [round])

  const finish = () => {
    over.current = true
    const result = tracker.current.result(elapsed())
    onEnd({
      score: scoreRef.current,
      result,
      practised: practisedWords(result, byId),
      headline: `Nivå ${tonjaktLevel(solvedRef.current)} · bästa serie ${bestStreak.current}`,
      stats: [
        { label: 'Klarade', value: String(solvedRef.current) },
        { label: 'Bästa serie', value: String(bestStreak.current) },
        { label: 'Nivå', value: String(tonjaktLevel(solvedRef.current)) },
      ],
    })
  }

  const nextRound = (delay: number) => {
    window.setTimeout(() => {
      if (over.current) return
      setAnswers([])
      setState('ask')
      setRound((r) => pick(r.n + 1))
    }, delay)
  }

  const record = (ok: boolean) => {
    const id = round.prompt.word.id
    if (poolIds.has(id)) tracker.current.record(wordRef(id), ok)
  }

  const give = (tone: PlayTone) => {
    if (state !== 'ask' || paused || over.current) return
    const i = answers.length
    const expected = round.prompt.tones[i]
    const nextAnswers = [...answers, tone]
    setAnswers(nextAnswers)
    const padC = padRef.current ? { x: padRef.current.clientWidth / 2, y: padRef.current.clientHeight / 2 } : { x: 0, y: 0 }
    if (tone !== expected) {
      setState('wrong')
      record(false)
      playSfx('wrong')
      haptic('error')
      setStreak(0)
      const m = misses + 1
      setMisses(m)
      window.setTimeout(() => { if (!over.current) void speak(round.prompt.word.hanzi, { slow: true }) }, 350)
      if (m >= TONJAKT_LIVES) window.setTimeout(finish, 2000)
      else nextRound(2000)
      return
    }
    if (nextAnswers.length < round.prompt.tones.length) { playSfx('tap'); return }
    // solved
    setState('right')
    record(true)
    playSfx('correct')
    haptic('success')
    const levelBefore = tonjaktLevel(solvedRef.current)
    solvedRef.current += 1
    setSolved(solvedRef.current)
    const s = streak + 1
    bestStreak.current = Math.max(bestStreak.current, s)
    setStreak(s)
    const pts = tonjaktPoints(s, round.prompt.tones.length)
    scoreRef.current += pts
    setScore(scoreRef.current)
    celebrate('burst', { from: padRef.current ?? undefined, intensity: 0.8 })
    floatText(layerRef.current, padC.x, padC.y - 30, `+${pts}`)
    const levelAfter = tonjaktLevel(solvedRef.current)
    if (s > 0 && s % STREAK_METER_MAX === 0) { setFlash('Tonmästare! 10 i rad'); if (!reduced) celebrate('fireworks') }
    else if (levelAfter > levelBefore) {
      setFlash(tonjaktSyllables(levelAfter) === 2 && tonjaktSyllables(levelBefore) === 1 && prompts.two.length ? `Nivå ${levelAfter}: två stavelser!` : `Nivå ${levelAfter}!`)
      if (!reduced) celebrate('stars')
    }
    window.setTimeout(() => setFlash(null), 1400)
    nextRound(900)
  }

  // ── swipe pad ──
  const toLocal = (e: React.PointerEvent): Point => {
    const r = stroke.current.rect!
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const drawTrail = () => {
    trailRef.current?.setAttribute('points', stroke.current.pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' '))
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (state !== 'ask' || paused) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    stroke.current = { pts: [], rect: e.currentTarget.getBoundingClientRect(), id: e.pointerId }
    stroke.current.pts.push(toLocal(e))
    drawTrail()
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stroke.current.id !== e.pointerId) return
    stroke.current.pts.push(toLocal(e))
    drawTrail()
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stroke.current.id !== e.pointerId) return
    stroke.current.pts.push(toLocal(e))
    const tone = classifySwipe(stroke.current.pts)
    stroke.current.id = null
    window.setTimeout(() => { if (stroke.current.id === null) trailRef.current?.setAttribute('points', '') }, 250)
    if (tone) give(tone)
  }

  const p = round.prompt
  const level = tonjaktLevel(solved)
  const hud = (
    <div className="flex items-center justify-between gap-2">
      <MissMeter misses={misses} max={TONJAKT_LIVES} />
      <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-700">Nivå {level}</span>
      <ScorePill score={score} />
    </div>
  )
  const reveal = state !== 'ask'

  return (
    <GameFrame title="Tonjakt" paused={paused} setPaused={setPaused} reduced={reduced} hud={hud}
      onExit={() => onExit(tracker.current.answered ? tracker.current.result(elapsed()) : null)}>
      <div className="flex h-full flex-col px-4 pb-3">
        {/* streak meter */}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-flame">Serie</span>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: STREAK_METER_MAX }, (_, i) => (
              <div key={i} className={`h-2.5 flex-1 rounded-full transition-colors ${i < streak % STREAK_METER_MAX || (streak > 0 && streak % STREAK_METER_MAX === 0) ? 'bg-flame' : 'bg-surface-2'}`} />
            ))}
          </div>
          <span key={streak} className="g-bump w-6 text-right font-black tabular-nums">{streak}</span>
        </div>

        {/* syllables */}
        <div key={round.n} className="g-in flex flex-col items-center gap-2 pt-3">
          <div className="flex items-end gap-3">
            {p.bases.map((b, i) => {
              const a = answers[i]
              const ok = a !== undefined && a === p.tones[i]
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`flex h-11 w-14 items-center justify-center rounded-xl border-2 ${a === undefined || a === null ? (i === answers.length && state === 'ask' ? 'border-violet-400 bg-violet-50 g-glow' : 'border-line bg-surface-2') : ok ? 'border-brand bg-brand-soft text-brand-dark' : 'border-danger bg-danger-soft text-danger'}`}>
                    {a ? <ToneGlyph tone={a} className="h-7 w-7" /> : <span className="text-xl font-black text-ink-muted">?</span>}
                  </div>
                  <span className="text-3xl font-black">
                    {reveal ? <PinyinText pinyin={p.word.pinyin.split(' ')[i] ?? b} colored={toneColors} /> : b}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="h-6 text-sm font-bold text-ink-muted">
            {reveal ? <>{svLabel(p.word)}{state === 'wrong' && <> · rätt: {p.tones.map((t) => TONE_INFO[t].arrow).join(' ')}</>}</> : p.tones.length === 2 ? 'Två stavelser – swipea två gånger' : 'Vilken ton hör du?'}
          </div>
        </div>

        {/* swipe pad */}
        <div ref={padRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className={`relative my-2 min-h-32 flex-1 touch-none overflow-hidden rounded-3xl border-2 border-dashed ${state === 'wrong' ? 'border-danger bg-danger-soft/60' : state === 'right' ? 'border-brand bg-brand-soft/60' : 'border-violet-300 bg-violet-50'}`}>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-violet-400">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 11V5a2 2 0 1 1 4 0v6m0-2a2 2 0 1 1 4 0v2m0 0a2 2 0 1 1 4 0v3a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L4 14a2 2 0 0 1 3.4-2L9 14" /></svg>
            <span className="text-sm font-extrabold">Swipea tonen här</span>
          </div>
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => void speak(p.word.hanzi)}
            aria-label="Lyssna igen" className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-sky-dark bg-sky text-white active:translate-y-0.5 active:border-b-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" /><path d="M16.2 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          </button>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <polyline ref={trailRef} points="" fill="none" stroke="#7c3aed" strokeOpacity=".7" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div ref={layerRef} className="pointer-events-none absolute inset-0" />
          {flash && <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"><span className="g-pop rounded-2xl bg-gold px-5 py-2 text-xl font-black text-ink shadow-lg">{flash}</span></div>}
        </div>

        {/* tone buttons */}
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as PlayTone[]).map((t) => (
            <button key={t} type="button" onClick={() => give(t)} disabled={state !== 'ask'} aria-label={`Ton ${t}: ${TONE_INFO[t].name}`}
              className={`press flex min-h-18 flex-col items-center justify-center rounded-2xl border-b-4 text-white active:translate-y-0.5 active:border-b-2 disabled:opacity-60 ${toneColors ? TONE_BG[t] : 'border-slate-800 bg-slate-600'}`}>
              <ToneGlyph tone={t} className="h-8 w-8" stroke="#fff" />
              <span className="text-xs font-black">{TONE_INFO[t].name}</span>
            </button>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
