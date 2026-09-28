// OWNER: Games agent. Pānpan-språnget: pure logic (gates, speed curve, lane resolution, options, projection).
import type { ItemRef, Sentence, Word } from '../../types'
import { optionKey, pickOptions, svLabel, WordDeck } from './pool'
import { sentenceChunks } from './builder'
import { shuffle, type Rng } from './random'

export const LANES = 3
export const RUNNER_PROMPTS = 20
export const RUNNER_LIVES = 3
/** From this prompt index the run mixes in phrases/sentences. */
export const PHRASE_FROM = 8
/** From this prompt index there are three gates. */
export const THREE_GATES_FROM = 5
export const MAX_SENTENCE_PINYIN = 20

// ─── Difficulty curve ────────────────────────────────────────

/** 2 gates at the start, then 3. */
export function gateCount(index: number): 2 | 3 {
  return index < THREE_GATES_FROM ? 2 : 3
}

/** Seconds a gate row needs from the horizon to the runner. Starts calm, ends fast. */
export function approachSeconds(index: number): number {
  return Math.max(2.8, 4.8 - index * 0.11)
}

/** World speed in depth-units per second (a gate travels 1 unit from spawn to the runner). */
export function worldSpeed(index: number): number {
  return 1 / approachSeconds(index)
}

/** Pause between a resolved row and the next spawn (longer after a miss so the answer can be read). */
export function gapSeconds(wasCorrect: boolean): number {
  return wasCorrect ? 0.9 : 2
}

export function runnerPoints(combo: number): number {
  return 100 + 25 * Math.min(Math.max(combo - 1, 0), 8)
}

export function runnerFinalBonus(lives: number, completed: boolean): number {
  return completed ? lives * 50 : 0
}

// ─── Items (word or phrase) ─────────────────────────────────

export interface RunnerItem {
  key: string
  ref: ItemRef
  kind: 'word' | 'sentence'
  hanzi: string
  pinyin: string
  /** Swedish prompt. */
  sv: string
}

export const wordItem = (w: Word): RunnerItem => ({ key: `word:${w.id}`, ref: { kind: 'word', id: w.id }, kind: 'word', hanzi: w.hanzi, pinyin: w.pinyin, sv: svLabel(w) })
export const sentencePinyin = (s: Sentence): string => sentenceChunks(s).join(' ')
export const sentenceItem = (s: Sentence): RunnerItem => ({ key: `sentence:${s.id}`, ref: { kind: 'sentence', id: s.id }, kind: 'sentence', hanzi: s.hanzi, pinyin: sentencePinyin(s), sv: s.sv })

/** Sentences short enough to read on a gate. */
export function gateSentences(all: readonly Sentence[]): Sentence[] {
  return all.filter((s) => {
    const p = sentencePinyin(s)
    return p.length > 0 && p.length <= MAX_SENTENCE_PINYIN && sentenceChunks(s).length >= 2
  })
}

export interface Gate {
  lane: number
  item: RunnerItem
  correct: boolean
}

export interface Round {
  index: number
  target: RunnerItem
  gates: Gate[]
}

/** Which lanes carry gates (the rest are blocked by a barrier). */
export function gateLanes(count: number, rng: Rng = Math.random): number[] {
  if (count >= LANES) return [0, 1, 2]
  const pairs = [[0, 1], [1, 2], [0, 2]]
  return pairs[Math.floor(rng() * pairs.length) % pairs.length]
}

/** Options for a word target: `count` unique pinyin labels, target included. */
export function pickWordGateOptions(target: Word, pool: readonly Word[], extra: readonly Word[], count: number, rng: Rng = Math.random): Word[] {
  return pickOptions(target, pool, (w) => w.pinyin, count, rng, extra)
}

/** Options for a sentence target: other sentences with a different pinyin and meaning. */
export function pickSentenceGateOptions(target: Sentence, others: readonly Sentence[], count: number, rng: Rng = Math.random): Sentence[] {
  const seen = new Set([optionKey(sentencePinyin(target)), optionKey(target.sv)])
  const out: Sentence[] = [target]
  for (const s of shuffle(others, rng)) {
    if (out.length >= count) break
    const k = optionKey(sentencePinyin(s))
    const sv = optionKey(s.sv)
    if (seen.has(k) || seen.has(sv)) continue
    seen.add(k)
    seen.add(sv)
    out.push(s)
  }
  return shuffle(out, rng)
}

/** Build the gate row for a target item. `options` are the (already unique) items incl. the target. */
export function layoutGates(index: number, target: RunnerItem, options: readonly RunnerItem[], rng: Rng = Math.random): Round {
  const count = gateCount(index)
  const lanes = gateLanes(count, rng)
  const picked = shuffle([target, ...options.filter((r) => r.key !== target.key).slice(0, count - 1)], rng)
  const gates: Gate[] = picked.map((item, i) => ({ lane: lanes[i], item, correct: item.key === target.key }))
  return { index, target, gates }
}

/** Serves the run: words from the known pool (misses come back), phrases mixed in later. */
export class RunnerDeck {
  private readonly words: WordDeck
  private readonly byId = new Map<string, Word>()
  private readonly sentences: Sentence[]
  private sentenceQueue: Sentence[] = []
  private readonly rng: Rng
  private readonly pool: readonly Word[]
  private readonly extra: readonly Word[]
  private readonly lastKeys: string[] = []

  constructor(pool: readonly Word[], extra: readonly Word[], sentences: readonly Sentence[], rng: Rng = Math.random) {
    this.rng = rng
    this.pool = pool
    this.extra = extra
    this.words = new WordDeck(pool, rng)
    for (const w of [...extra, ...pool]) this.byId.set(w.id, w)
    this.sentences = gateSentences(sentences)
  }

  get canPhrase(): boolean { return this.sentences.length >= 3 }

  next(index: number): Round {
    const wantPhrase = index >= PHRASE_FROM && this.canPhrase && (index === PHRASE_FROM || this.rng() < 0.4)
    if (wantPhrase) {
      if (this.sentenceQueue.length === 0) this.sentenceQueue = shuffle(this.sentences, this.rng)
      let s = this.sentenceQueue.pop()!
      if (this.lastKeys.includes(`sentence:${s.id}`) && this.sentenceQueue.length) s = this.sentenceQueue.pop()!
      const opts = pickSentenceGateOptions(s, this.sentences, gateCount(index), this.rng)
      return this.remember(layoutGates(index, sentenceItem(s), opts.map(sentenceItem), this.rng))
    }
    let w = this.words.next()
    for (let i = 0; i < 3 && this.lastKeys.includes(`word:${w.id}`); i++) w = this.words.next()
    const opts = pickWordGateOptions(w, this.pool, this.extra, gateCount(index), this.rng)
    return this.remember(layoutGates(index, wordItem(w), opts.map(wordItem), this.rng))
  }

  private remember(r: Round): Round {
    this.lastKeys.push(r.target.key)
    if (this.lastKeys.length > 2) this.lastKeys.shift()
    return r
  }

  /** A missed word comes back a few prompts later. */
  miss(item: RunnerItem): void {
    if (item.kind !== 'word') return
    const w = this.byId.get(item.ref.id)
    if (w) this.words.miss(w)
  }
}

// ─── Lane resolution ─────────────────────────────────────────

export type Resolution = { kind: 'correct'; gate: Gate } | { kind: 'wrong'; gate: Gate } | { kind: 'wall' }

/** What happens when the row reaches the runner standing in `lane`. */
export function resolveLane(gates: readonly Gate[], lane: number): Resolution {
  const g = gates.find((x) => x.lane === lane)
  if (!g) return { kind: 'wall' }
  return g.correct ? { kind: 'correct', gate: g } : { kind: 'wrong', gate: g }
}

export const clampLane = (lane: number): number => Math.max(0, Math.min(LANES - 1, lane))
export const moveLane = (lane: number, dir: -1 | 1): number => clampLane(lane + dir)

/** Frame-rate independent easing of the displayed lane towards the target lane. */
export function easeLane(current: number, target: number, dtSec: number, rate = 14): number {
  const k = 1 - Math.exp(-rate * dtSec)
  const next = current + (target - current) * k
  return Math.abs(target - next) < 0.001 ? target : next
}

// ─── Swipe / tap input ───────────────────────────────────────

export const SWIPE_THRESHOLD = 28

/** Direction of a horizontal swipe, or 0 when it is too short / mostly vertical. */
export function swipeDir(dx: number, dy: number, threshold = SWIPE_THRESHOLD): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return 0
  return dx < 0 ? -1 : 1
}

/** Tap on the left / right half moves one lane. */
export function tapDir(x: number, width: number): -1 | 1 {
  return x < width / 2 ? -1 : 1
}

// ─── Perspective projection ──────────────────────────────────

export const PERSPECTIVE = 9
const CAM = 0.12
const raw = (z: number) => 1 / (1 + PERSPECTIVE * (z + CAM))
const NEAR = raw(0)

/** Scale of things at depth z (z = 0 → runner, scale 1; z = 1 → spawn; larger → horizon). */
export function depthScale(z: number): number {
  return raw(Math.max(z, -CAM + 0.02)) / NEAR
}

export interface View { w: number; h: number }
export interface Projected { x: number; y: number; scale: number }

export const horizonY = (v: View) => v.h * 0.3
export const nearY = (v: View) => v.h * 0.84
/** Half width of the road at the runner. */
export const roadHalf = (v: View) => v.w * 0.5

/** Screen position of `lane` (may be fractional; 1 = centre) at depth z. */
export function project(lane: number, z: number, v: View): Projected {
  const s = depthScale(z)
  const y = horizonY(v) + (nearY(v) - horizonY(v)) * s
  const off = ((lane - (LANES - 1) / 2) / LANES) * 2 * roadHalf(v)
  return { x: v.w / 2 + off * s, y, scale: s }
}
