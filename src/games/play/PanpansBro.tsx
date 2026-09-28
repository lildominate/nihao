// OWNER: Games agent. Pānpans bro — build a plank bridge from pinyin chunks; Pānpan hops across.
// Canvas scene (cliffs, planks) + the real Panda as a DOM overlay moved with transforms. State lives in refs.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Sentence } from '../../types'
import { course } from '../../data/course'
import { Panda, type PandaMood } from '../../mascot/Panda'
import { celebrate, haptic, replay } from '../../motion'
import { hasChineseVoice, PinyinText, playSfx, speak, stopSpeaking } from '../../speech'
import { AudioSequencer, browserAudioDeps } from '../logic/audioQueue'
import { isNextChunk, sentenceChunks } from '../logic/builder'
import {
  BRIDGE_LIVES, BRIDGE_ROUNDS, bridgeFinalBonus, bridgeLayout, bridgePoints, easeInOut, fallOffset, FLY_MS, flyPose, HOP_MS, hopPose, hopSquash,
  lerp, makeBridgeRound, PAN_MS, pickBridgeSentence, RUN_MS, slotX, clamp01, type BridgeRound, type Pt,
} from '../logic/bridge'
import { AnswerTracker } from '../logic/session'
import { floatText, GameFrame, ScorePill, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'
import { drawBackdrop, drawWorld, type PlankDraw } from '../ui/bridgeScene'
import { readPalette, type Palette } from '../ui/runnerScene'
import { useCanvasView } from '../ui/useCanvas'
import { sentencesFor } from './Meningsbyggaren'

type Phase = 'countdown' | 'build' | 'run' | 'cheer' | 'pan' | 'wait' | 'over'

interface PlankFx { slot: number; text: string; bad: boolean; t0: number; from: Pt; landed: boolean }

interface Live {
  phase: Phase
  t: number
  now: number
  round: BridgeRound
  placed: number
  mistakes: number
  planks: PlankFx[]
  oldPlanks: PlankDraw[]
  oldN: number
  standIdx: number
  hop: { t0: number; from: Pt; to: Pt; idx: number } | null
  run: { t0: number; from: Pt; to: Pt } | null
  panFrom: Pt
  pan: number
  pandaPos: Pt
  lives: number
  score: number
  built: number
  flawless: number
  playMs: number
  countShown: number
  moodUntil: number
}

const COUNTDOWN_S = 3
const CRACK_MS = 240
const HOLD_MS = 300
const FALL_MS = 900

export function PanpansBro({ words, weights, extra, reduced, toneColors, onEnd, onExit }: GameProps) {
  const [paused, setPaused] = usePause()
  const [finished, setFinished] = useState(false)
  const byId = useMemo(() => new Map([...extra, ...words].map((w) => [w.id, w])), [words, extra])
  const allWords = useMemo(() => [...byId.values()], [byId])
  const pool = useMemo(() => sentencesFor(words.map((w) => w.id)), [words])
  const distractors = useMemo(() => [...new Set(pool.flatMap(sentenceChunks))], [pool])
  const recent = useRef<string[]>([])
  const tracker = useRef(new AnswerTracker())
  const seq = useRef<AudioSequencer>(null as unknown as AudioSequencer)
  if (!seq.current) seq.current = new AudioSequencer(browserAudioDeps((t) => speak(t), () => stopSpeaking(), () => hasChineseVoice()), { silentMs: 700 })
  const done = useRef(false)

  const makeRound = (index: number): BridgeRound => {
    const s: Sentence = pickBridgeSentence(pool, index, weights, Math.random, recent.current)
    recent.current = [...recent.current, s.id].slice(-3)
    return makeBridgeRound(index, s, distractors, (id) => byId.get(id), allWords, Math.random)
  }

  const live = useRef<Live>(null as unknown as Live)
  if (!live.current) {
    live.current = {
      phase: 'countdown', t: COUNTDOWN_S, now: 0, round: makeRound(0), placed: 0, mistakes: 0, planks: [], oldPlanks: [], oldN: 0,
      standIdx: -1, hop: null, run: null, panFrom: { x: 0, y: 0 }, pan: 0, pandaPos: { x: -200, y: 0 },
      lives: BRIDGE_LIVES, score: 0, built: 0, flawless: 0, playMs: 0, countShown: 0, moodUntil: 0,
    }
  }
  const [round, setRound] = useState<BridgeRound>(() => live.current.round)
  const [placedIds, setPlacedIds] = useState<number[]>([])
  const [wrongTile, setWrongTile] = useState<{ id: number; k: number } | null>(null)
  const [locked, setLocked] = useState(true)
  const [hud, setHud] = useState({ score: 0, lives: BRIDGE_LIVES, n: 1 })
  const [count, setCount] = useState<number | null>(COUNTDOWN_S)
  const [mood, setMood] = useState<PandaMood>('happy')
  const [pandaSize, setPandaSize] = useState(76)

  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pandaRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const palette = useRef<Palette | null>(null)
  const pausedRef = useRef(paused)
  const moodRef = useRef<PandaMood>('happy')
  useEffect(() => { pausedRef.current = paused })
  useEffect(() => { palette.current = readPalette() }, [])
  const view = useCanvasView(sceneRef, canvasRef, (v) => setPandaSize(Math.round(Math.min(92, Math.max(64, v.h * 0.27)))))

  useEffect(() => {
    const s = seq.current
    return () => { s.cancel(); stopSpeaking() }
  }, [])
  useEffect(() => { if (paused) seq.current.cancel() }, [paused])

  const setMoodFor = (m: PandaMood, ms: number) => {
    const L = live.current
    L.moodUntil = ms > 0 ? L.now + ms : 0
    if (moodRef.current !== m) { moodRef.current = m; setMood(m) }
  }

  const layoutFor = (n: number) => bridgeLayout(view.current.w, view.current.h, n)
  const standPos = (n: number, idx: number, side: 'left' | 'right' = 'left'): Pt => {
    const l = layoutFor(n)
    if (side === 'right') return { x: (l.gapR + view.current.w) / 2, y: l.groundY }
    return idx < 0 ? { x: l.gapL - Math.min(34, l.gapL * 0.5), y: l.groundY } : { x: slotX(l, idx), y: l.groundY }
  }

  const finish = (completed: boolean) => {
    if (done.current) return
    done.current = true
    live.current.phase = 'over'
    setFinished(true)
    const L = live.current
    const bonus = bridgeFinalBonus(L.lives, completed)
    const result = tracker.current.result(L.playMs)
    const practised: Practised[] = result.items.flatMap((it) => {
      const s = course.sentences[it.item.id]
      return s ? [{ key: s.id, hanzi: s.hanzi, pinyin: sentenceChunks(s).join(' '), sv: s.sv, correct: it.correct }] : []
    })
    onEnd({
      score: L.score + bonus,
      result,
      practised,
      practisedLabel: 'Övade meningar',
      headline: completed ? `Du byggde alla broar!${bonus ? ` +${bonus} livbonus` : ''}` : `Du byggde ${L.built} av ${BRIDGE_ROUNDS} broar`,
      stats: [
        { label: 'Broar', value: `${L.built}/${BRIDGE_ROUNDS}` },
        { label: 'Felfria', value: String(L.flawless) },
        { label: 'Liv kvar', value: String(L.lives) },
      ],
    })
  }

  // ── tile tap ───────────────────────────────────────────────
  const tap = (tileId: number, text: string, el: HTMLElement) => {
    const L = live.current
    if (L.phase !== 'build' || pausedRef.current || done.current) return
    const s = L.round.sentence
    const ref = { kind: 'sentence' as const, id: s.id }
    const cv = canvasRef.current?.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    const from: Pt = cv ? { x: er.left + er.width / 2 - cv.left, y: Math.min(view.current.h + 24, er.top + er.height / 2 - cv.top) } : { x: 0, y: 0 }
    const n = L.round.chunks.length

    if (!isNextChunk(s, L.placed, text)) {
      L.mistakes += 1
      L.lives -= 1
      tracker.current.record(ref, false)
      L.planks.push({ slot: L.placed, text, bad: true, t0: L.now, from, landed: false })
      playSfx('wrong')
      haptic('error')
      if (stageRef.current && !reduced) replay(stageRef.current, 'shake')
      setWrongTile({ id: tileId, k: Date.now() })
      setHud((h) => ({ ...h, lives: L.lives }))
      setMoodFor('surprised', 900)
      if (L.lives <= 0) {
        L.phase = 'wait'
        L.t = 1.4
        setLocked(true)
        setMoodFor('sad', 0)
      }
      return
    }

    L.planks.push({ slot: L.placed, text, bad: false, t0: L.now, from, landed: false })
    L.placed += 1
    playSfx('tap')
    haptic('light')
    setPlacedIds((p) => [...p, tileId])
    if (L.placed === n) setLocked(true)
  }

  // ── main loop ──────────────────────────────────────────────
  useGameLoop(paused || finished, (dt) => {
    const L = live.current
    L.now += dt
    L.playMs += dt
    const dtS = dt / 1000
    const n = L.round.chunks.length
    const lay = layoutFor(n)

    if (L.moodUntil && L.now > L.moodUntil) { L.moodUntil = 0; if (moodRef.current !== 'happy') { moodRef.current = 'happy'; setMood('happy') } }

    // planks: landing + cleanup
    for (const p of L.planks) if (!p.landed && L.now - p.t0 >= FLY_MS) p.landed = true
    L.planks = L.planks.filter((p) => !(p.bad && L.now - p.t0 > FLY_MS + HOLD_MS + FALL_MS))

    if (L.phase === 'countdown') {
      L.t -= dtS
      const c = Math.max(0, Math.ceil(L.t))
      if (c !== L.countShown) { L.countShown = c; setCount(c > 0 ? c : null) }
      L.pandaPos = standPos(n, -1)
      if (L.t <= 0) { L.phase = 'build'; setLocked(false) }
    } else if (L.phase === 'build') {
      // hop onto the next landed plank
      if (!L.hop) {
        const nextIdx = L.standIdx + 1
        const p = L.planks.find((q) => !q.bad && q.slot === nextIdx && q.landed)
        if (p) {
          const from = L.pandaPos
          L.hop = { t0: L.now, from, to: standPos(n, nextIdx), idx: nextIdx }
          const h = L.round.hanzi[nextIdx]
          if (h) void seq.current.enqueue(h)
        }
      }
      if (L.hop) {
        const t = (L.now - L.hop.t0) / HOP_MS
        L.pandaPos = hopPose(t, L.hop.from, L.hop.to, lay.plankH * 2 + 16)
        if (t >= 1) { L.pandaPos = L.hop.to; L.standIdx = L.hop.idx; L.hop = null }
      } else if (L.standIdx < 0) L.pandaPos = standPos(n, -1)
      // whole bridge laid and Pānpan on the last plank: run across
      if (!L.hop && L.placed === n && L.standIdx === n - 1) {
        L.phase = 'run'
        L.run = { t0: L.now, from: L.pandaPos, to: standPos(n, 0, 'right') }
        setMoodFor('cheer', 0)
      }
    } else if (L.phase === 'run') {
      const r = L.run!
      const t = (L.now - r.t0) / RUN_MS
      const e = easeInOut(t)
      L.pandaPos = { x: lerp(r.from.x, r.to.x, e), y: r.from.y - Math.abs(Math.sin(t * Math.PI * 4)) * 8 * (t < 1 ? 1 : 0) }
      if (t >= 1) {
        L.pandaPos = r.to
        L.run = null
        L.phase = 'cheer'
        L.t = 1.6
        L.built += 1
        const flawless = L.mistakes === 0
        if (flawless) { L.flawless += 1; tracker.current.record({ kind: 'sentence', id: L.round.sentence.id }, true) }
        const pts = bridgePoints(n, L.mistakes)
        L.score += pts
        playSfx('correct')
        haptic('success')
        void seq.current.enqueue(L.round.sentence.hanzi)
        const cv = canvasRef.current?.getBoundingClientRect()
        if (cv) celebrate(flawless ? 'confetti' : 'burst', { origin: { x: cv.left + L.pandaPos.x, y: cv.top + L.pandaPos.y - pandaSize * 0.6 }, intensity: 0.8 })
        floatText(layerRef.current, L.pandaPos.x, L.pandaPos.y - pandaSize, `+${pts}`)
        setMoodFor('proud', 0)
        setHud((h) => ({ ...h, score: L.score }))
      }
    } else if (L.phase === 'cheer') {
      L.t -= dtS
      if (L.t <= 0) {
        if (L.built >= BRIDGE_ROUNDS) finish(true)
        else {
          // next gap: slide the world, Pānpan walks to the new left edge
          const next = makeRound(L.built)
          L.oldPlanks = planksDraw(L, n, lay)
          L.oldN = n
          L.round = next
          L.planks = []
          L.placed = 0
          L.mistakes = 0
          L.standIdx = -1
          L.panFrom = L.pandaPos
          L.pan = 0
          L.phase = 'pan'
          setRound(next)
          setPlacedIds([])
          setHud((h) => ({ ...h, n: L.built + 1 }))
          setMoodFor('happy', 0)
        }
      }
    } else if (L.phase === 'pan') {
      L.pan = clamp01(L.pan + dt / PAN_MS)
      const to = standPos(n, -1)
      L.pandaPos = { x: lerp(L.panFrom.x, to.x, easeInOut(L.pan)), y: to.y }
      if (L.pan >= 1) { L.phase = 'build'; L.pandaPos = to; L.oldPlanks = []; setLocked(false) }
    } else if (L.phase === 'wait') {
      L.t -= dtS
      if (L.t <= 0) finish(false)
    }
    render()
  })

  /** Poses of the current planks (with fly / crack / fall animation). */
  const planksDraw = (L: Live, n: number, lay = layoutFor(n)): PlankDraw[] => {
    const out: PlankDraw[] = []
    for (const p of L.planks) {
      const to: Pt = { x: slotX(lay, p.slot), y: lay.groundY + lay.plankH / 2 }
      const age = L.now - p.t0
      if (age < FLY_MS) {
        const f = flyPose(age / FLY_MS, p.from, to)
        out.push({ ...f, alpha: 1, text: p.text, crack: 0 })
      } else if (!p.bad) {
        out.push({ x: to.x, y: to.y, rot: 0, scale: 1, alpha: 1, text: p.text, crack: 0 })
      } else {
        const a = age - FLY_MS
        const fall = fallOffset(a, HOLD_MS)
        const wob = a < HOLD_MS && !reduced ? Math.sin(a * 0.06) * 0.06 : 0
        out.push({ x: to.x, y: to.y + fall.dy, rot: fall.rot + wob, scale: 1, alpha: fall.alpha, text: p.text, crack: clamp01(a / CRACK_MS) })
      }
    }
    return out
  }

  const render = () => {
    const cv = canvasRef.current
    const pal = palette.current
    if (!cv || !pal) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { dpr, w, h } = view.current
    const L = live.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const v = { w, h }
    const n = L.round.chunks.length
    const motion = !reduced
    const pan = L.phase === 'pan' ? easeInOut(L.pan) : 0
    drawBackdrop(ctx, v, pal, L.now, pan * w, motion)
    if (L.phase === 'pan') {
      drawWorld(ctx, v, pal, { layout: bridgeLayout(w, h, L.oldN), planks: L.oldPlanks, ox: -pan * w, colored: toneColors }, L.now, motion)
      drawWorld(ctx, v, pal, { layout: layoutFor(n), planks: [], ox: (1 - pan) * w, colored: toneColors }, L.now, motion)
    } else {
      drawWorld(ctx, v, pal, { layout: layoutFor(n), planks: planksDraw(L, n), ox: 0, colored: toneColors }, L.now, motion)
    }
    const pe = pandaRef.current
    if (pe) {
      const sq = L.hop ? hopSquash((L.now - L.hop.t0) / HOP_MS) : 1
      const idle = motion && !L.hop && L.phase !== 'run' ? Math.sin(L.now * 0.004) * 1.5 : 0
      const tilt = L.hop && motion ? (L.hop.to.x > L.hop.from.x ? 1 : -1) * Math.sin(clamp01((L.now - L.hop.t0) / HOP_MS) * Math.PI) * 8 : 0
      pe.style.transform = `translate3d(${L.pandaPos.x - pandaSize / 2}px, ${L.pandaPos.y - pandaSize * 0.92 + idle}px, 0) rotate(${tilt}deg) scaleY(${motion ? sq : 1})`
    }
  }

  const hearts = (
    <div className="flex items-center gap-0.5 text-2xl leading-none" aria-label={`${hud.lives} liv kvar`}>
      {Array.from({ length: BRIDGE_LIVES }, (_, i) => <span key={i} className={i < hud.lives ? '' : 'opacity-25 grayscale'}>❤️</span>)}
    </div>
  )
  const hudNode = (
    <div className="flex items-center justify-between gap-2">
      {hearts}
      <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-black text-ink-muted tabular-nums">Bro {hud.n}/{BRIDGE_ROUNDS}</span>
      <ScorePill score={hud.score} />
    </div>
  )

  const placedSet = new Set(placedIds)
  return (
    <GameFrame title="Pānpans bro" paused={paused} setPaused={setPaused} reduced={reduced} hud={hudNode}
      onExit={() => { seq.current.cancel(); stopSpeaking(); onExit(tracker.current.answered ? tracker.current.result(live.current.playMs) : null) }}>
      <div ref={stageRef} className="flex h-full flex-col" data-testid="bridge-stage">
        <div className="px-3 pt-1">
          <div key={round.sentence.id + round.index} className="g-in flex items-center gap-2 rounded-2xl bg-surface-2 py-2 pr-2 pl-4" data-testid="bridge-prompt">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Bygg bron på kinesiska</div>
              <div className="text-xl leading-tight font-black">”{round.sentence.sv}”</div>
            </div>
            <button type="button" aria-label="Lyssna på meningen" data-testid="bridge-listen"
              onClick={() => { void seq.current.replay(round.sentence.hanzi) }}
              className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_3px_0_var(--color-brand-dark)]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        <div ref={sceneRef} className="relative mx-1 mt-1 min-h-0 flex-1 overflow-hidden rounded-3xl" data-testid="bridge-scene">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          <div ref={pandaRef} className="pointer-events-none absolute top-0 left-0 will-change-transform" style={{ width: pandaSize, height: pandaSize, transformOrigin: '50% 92%', transform: 'translate3d(-999px,0,0)' }}>
            <Panda mood={mood} size={pandaSize} />
          </div>
          <div ref={layerRef} className="pointer-events-none absolute inset-0" />
          {count !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span key={count} className="g-pop text-8xl font-black text-ink drop-shadow-[0_4px_0_rgba(255,255,255,.7)]" data-testid="bridge-count">{count}</span>
            </div>
          )}
        </div>

        <div className="px-3 pt-2 pb-3">
          <div className="mb-1 text-center text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Välj nästa planka</div>
          <div key={round.index} className="g-in flex flex-wrap justify-center gap-2" data-testid="bridge-tiles">
            {round.tiles.map((t) => {
              const used = placedSet.has(t.id)
              const shake = wrongTile?.id === t.id
              return (
                <button key={`${t.id}-${shake ? wrongTile!.k : 0}`} type="button" disabled={used || locked} data-testid="bridge-tile"
                  onPointerDown={(e) => { e.preventDefault(); tap(t.id, t.text, e.currentTarget) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') tap(t.id, t.text, e.currentTarget) }}
                  className={`press min-h-12 min-w-14 rounded-2xl border-2 border-b-4 px-3.5 py-1.5 text-lg font-extrabold transition-opacity
                    ${used ? 'border-transparent bg-surface-2 opacity-30' : shake ? 'g-shake border-red-400 bg-danger-soft' : 'border-line bg-surface active:translate-y-0.5 active:border-b-2'}`}>
                  <PinyinText pinyin={t.text} colored={toneColors} />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </GameFrame>
  )
}
