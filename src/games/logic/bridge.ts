// OWNER: Games agent. Pānpans bro: pure logic (sentence choice by length, tiles, per-chunk hanzi, layout, animation curves).
import type { Sentence, Word } from '../../types'
import { builderTiles, sentenceChunks, type Tile } from './builder'
import { optionKey } from './pool'
import type { Rng } from './random'
import { sentenceWeight, weightedPick, type Weights } from './weighting'

export const BRIDGE_ROUNDS = 6
export const BRIDGE_LIVES = 3
/** Wanted chunk count per bridge: short first, then longer gaps. */
export const BRIDGE_CHUNKS = [2, 2, 3, 3, 4, 5]
export const BRIDGE_MAX_CHUNKS = 6

export const distractorCount = (index: number): number => (index < 3 ? 2 : 3)

/** Sentences that fit on a bridge (2..6 chunks). */
export function bridgeSentences(all: readonly Sentence[]): Sentence[] {
  return all.filter((s) => {
    const n = sentenceChunks(s).length
    return n >= 2 && n <= BRIDGE_MAX_CHUNKS
  })
}

/** Pick a sentence whose chunk count is as close as possible to the wanted one (weighted, no repeats). */
export function pickBridgeSentence(all: readonly Sentence[], index: number, weights: Weights | undefined, rng: Rng, recent: readonly string[] = []): Sentence {
  const want = BRIDGE_CHUNKS[Math.min(index, BRIDGE_CHUNKS.length - 1)]
  const usable = bridgeSentences(all)
  const pool = usable.length ? usable : [...all]
  const fresh = pool.filter((s) => !recent.includes(s.id))
  const src = fresh.length ? fresh : pool
  let group: Sentence[] = []
  for (let d = 0; d <= BRIDGE_MAX_CHUNKS && group.length === 0; d++) {
    group = src.filter((s) => Math.abs(sentenceChunks(s).length - want) === d)
  }
  if (group.length === 0) group = src
  return weightedPick(group, (s) => (weights ? sentenceWeight(s, weights) : 1), (s) => s.id, rng, recent)
}

export interface BridgeRound {
  index: number
  sentence: Sentence
  chunks: string[]
  /** hanzi to speak for each chunk (null = unknown → only a sound effect). */
  hanzi: (string | null)[]
  tiles: Tile[]
}

const norm = (pinyin: string) => optionKey(pinyin).replace(/[\s'’-]/g, '')

/**
 * Hanzi for each pinyin chunk. Walks the sentence's words in order and joins as many as the chunk needs;
 * otherwise falls back to any word with the same pinyin. Pure: word lookup is injected.
 */
export function chunkHanzi(s: Sentence, chunks: readonly string[], byId: (id: string) => Word | undefined, all: readonly Word[] = []): (string | null)[] {
  const seq = s.wordIds.map(byId).filter((w): w is Word => !!w)
  let ptr = 0
  return chunks.map((chunk) => {
    const key = norm(chunk)
    // 1. consecutive words from the sentence that add up to the chunk
    let acc = ''
    let text = ''
    for (let i = ptr; i < seq.length; i++) {
      acc += norm(seq[i].pinyin)
      text += seq[i].hanzi
      if (acc === key) { ptr = i + 1; return text }
      if (!key.startsWith(acc)) break
    }
    // 2. any word of the sentence, then any known word, with that pinyin
    const hit = seq.find((w) => norm(w.pinyin) === key) ?? all.find((w) => norm(w.pinyin) === key)
    return hit ? hit.hanzi : null
  })
}

export function makeBridgeRound(index: number, s: Sentence, others: readonly string[], byId: (id: string) => Word | undefined, all: readonly Word[], rng: Rng): BridgeRound {
  const chunks = sentenceChunks(s)
  return { index, sentence: s, chunks, hanzi: chunkHanzi(s, chunks, byId, all), tiles: builderTiles(s, others, rng, distractorCount(index)) }
}

/** Points for a finished bridge: per plank, doubled when built without a slip. */
export function bridgePoints(chunks: number, mistakes: number): number {
  const base = chunks * 40
  return mistakes === 0 ? base * 2 : base
}

export const bridgeFinalBonus = (lives: number, completed: boolean): number => (completed ? lives * 50 : 0)

// ─── Layout ──────────────────────────────────────────────────

export interface BridgeLayout {
  groundY: number
  /** x where the left cliff ends / the right cliff begins. */
  gapL: number
  gapR: number
  plankW: number
  plankH: number
}

/** Cliffs get a little narrower for longer sentences so planks stay readable. */
export function bridgeLayout(w: number, h: number, planks: number): BridgeLayout {
  const side = Math.max(52, Math.min(96, w * 0.2) - Math.max(0, planks - 3) * 8)
  const gapL = side
  const gapR = w - side
  return { groundY: Math.round(h * 0.58), gapL, gapR, plankW: (gapR - gapL) / Math.max(1, planks), plankH: Math.min(30, Math.max(22, h * 0.09)) }
}

export const slotX = (l: BridgeLayout, i: number): number => l.gapL + l.plankW * (i + 0.5)

// ─── Animation curves (t in 0..1) ────────────────────────────

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3)
export const easeInOut = (t: number): number => { const c = clamp01(t); return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2 }
export function easeOutBack(t: number): number {
  const c = clamp01(t)
  const k = 1.70158
  return 1 + (k + 1) * Math.pow(c - 1, 3) + k * Math.pow(c - 1, 2)
}

export interface Pt { x: number; y: number }
export interface Pose extends Pt { rot: number; scale: number }

/** A plank flying from the tile bank to its slot: eased, with a small arc and a settling wobble. */
export function flyPose(t: number, from: Pt, to: Pt): Pose {
  const e = easeOutCubic(t)
  const arc = Math.sin(Math.PI * clamp01(t)) * 46
  return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) - arc, rot: lerp(-0.35, 0, easeOutBack(t)), scale: lerp(0.8, 1, easeOutBack(t)) }
}

/** A hop from `from` to `to`: linear-ish in x, parabola in y. */
export function hopPose(t: number, from: Pt, to: Pt, height: number): Pt {
  const c = clamp01(t)
  return { x: lerp(from.x, to.x, easeInOut(c)), y: lerp(from.y, to.y, c) - 4 * height * c * (1 - c) }
}

/** Squash & stretch on a hop: stretch while rising, squash on landing (scaleY). */
export function hopSquash(t: number): number {
  const c = clamp01(t)
  if (c > 0.85) return 1 - Math.sin(((c - 0.85) / 0.15) * Math.PI) * 0.12
  return 1 + Math.sin(c * Math.PI) * 0.06
}

/** A cracked plank falls: gravity after a short hold. */
export function fallOffset(t: number, holdMs: number, g = 1500): { dy: number; rot: number; alpha: number } {
  const s = Math.max(0, t - holdMs) / 1000
  return { dy: 0.5 * g * s * s, rot: s * 2.6, alpha: 1 - clamp01(s / 0.7) }
}

export const HOP_MS = 340
export const FLY_MS = 380
export const RUN_MS = 950
export const PAN_MS = 900
