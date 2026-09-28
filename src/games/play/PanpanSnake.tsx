// OWNER: Games agent. Pānpan Snake — grid snake on a canvas. Pānpan's face is the head, the body is bamboo.
// Game state lives in refs; the canvas is redrawn every frame without React renders (React only updates the HUD on events).
import { useEffect, useRef, useState } from 'react'
import { celebrate, haptic, replay } from '../../motion'
import { hasChineseVoice, PinyinText, playSfx, speak, stopSpeaking } from '../../speech'
import { AudioSequencer, browserAudioDeps } from '../logic/audioQueue'
import { AnswerTracker } from '../logic/session'
import {
  boardRows, opposite, placeTokens, SNAKE_COLS, SNAKE_LIVES, SNAKE_PROMPTS, SNAKE_START_LEN, SnakeDeck, snakeFinalBonus, snakePoints,
  spawnSnake, step, steer, swipeToDir, tickMs, type Cell, type Dir, type Snake, type SnakeRound, type Token,
} from '../logic/snake'
import type { RunnerItem } from '../logic/runner'
import { floatText, GameFrame, ScorePill, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'
import { readPalette, type Palette } from '../ui/runnerScene'
import { cellSize, drawSnakeScene, type SnakeView } from '../ui/snakeScene'
import { useCanvasView } from '../ui/useCanvas'
import { sentencesFor } from './Meningsbyggaren'

type Phase = 'countdown' | 'ready' | 'play' | 'result' | 'crash' | 'over'

interface Live {
  phase: Phase
  t: number
  time: number
  acc: number
  snake: Snake
  prev: Cell[]
  tokens: Token[]
  round: SnakeRound | null
  index: number
  rows: number
  lives: number
  score: number
  combo: number
  bestCombo: number
  right: number
  reveal: { good: string; bad: string | null } | null
  wasCorrect: boolean
  flash: number
  playMs: number
  countShown: number
  crashed: boolean
}

const COUNTDOWN_S = 3

export function PanpanSnake({ words, weights, extra, reduced, toneColors, onEnd, onExit }: GameProps) {
  const [paused, setPaused] = usePause()
  const [finished, setFinished] = useState(false)
  const deck = useRef<SnakeDeck>(null as unknown as SnakeDeck)
  if (!deck.current) deck.current = new SnakeDeck(words, extra, sentencesFor(words.map((w) => w.id)), Math.random, weights)
  const tracker = useRef(new AnswerTracker())
  const asked = useRef<RunnerItem[]>([])
  const seq = useRef<AudioSequencer>(null as unknown as AudioSequencer)
  if (!seq.current) seq.current = new AudioSequencer(browserAudioDeps((t) => speak(t), () => stopSpeaking(), () => hasChineseVoice()), { silentMs: 900 })
  const done = useRef(false)
  const live = useRef<Live>(null as unknown as Live)
  if (!live.current) {
    const snake = spawnSnake(SNAKE_START_LEN, SNAKE_COLS, 13)
    live.current = {
      phase: 'countdown', t: COUNTDOWN_S, time: 0, acc: 0, snake, prev: snake.body, tokens: [], round: null, index: 0, rows: 13,
      lives: SNAKE_LIVES, score: 0, combo: 0, bestCombo: 0, right: 0, reveal: null, wasCorrect: true, flash: 0, playMs: 0, countShown: 0, crashed: false,
    }
  }

  const [hud, setHud] = useState({ score: 0, lives: SNAKE_LIVES, n: 0, combo: 0 })
  const [prompt, setPrompt] = useState<RunnerItem | null>(null)
  const [count, setCount] = useState<number | null>(COUNTDOWN_S)
  const [reveal, setReveal] = useState<{ item: RunnerItem | null; crash?: 'wall' | 'self' } | null>(null)
  const [hint, setHint] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const palette = useRef<Palette | null>(null)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused })

  const view = useCanvasView(boardRef, canvasRef, (v) => {
    const L = live.current
    const rows = boardRows(v.w, v.h, SNAKE_COLS)
    if (L.phase === 'countdown' && rows !== L.rows) {
      L.rows = rows
      L.snake = spawnSnake(SNAKE_START_LEN, SNAKE_COLS, rows)
      L.prev = L.snake.body
    }
  })
  useEffect(() => { palette.current = readPalette() }, [])

  // Leaving the game (exit / restart) silences and invalidates all audio.
  useEffect(() => {
    const s = seq.current
    return () => { s.cancel(); stopSpeaking() }
  }, [])
  useEffect(() => { if (paused) seq.current.cancel() }, [paused])

  const finish = (completed: boolean) => {
    if (done.current) return
    done.current = true
    live.current.phase = 'over'
    setFinished(true)
    const L = live.current
    const bonus = snakeFinalBonus(L.lives, completed)
    const result = tracker.current.result(L.playMs)
    const practised: Practised[] = asked.current.flatMap((it) => {
      const r = tracker.current.firstResult(it.ref)
      return r === undefined ? [] : [{ key: it.key, hanzi: it.hanzi, pinyin: it.pinyin, sv: it.sv, correct: r }]
    })
    onEnd({
      score: L.score + bonus,
      result,
      practised,
      practisedLabel: 'Övade ord och fraser',
      headline: completed ? `Du klarade hela banan!${bonus ? ` +${bonus} livbonus` : ''}` : `Du åt dig ${Math.min(L.index + 1, SNAKE_PROMPTS)} av ${SNAKE_PROMPTS}`,
      stats: [
        { label: 'Rätt', value: `${L.right}/${asked.current.length}` },
        { label: 'Bästa kombo', value: String(L.bestCombo) },
        { label: 'Liv kvar', value: String(L.lives) },
      ],
    })
  }

  const layTokens = (round: SnakeRound) => {
    const L = live.current
    L.tokens = placeTokens(round.options, round.target.key, L.snake, SNAKE_COLS, L.rows)
  }

  const startRound = (index: number) => {
    const L = live.current
    const round = deck.current.next(index)
    L.index = index
    L.round = round
    L.reveal = null
    layTokens(round)
    if (!asked.current.some((a) => a.key === round.target.key)) asked.current.push(round.target)
    setPrompt(round.target)
    setReveal(null)
    setHud((h) => ({ ...h, n: index + 1 }))
  }

  const tokenCentre = (t: Token) => {
    const v = view.current
    const cell = cellSize({ w: v.w, h: v.h, cols: SNAKE_COLS, rows: live.current.rows })
    const ox = (v.w - cell * SNAKE_COLS) / 2
    const oy = (v.h - cell * live.current.rows) / 2
    return { x: ox + (t.x + t.w / 2) * cell, y: oy + (t.y + t.h / 2) * cell }
  }
  const boardOrigin = () => boardRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

  const eat = (token: Token) => {
    const L = live.current
    const round = L.round!
    const c = tokenCentre(token)
    if (token.correct) {
      L.combo += 1
      L.right += 1
      L.bestCombo = Math.max(L.bestCombo, L.combo)
      const pts = snakePoints(L.combo)
      L.score += pts
      L.wasCorrect = true
      L.reveal = { good: round.target.key, bad: null }
      tracker.current.record(round.target.ref, true)
      playSfx('correct')
      haptic('success')
      void seq.current.replay(round.target.hanzi)
      const b = boardOrigin()
      celebrate('burst', { origin: { x: b.left + c.x, y: b.top + c.y }, intensity: 0.7 })
      floatText(layerRef.current, c.x, c.y - 10, `+${pts}`)
      setHud({ score: L.score, lives: L.lives, n: L.index + 1, combo: L.combo })
      L.t = 0.55
    } else {
      L.combo = 0
      L.lives -= 1
      L.wasCorrect = false
      L.reveal = { good: round.target.key, bad: token.id }
      L.flash = reduced ? 0 : 0.6
      tracker.current.record(round.target.ref, false)
      deck.current.miss(round.target)
      playSfx('wrong')
      haptic('error')
      void seq.current.replay(round.target.hanzi)
      if (stageRef.current) replay(stageRef.current, 'shake')
      setReveal({ item: round.target })
      setHud({ score: L.score, lives: L.lives, n: L.index + 1, combo: 0 })
      L.t = 1.7
    }
    L.phase = 'result'
  }

  const crash = (cause: 'wall' | 'self') => {
    const L = live.current
    L.lives -= 1
    L.combo = 0
    L.flash = 0.6
    L.phase = 'crash'
    L.t = 1
    L.crashed = true
    playSfx('wrong')
    haptic('error')
    if (stageRef.current) replay(stageRef.current, 'shake')
    setReveal({ item: null, crash: cause })
    setHud((h) => ({ ...h, lives: L.lives, combo: 0 }))
  }

  const respawn = () => {
    const L = live.current
    const len = L.snake.body.length
    L.snake = spawnSnake(len, SNAKE_COLS, L.rows)
    L.prev = L.snake.body
    L.acc = 0
    L.crashed = false
    if (L.round) layTokens(L.round)
    L.phase = 'ready'
    setReveal(null)
    setHint(true)
  }

  // ── main loop ──────────────────────────────────────────────
  useGameLoop(paused || finished, (dt) => {
    const L = live.current
    const dtS = dt / 1000
    L.time += dtS
    L.playMs += dt
    if (L.flash > 0) L.flash = Math.max(0, L.flash - dtS)

    if (L.phase === 'countdown') {
      L.t -= dtS
      const n = Math.max(0, Math.ceil(L.t))
      if (n !== L.countShown) { L.countShown = n; setCount(n > 0 ? n : null) }
      if (L.t <= 0) { startRound(0); L.phase = 'ready'; setHint(true) }
    } else if (L.phase === 'play') {
      L.acc += dt
      const ms = tickMs(L.index)
      if (L.acc >= ms) {
        L.acc -= ms
        const res = step(L.snake, L.tokens, SNAKE_COLS, L.rows)
        if (res.kind === 'crash') { crash(res.cause) }
        else {
          L.prev = L.snake.body
          L.snake = res.snake
          if (res.kind === 'eat') { L.acc = 0; eat(res.token) }
        }
      }
    } else if (L.phase === 'result') {
      L.t -= dtS
      if (L.t <= 0) {
        if (L.lives <= 0) finish(false)
        else if (L.index + 1 >= SNAKE_PROMPTS) finish(true)
        else { startRound(L.index + 1); L.phase = 'play'; L.acc = 0 }
      }
    } else if (L.phase === 'crash') {
      L.t -= dtS
      if (L.t <= 0) { if (L.lives <= 0) finish(false); else respawn() }
    }
    render()
  })

  const render = () => {
    const cv = canvasRef.current
    const pal = palette.current
    if (!cv || !pal) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const { dpr, w, h } = view.current
    const L = live.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const v: SnakeView = { w, h, cols: SNAKE_COLS, rows: L.rows }
    const alpha = L.phase === 'play' && !reduced ? Math.min(1, L.acc / tickMs(L.index)) : 1
    const r = L.reveal
    drawSnakeScene(ctx, v, pal, {
      time: L.time,
      snake: L.snake,
      prev: L.prev,
      alpha,
      tokens: L.tokens,
      modeOf: (t) => !r ? 'normal' : t.id === r.good ? 'good' : t.id === r.bad ? 'bad' : 'dim',
      colored: toneColors,
      flash: L.flash,
      blink: L.phase === 'crash' || (L.phase === 'ready' && L.crashed),
      pulse: !reduced,
    })
  }

  // ── input ──────────────────────────────────────────────────
  const turn = (d: Dir) => {
    const L = live.current
    if (pausedRef.current || done.current) return
    if (L.phase === 'ready') {
      if (d === opposite(L.snake.dir)) return
      L.snake = { ...L.snake, dir: d, queue: [] }
      L.phase = 'play'
      L.acc = tickMs(L.index) * 0.6
      setHint(false)
      haptic('select')
    } else if (L.phase === 'play') {
      const next = steer(L.snake, d)
      if (next !== L.snake) { L.snake = next; haptic('select') }
    }
  }
  useEffect(() => {
    const keys: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const d = keys[e.key.toLowerCase()]
      if (d) { e.preventDefault(); turn(d) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dir = swipeToDir(e.clientX - d.x, e.clientY - d.y)
    if (dir) { turn(dir); d.x = e.clientX; d.y = e.clientY }
  }
  const onUp = () => { drag.current = null }

  const hudNode = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-0.5 text-2xl leading-none" aria-label={`${hud.lives} liv kvar`}>
        {Array.from({ length: SNAKE_LIVES }, (_, i) => <span key={i} className={i < hud.lives ? '' : 'opacity-25 grayscale'}>❤️</span>)}
      </div>
      <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-black text-ink-muted tabular-nums">
        {Math.max(1, hud.n)}/{SNAKE_PROMPTS}{hud.combo >= 2 ? ` · 🔥${hud.combo}` : ''}
      </span>
      <ScorePill score={hud.score} />
    </div>
  )

  const padBtn = (d: Dir, label: string, path: string, cls: string) => (
    <button type="button" aria-label={label} data-testid={`snake-pad-${d}`}
      onPointerDown={(e) => { e.preventDefault(); turn(d) }}
      className={`press flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-b-4 border-line bg-surface text-ink active:border-b-2 ${cls}`}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </button>
  )

  return (
    <GameFrame title="Pānpan Snake" paused={paused} setPaused={setPaused} reduced={reduced} hud={hudNode}
      onExit={() => { seq.current.cancel(); stopSpeaking(); onExit(tracker.current.answered ? tracker.current.result(live.current.playMs) : null) }}>
      <div className="flex h-full flex-col">
        <div className="px-3 pt-1">
          <div key={(prompt?.key ?? '') + hud.n} className="g-in rounded-2xl bg-surface-2 px-4 py-2 text-center" data-testid="snake-prompt">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">Ät rätt pinyin för</div>
            <div className="text-2xl leading-tight font-black">{prompt ? prompt.sv : '…'}</div>
          </div>
        </div>

        <div ref={stageRef} className="relative min-h-0 flex-1 touch-none overflow-hidden px-1 py-1" data-testid="snake-stage"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div ref={boardRef} className="relative h-full w-full">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            <div ref={layerRef} className="pointer-events-none absolute inset-0" />
            {reveal && (
              <div className="g-pop pointer-events-none absolute inset-x-3 top-2 rounded-2xl bg-danger px-4 py-2 text-center text-white shadow-lg" data-testid="snake-reveal">
                {reveal.item ? (
                  <>
                    <div className="text-xs font-extrabold uppercase tracking-wider opacity-90">Rätt svar:</div>
                    <PinyinText pinyin={reveal.item.pinyin} colored={false} className="text-xl font-black" />
                  </>
                ) : (
                  <div className="text-base font-black">{reveal.crash === 'wall' ? 'Aj! Du krockade med väggen' : 'Aj! Du åt dig själv'} – ett liv förlorat</div>
                )}
              </div>
            )}
            {hint && count === null && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center" data-testid="snake-hint">
                <span className="rounded-full bg-ink/80 px-4 py-1.5 text-sm font-black text-surface">Svep eller tryck en pil för att köra</span>
              </div>
            )}
            {count !== null && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span key={count} className="g-pop text-8xl font-black text-ink drop-shadow-[0_4px_0_rgba(255,255,255,.7)]" data-testid="snake-count">{count}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center pt-1 pb-3">
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Riktningar">
            <span />{padBtn('up', 'Upp', 'M6 15l6-6 6 6', 'col-start-2')}<span />
            {padBtn('left', 'Vänster', 'M15 6l-6 6 6 6', '')}
            {padBtn('down', 'Ner', 'M6 9l6 6 6-6', '')}
            {padBtn('right', 'Höger', 'M9 6l6 6-6 6', '')}
          </div>
        </div>
      </div>
    </GameFrame>
  )
}
