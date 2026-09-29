// OWNER: Games agent. Pānpan Snake: pure logic (grid steps, collisions, token placement, difficulty curve, deck).
import type { Sentence, Word } from '../../types'
import { WordDeck } from './pool'
import { shuffle, type Rng } from './random'
import { gateSentences, pickSentenceGateOptions, pickWordGateOptions, runnerFinalBonus, runnerPoints, sentenceItem, wordItem, type RunnerItem } from './runner'
import type { Weights } from './weighting'

export const SNAKE_COLS = 11
export const SNAKE_MIN_ROWS = 9
export const SNAKE_MAX_ROWS = 15
export const SNAKE_PROMPTS = 15
export const SNAKE_LIVES = 3
export const SNAKE_START_LEN = 3
export const SNAKE_MIN_LEN = 2
/** After a crash the snake respawns at most this long (it must fit in the board). */
export const SNAKE_RESPAWN_MAX = 8
/** Prompt index from which there are four options. */
export const SNAKE_FOUR_FROM = 6
/** Prompt index from which short phrases are mixed in. */
export const SNAKE_PHRASE_FROM = 8
export const SNAKE_SWIPE_THRESHOLD = 18
/** Fresh tokens spawn at least this many cells (Manhattan) from the head. */
export const SNAKE_SPAWN_MIN_DIST = 4
export const SNAKE_BASE_MS = 420
export const SNAKE_MIN_MS = 240

export const snakePoints = runnerPoints
export const snakeFinalBonus = runnerFinalBonus

// ─── Difficulty curve ────────────────────────────────────────

/** 3 options at first, 4 later; phrases (wide tokens) never get more than 3. */
export function optionCount(index: number, phrase = false): 3 | 4 {
  return index >= SNAKE_FOUR_FROM && !phrase ? 4 : 3
}

/** Milliseconds per grid step: starts slow (420) and ramps gently (240 at the end). Calm mode never ramps. */
export function tickMs(index: number, calm = false): number {
  if (calm) return SNAKE_BASE_MS
  return Math.max(SNAKE_MIN_MS, Math.round(SNAKE_BASE_MS - index * 12.9))
}

/** Rows that fit a canvas of `w`×`h` at `cols` columns. */
export function boardRows(w: number, h: number, cols = SNAKE_COLS): number {
  const cell = w / cols
  return Math.max(SNAKE_MIN_ROWS, Math.min(SNAKE_MAX_ROWS, Math.floor(h / cell)))
}

// ─── Grid + movement ─────────────────────────────────────────

export interface Cell { x: number; y: number }
export type Dir = 'up' | 'down' | 'left' | 'right'

export const DIR_VEC: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
export const opposite = (d: Dir): Dir => OPP[d]

/** Direction of a swipe (dominant axis), or null when it is shorter than the threshold. */
export function swipeToDir(dx: number, dy: number, threshold = SNAKE_SWIPE_THRESHOLD): Dir | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
}

export interface Snake {
  /** Head first. */
  body: Cell[]
  dir: Dir
  /** Buffered turns (at most 2), consumed one per step. */
  queue: Dir[]
}

export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y

/** A straight snake in the centre column heading up, tail at the bottom. Length is capped to fit. */
export function spawnSnake(len: number, cols: number, rows: number): Snake {
  const n = Math.max(SNAKE_MIN_LEN, Math.min(len, SNAKE_RESPAWN_MAX, rows - 4))
  const x = Math.floor(cols / 2)
  const body: Cell[] = []
  for (let i = 0; i < n; i++) body.push({ x, y: rows - n + i })
  // head = highest cell (smallest y)
  body.sort((a, b) => a.y - b.y)
  return { body, dir: 'up', queue: [] }
}

/** Buffer a turn. Reversing into yourself and repeating the current heading are ignored. */
export function steer(s: Snake, d: Dir): Snake {
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir
  if (d === last || d === opposite(last) || s.queue.length >= 2) return s
  return { ...s, queue: [...s.queue, d] }
}

export interface Token {
  id: string
  item: RunnerItem
  correct: boolean
  x: number
  y: number
  w: number
  h: number
}

export function tokenCells(t: Pick<Token, 'x' | 'y' | 'w' | 'h'>): Cell[] {
  const out: Cell[] = []
  for (let dy = 0; dy < t.h; dy++) for (let dx = 0; dx < t.w; dx++) out.push({ x: t.x + dx, y: t.y + dy })
  return out
}

export const tokenAt = (tokens: readonly Token[], c: Cell): Token | undefined =>
  tokens.find((t) => c.x >= t.x && c.x < t.x + t.w && c.y >= t.y && c.y < t.y + t.h)

export type StepResult =
  | { kind: 'move'; snake: Snake }
  | { kind: 'eat'; snake: Snake; token: Token }
  | { kind: 'crash'; cause: 'wall' | 'self'; snake: Snake }

/**
 * One grid step. Eating the correct token grows the snake by one (the tail stays put);
 * eating a wrong one shrinks it by one (never below SNAKE_MIN_LEN). Walls and the body are a crash.
 */
export function step(s: Snake, tokens: readonly Token[], cols: number, rows: number): StepResult {
  const dir = s.queue[0] ?? s.dir
  const queue = s.queue.slice(1)
  const v = DIR_VEC[dir]
  const head = s.body[0]
  const next = { x: head.x + v.x, y: head.y + v.y }
  if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) return { kind: 'crash', cause: 'wall', snake: s }
  // the tail cell is free unless the snake grows this step; growth is decided by the token below
  const token = tokenAt(tokens, next)
  const growing = !!token?.correct
  const solid = growing ? s.body : s.body.slice(0, -1)
  if (solid.some((c) => sameCell(c, next))) return { kind: 'crash', cause: 'self', snake: s }
  const body = [next, ...s.body]
  if (!growing) body.pop()
  if (token && !token.correct && body.length > SNAKE_MIN_LEN) body.pop()
  const snake: Snake = { body, dir, queue }
  return token ? { kind: 'eat', snake, token } : { kind: 'move', snake }
}

// ─── Tokens ──────────────────────────────────────────────────

/** Token footprint in cells: short words 3×1, longer words 4×1, phrases 5×2 (text wraps). */
export function tokenSize(item: RunnerItem): { w: number; h: number } {
  const len = item.pinyin.length
  if (item.kind === 'sentence' || len > 11) return { w: 5, h: 2 }
  return len <= 6 ? { w: 3, h: 1 } : { w: 4, h: 1 }
}

interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect, m: number) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m
const hitsCell = (r: Rect, c: Cell, m: number) => c.x >= r.x - m && c.x < r.x + r.w + m && c.y >= r.y - m && c.y < r.y + r.h + m

/**
 * Put every option on the board: inside the walls, apart from each other, clear of the snake
 * and not in the first cells straight ahead of the head. Constraints relax if the board is crowded.
 */
export function placeTokens(items: readonly RunnerItem[], targetKey: string, snake: Snake, cols: number, rows: number, rng: Rng = Math.random): Token[] {
  const head = snake.body[0]
  const v = DIR_VEC[snake.dir]
  // the whole straight path ahead of the head, up to the wall
  const ahead: Cell[] = []
  for (let i = 1; i < Math.max(cols, rows); i++) {
    const c = { x: head.x + v.x * i, y: head.y + v.y * i }
    if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) break
    ahead.push(c)
  }
  const out: Token[] = []
  // biggest first: they are the hardest to place
  const order = [...items].sort((a, b) => tokenSize(b).w * tokenSize(b).h - tokenSize(a).w * tokenSize(a).h)
  for (const item of order) {
    const { w, h } = tokenSize(item)
    let placed: Rect | null = null
    for (const level of [0, 1, 2]) {
      const inset = level < 2 ? 1 : 0
      const gap = level === 0 ? 1 : 0
      const snakeMargin = level === 0 ? 1 : 0
      for (let tries = 0; tries < 160 && !placed; tries++) {
        const r: Rect = {
          x: inset + Math.floor(rng() * Math.max(1, cols - w - inset * 2 + 1)),
          y: inset + Math.floor(rng() * Math.max(1, rows - h - inset * 2 + 1)),
          w, h,
        }
        if (r.x + w > cols || r.y + h > rows) continue
        if (out.some((o) => overlaps(r, o, gap))) continue
        if (snake.body.some((c) => hitsCell(r, c, snakeMargin))) continue
        if (rectDistance(r, head) < SNAKE_SPAWN_MIN_DIST) continue
        if (level < 2 && ahead.some((c) => hitsCell(r, c, 0))) continue
        placed = r
      }
      if (placed) break
    }
    if (!placed) placed = scanFree({ w, h }, out, snake.body, cols, rows, head)
    out.push({ id: item.key, item, correct: item.key === targetKey, ...placed })
  }
  return items.map((it) => out.find((t) => t.id === it.key)!)
}

/** Manhattan distance from a cell to the nearest cell of a rectangle. */
export function rectDistance(r: Rect, c: Cell): number {
  const dx = Math.max(r.x - c.x, 0, c.x - (r.x + r.w - 1))
  const dy = Math.max(r.y - c.y, 0, c.y - (r.y + r.h - 1))
  return dx + dy
}

function scanFree(size: { w: number; h: number }, others: readonly Rect[], body: readonly Cell[], cols: number, rows: number, head: Cell): Rect {
  for (const minDist of [SNAKE_SPAWN_MIN_DIST, 2, 0]) {
    for (let y = 0; y + size.h <= rows; y++) {
      for (let x = 0; x + size.w <= cols; x++) {
        const r = { x, y, ...size }
        if (others.some((o) => overlaps(r, o, 0))) continue
        if (body.some((c) => hitsCell(r, c, 0))) continue
        if (rectDistance(r, head) < minDist) continue
        return r
      }
    }
  }
  // truly nowhere: stack at the top-left
  return { x: 0, y: 0, ...size }
}

// ─── Prompts ─────────────────────────────────────────────────

export interface SnakeRound {
  index: number
  target: RunnerItem
  /** Target + distractors, shuffled. */
  options: RunnerItem[]
}

/** Serves the run: weighted words from the known pool (misses come back), short phrases later. */
export class SnakeDeck {
  private readonly words: WordDeck
  private readonly byId = new Map<string, Word>()
  private readonly sentences: Sentence[]
  private sentenceQueue: Sentence[] = []
  private readonly lastKeys: string[] = []
  private readonly rng: Rng
  private readonly pool: readonly Word[]
  private readonly extra: readonly Word[]

  constructor(pool: readonly Word[], extra: readonly Word[], sentences: readonly Sentence[], rng: Rng = Math.random, weights?: Weights) {
    this.rng = rng
    this.pool = pool
    this.extra = extra
    this.words = new WordDeck(pool, rng, 3, weights)
    for (const w of [...extra, ...pool]) this.byId.set(w.id, w)
    this.sentences = gateSentences(sentences)
  }

  get canPhrase(): boolean { return this.sentences.length >= 3 }

  next(index: number): SnakeRound {
    const wantPhrase = index >= SNAKE_PHRASE_FROM && this.canPhrase && (index === SNAKE_PHRASE_FROM || this.rng() < 0.4)
    if (wantPhrase) {
      if (this.sentenceQueue.length === 0) this.sentenceQueue = shuffle(this.sentences, this.rng)
      let s = this.sentenceQueue.pop()!
      if (this.lastKeys.includes(`sentence:${s.id}`) && this.sentenceQueue.length) s = this.sentenceQueue.pop()!
      const opts = pickSentenceGateOptions(s, this.sentences, optionCount(index, true), this.rng)
      return this.remember({ index, target: sentenceItem(s), options: opts.map(sentenceItem) })
    }
    let w = this.words.next()
    for (let i = 0; i < 3 && this.lastKeys.includes(`word:${w.id}`); i++) w = this.words.next()
    const opts = pickWordGateOptions(w, this.pool, this.extra, optionCount(index), this.rng)
    return this.remember({ index, target: wordItem(w), options: opts.map(wordItem) })
  }

  private remember(r: SnakeRound): SnakeRound {
    this.lastKeys.push(r.target.key)
    if (this.lastKeys.length > 2) this.lastKeys.shift()
    return r
  }

  miss(item: RunnerItem): void {
    if (item.kind !== 'word') return
    const w = this.byId.get(item.ref.id)
    if (w) this.words.miss(w)
  }
}
