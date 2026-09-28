// OWNER: Games agent. Pānpan-språnget — pseudo-3D lane runner. Canvas scene + Panda overlay; game state lives in refs.
import { useEffect, useRef, useState } from 'react'
import { Panda, type PandaMood } from '../../mascot/Panda'
import { haptic } from '../../motion'
import { PinyinText, playSfx, speak, stopSpeaking } from '../../speech'
import {
  easeLane, gapSeconds, moveLane, nearY, project, resolveLane, RunnerDeck, runnerFinalBonus, runnerPoints, RUNNER_LIVES,
  RUNNER_PROMPTS, swipeDir, tapDir, worldSpeed, type Round, type RunnerItem, type View,
} from '../logic/runner'
import { AnswerTracker } from '../logic/session'
import { burst, floatText, GameFrame, ScorePill, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'
import { drawScene, readPalette, type Palette } from '../ui/runnerScene'
import { sentencesFor } from './Meningsbyggaren'

type Phase = 'countdown' | 'approach' | 'result' | 'over'

interface Live {
  phase: Phase
  t: number
  time: number
  groundZ: number
  index: number
  round: Round | null
  z: number
  lane: number
  laneX: number
  lives: number
  score: number
  combo: number
  bestCombo: number
  right: number
  reveal: { good: number; bad: number | null } | null
  wasCorrect: boolean
  shake: number
  playMs: number
  countShown: number
}

const COUNTDOWN_S = 3

export function PanpanRunner({ words, weights, extra, reduced, toneColors, onEnd, onExit }: GameProps) {
  const [paused, setPaused] = usePause()
  const [finished, setFinished] = useState(false)
  const deck = useRef<RunnerDeck>(null as unknown as RunnerDeck)
  if (!deck.current) deck.current = new RunnerDeck(words, extra, sentencesFor(words.map((w) => w.id)), Math.random, weights)
  const tracker = useRef(new AnswerTracker())
  const asked = useRef<RunnerItem[]>([])
  const live = useRef<Live>({
    phase: 'countdown', t: COUNTDOWN_S, time: 0, groundZ: 0, index: 0, round: null, z: 1, lane: 1, laneX: 1,
    lives: RUNNER_LIVES, score: 0, combo: 0, bestCombo: 0, right: 0, reveal: null, wasCorrect: true, shake: 0, playMs: 0, countShown: 0,
  })
  const done = useRef(false)

  const [hud, setHud] = useState({ score: 0, lives: RUNNER_LIVES, n: 0, combo: 0 })
  const [prompt, setPrompt] = useState<RunnerItem | null>(null)
  const [count, setCount] = useState<number | null>(COUNTDOWN_S)
  const [reveal, setReveal] = useState<{ text: RunnerItem; wall: boolean } | null>(null)
  const [mood, setMood] = useState<PandaMood>('happy')
  const [pandaSize, setPandaSize] = useState(110)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pandaRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const view = useRef<View & { dpr: number }>({ w: 375, h: 600, dpr: 1 })
  const palette = useRef<Palette | null>(null)
  const moodTimer = useRef<number | null>(null)

  // ── canvas size (DPR aware) ────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    const cv = canvasRef.current
    if (!el || !cv) return
    palette.current = readPalette()
    const fit = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      view.current = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr }
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      setPandaSize(Math.round(Math.min(130, Math.max(84, r.width * 0.3))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Leaving the game silences audio.
  useEffect(() => () => { stopSpeaking(); if (moodTimer.current) window.clearTimeout(moodTimer.current) }, [])

  const flashMood = (m: PandaMood, ms: number) => {
    setMood(m)
    if (moodTimer.current) window.clearTimeout(moodTimer.current)
    moodTimer.current = window.setTimeout(() => setMood('happy'), ms)
  }

  const finish = (completed: boolean) => {
    if (done.current) return
    done.current = true
    live.current.phase = 'over'
    setFinished(true)
    const L = live.current
    const bonus = runnerFinalBonus(L.lives, completed)
    const score = L.score + bonus
    const result = tracker.current.result(L.playMs)
    const practised: Practised[] = asked.current.flatMap((it) => {
      const r = tracker.current.firstResult(it.ref)
      return r === undefined ? [] : [{ key: it.key, hanzi: it.hanzi, pinyin: it.pinyin, sv: it.sv, correct: r }]
    })
    onEnd({
      score,
      result,
      practised,
      practisedLabel: 'Övade ord och fraser',
      headline: completed ? `Du klarade hela banan!${bonus ? ` +${bonus} livbonus` : ''}` : `Du kom ${L.index + 1 > RUNNER_PROMPTS ? RUNNER_PROMPTS : L.index + 1} portar långt`,
      stats: [
        { label: 'Rätt', value: `${L.right}/${asked.current.length}` },
        { label: 'Bästa kombo', value: String(L.bestCombo) },
        { label: 'Liv kvar', value: String(L.lives) },
      ],
    })
  }

  const startRound = (index: number) => {
    const L = live.current
    const round = deck.current.next(index)
    L.index = index
    L.round = round
    L.z = 1
    L.reveal = null
    L.phase = 'approach'
    if (!asked.current.some((a) => a.key === round.target.key)) asked.current.push(round.target)
    setPrompt(round.target)
    setReveal(null)
    setHud((h) => ({ ...h, n: index + 1 }))
  }

  const pandaXY = () => {
    const v = view.current
    const p = project(live.current.laneX, 0, v)
    return { x: p.x, y: nearY(v) }
  }

  const resolve = () => {
    const L = live.current
    const round = L.round!
    const res = resolveLane(round.gates, L.lane)
    const good = round.gates.find((g) => g.correct)!
    const { x, y } = pandaXY()
    if (res.kind === 'correct') {
      L.combo += 1
      L.right += 1
      L.bestCombo = Math.max(L.bestCombo, L.combo)
      const pts = runnerPoints(L.combo)
      L.score += pts
      L.wasCorrect = true
      L.reveal = { good: good.lane, bad: null }
      tracker.current.record(round.target.ref, true)
      playSfx('correct')
      haptic('success')
      void speak(round.target.hanzi)
      burst(layerRef.current, x, y - pandaSize * 0.6, { reduced, count: 18 })
      floatText(layerRef.current, x, y - pandaSize, `+${pts}`)
      flashMood('cheer', 900)
      setHud({ score: L.score, lives: L.lives, n: L.index + 1, combo: L.combo })
      L.t = gapSeconds(true)
    } else {
      L.combo = 0
      L.lives -= 1
      L.wasCorrect = false
      L.reveal = { good: good.lane, bad: res.kind === 'wrong' ? res.gate.lane : null }
      L.shake = reduced ? 0 : 0.45
      tracker.current.record(round.target.ref, false)
      deck.current.miss(round.target)
      playSfx('wrong')
      haptic('error')
      void speak(round.target.hanzi)
      flashMood('sad', 1500)
      setReveal({ text: round.target, wall: res.kind === 'wall' })
      setHud({ score: L.score, lives: L.lives, n: L.index + 1, combo: 0 })
      L.t = gapSeconds(false)
    }
    L.phase = 'result'
  }

  // ── main loop ──────────────────────────────────────────────
  useGameLoop(paused || finished, (dt) => {
    const L = live.current
    const dtS = dt / 1000
    L.time += dtS
    L.playMs += dt
    L.laneX = easeLane(L.laneX, L.lane, dtS)
    if (L.shake > 0) L.shake = Math.max(0, L.shake - dtS)

    if (L.phase === 'countdown') {
      L.t -= dtS
      L.groundZ += 0.12 * dtS
      const n = Math.max(0, Math.ceil(L.t))
      if (n !== L.countShown) { L.countShown = n; setCount(n > 0 ? n : null) }
      if (L.t <= 0) startRound(0)
    } else if (L.phase === 'approach') {
      const sp = worldSpeed(L.index) * dtS
      L.groundZ += sp
      L.z -= sp
      if (L.z <= 0) { L.z = 0; resolve() }
    } else if (L.phase === 'result') {
      const sp = worldSpeed(L.index) * dtS * (L.wasCorrect ? 1 : 0.35)
      L.groundZ += sp
      if (L.wasCorrect) L.z = Math.max(-0.09, L.z - sp)
      L.t -= dtS
      if (L.t <= 0) {
        L.round = null
        if (L.lives <= 0) finish(false)
        else if (L.index + 1 >= RUNNER_PROMPTS) finish(true)
        else startRound(L.index + 1)
      }
    }
    render()
  })

  const render = () => {
    const cv = canvasRef.current
    const pal = palette.current
    if (!cv || !pal) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { dpr, ...v } = view.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const L = live.current
    const shakeAmp = L.shake > 0 ? 9 * (L.shake / 0.45) : 0
    const showGates = L.round && (L.phase === 'approach' || L.phase === 'result')
    let alpha = 1
    if (L.phase === 'approach') alpha = Math.min(1, (1 - L.z) / 0.1)
    else if (L.phase === 'result') alpha = L.t < 0.35 ? Math.max(0, L.t / 0.35) : 1
    drawScene(ctx, v, pal, {
      groundZ: L.groundZ,
      time: L.time,
      laneX: L.laneX,
      gates: showGates && L.round
        ? L.round.gates.map((gate) => ({
            gate,
            mode: !L.reveal ? 'normal' : gate.lane === L.reveal.good ? 'good' : gate.lane === L.reveal.bad ? 'bad' : 'dim',
          }))
        : null,
      gateZ: L.z,
      gateAlpha: alpha,
      colored: toneColors,
      shakeX: shakeAmp ? Math.sin(L.time * 90) * shakeAmp : 0,
      shakeY: shakeAmp ? Math.cos(L.time * 70) * shakeAmp * 0.4 : 0,
      parallax: !reduced,
    })
    // runner overlay (transform only)
    const pe = pandaRef.current
    if (pe) {
      const { x, y } = pandaXY()
      const bob = reduced ? 0 : Math.abs(Math.sin(L.time * 11)) * 7
      const tilt = reduced ? 0 : (L.lane - L.laneX) * 9 + Math.sin(L.time * 11) * 2.5
      pe.style.transform = `translate3d(${x - pandaSize / 2}px, ${y - pandaSize * 0.92 - bob}px, 0) rotate(${tilt}deg)`
    }
  }

  // ── input ──────────────────────────────────────────────────
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused })
  const shift = (dir: -1 | 1) => {
    if (pausedRef.current || done.current) return
    const L = live.current
    const next = moveLane(L.lane, dir)
    if (next !== L.lane) { L.lane = next; haptic('select') }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') { e.preventDefault(); shift(-1) }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); shift(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const drag = useRef<{ id: number; x: number; y: number; sx: number; sy: number; swiped: boolean } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, swiped: false }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dir = swipeDir(e.clientX - d.x, e.clientY - d.y)
    if (dir !== 0) { shift(dir); d.x = e.clientX; d.y = e.clientY; d.swiped = true }
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || d.swiped) return
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 14) return
    const r = e.currentTarget.getBoundingClientRect()
    shift(tapDir(e.clientX - r.left, r.width))
  }

  const hearts = (
    <div className="flex items-center gap-0.5 text-2xl leading-none" aria-label={`${hud.lives} liv kvar`}>
      {Array.from({ length: RUNNER_LIVES }, (_, i) => (
        <span key={i} className={i < hud.lives ? '' : 'opacity-25 grayscale'}>❤️</span>
      ))}
    </div>
  )
  const hudNode = (
    <div className="flex items-center justify-between gap-2">
      {hearts}
      <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-black text-ink-muted tabular-nums">
        {Math.max(1, hud.n)}/{RUNNER_PROMPTS}{hud.combo >= 2 ? ` · 🔥${hud.combo}` : ''}
      </span>
      <ScorePill score={hud.score} />
    </div>
  )

  return (
    <GameFrame title="Pānpan-språnget" paused={paused} setPaused={setPaused} reduced={reduced} hud={hudNode}
      onExit={() => { stopSpeaking(); onExit(tracker.current.answered ? tracker.current.result(live.current.playMs) : null) }}>
      <div ref={containerRef} className="relative h-full w-full touch-none overflow-hidden" data-testid="runner-stage"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />

        {prompt && (
          <div key={prompt.key + hud.n} className="g-in pointer-events-none absolute inset-x-3 top-2 rounded-2xl bg-surface/90 px-4 py-2 text-center shadow-md" data-testid="runner-prompt">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Spring genom porten för</div>
            <div className="text-2xl leading-tight font-black">{prompt.sv}</div>
          </div>
        )}

        <div ref={pandaRef} className="pointer-events-none absolute top-0 left-0 will-change-transform" style={{ width: pandaSize, height: pandaSize, transformOrigin: '50% 92%', transform: 'translate3d(-999px,0,0)' }}>
          <Panda mood={mood} size={pandaSize} />
        </div>

        <div ref={layerRef} className="pointer-events-none absolute inset-0" />

        {reveal && (
          <div className="g-pop pointer-events-none absolute inset-x-4 top-24 rounded-2xl bg-danger px-4 py-2.5 text-center text-white shadow-lg" data-testid="runner-reveal">
            <div className="text-xs font-extrabold uppercase tracking-wider opacity-90">{reveal.wall ? 'Vägen var blockerad – rätt port:' : 'Rätt port:'}</div>
            <PinyinText pinyin={reveal.text.pinyin} colored={false} className="text-2xl font-black" />
          </div>
        )}

        {count !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span key={count} className="g-pop text-8xl font-black text-ink drop-shadow-[0_4px_0_rgba(255,255,255,.7)]" data-testid="runner-count">{count}</span>
          </div>
        )}
      </div>
    </GameFrame>
  )
}
