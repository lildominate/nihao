import { describe, expect, it } from 'vitest'
import { course } from '../../data/course'
import { isNextChunk, playableSentences, sentenceChunks } from './builder'
import { unitWordIds } from './pool'
import { seeded } from './random'
import {
  BRIDGE_CHUNKS, bridgeFinalBonus, bridgeLayout, bridgePoints, bridgeSentences, chunkHanzi, distractorCount, easeOutBack, fallOffset, flyPose,
  hopPose, hopSquash, makeBridgeRound, pickBridgeSentence, slotX,
} from './bridge'

const ids = unitWordIds(course, 0)
const sents = playableSentences(course, ids)
const all = playableSentences(course, Object.keys(course.words))
const byId = (id: string) => course.words[id]

describe('sentence choice', () => {
  it('bridges only use 2..6 chunk sentences', () => {
    for (const s of bridgeSentences(all)) {
      const n = sentenceChunks(s).length
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(6)
    }
  })
  it('follows the wanted length curve when unit 1 has such sentences', () => {
    const counts = new Set(bridgeSentences(sents).map((s) => sentenceChunks(s).length))
    for (let i = 0; i < BRIDGE_CHUNKS.length; i++) {
      const s = pickBridgeSentence(sents, i, undefined, seeded(i))
      const n = sentenceChunks(s).length
      if (counts.has(BRIDGE_CHUNKS[i])) expect(n).toBe(BRIDGE_CHUNKS[i])
      else expect(n).toBeGreaterThanOrEqual(2)
    }
  })
  it('does not repeat recent sentences when there is a choice', () => {
    const first = pickBridgeSentence(sents, 0, undefined, seeded(1))
    for (let s = 0; s < 20; s++) expect(pickBridgeSentence(sents, 0, undefined, seeded(s), [first.id]).id).not.toBe(first.id)
  })
  it('weights favour weak sentences', () => {
    const cand = bridgeSentences(sents).filter((s) => sentenceChunks(s).length === 2)
    const heavy = cand[0]
    const w: Record<string, number> = {}
    for (const s of cand) for (const id of s.wordIds) w[id] = 0.01
    for (const id of heavy.wordIds) w[id] = 100
    let hits = 0
    for (let s = 0; s < 60; s++) if (pickBridgeSentence(sents, 0, w, seeded(s)).wordIds.some((id) => heavy.wordIds.includes(id))) hits++
    expect(hits).toBeGreaterThan(45)
  })
})

describe('round', () => {
  it('tiles hold every chunk plus 2 (then 3) distractors', () => {
    const others = [...new Set(all.flatMap(sentenceChunks))]
    for (let i = 0; i < 6; i++) {
      const s = pickBridgeSentence(sents, i, undefined, seeded(i))
      const r = makeBridgeRound(i, s, others, byId, Object.values(course.words), seeded(i))
      expect(r.tiles.length).toBe(r.chunks.length + distractorCount(i))
      let placed = 0
      for (const c of r.chunks) {
        const t = r.tiles.find((x) => x.text === c)!
        expect(isNextChunk(s, placed, t.text)).toBe(true)
        placed++
      }
      expect(r.hanzi.length).toBe(r.chunks.length)
    }
    expect(distractorCount(0)).toBe(2)
    expect(distractorCount(5)).toBe(3)
  })
  it('finds hanzi for most chunks and keeps them in sentence order', () => {
    let known = 0
    let total = 0
    for (const s of all) {
      const chunks = sentenceChunks(s)
      const h = chunkHanzi(s, chunks, byId, Object.values(course.words))
      total += h.length
      known += h.filter(Boolean).length
      if (h.every(Boolean)) {
        const joined = h.join('')
        expect(s.hanzi.replace(/[，。？！、,.?!\s]/g, '')).toBe(joined)
      }
    }
    expect(known / total).toBeGreaterThan(0.85)
  })
})

describe('scoring', () => {
  it('doubles a flawless bridge and gives a life bonus only when completed', () => {
    expect(bridgePoints(3, 0)).toBe(240)
    expect(bridgePoints(3, 2)).toBe(120)
    expect(bridgeFinalBonus(2, true)).toBe(100)
    expect(bridgeFinalBonus(2, false)).toBe(0)
  })
})

describe('layout and animation', () => {
  it('gap shrinks planks for longer sentences but stays on screen', () => {
    const a = bridgeLayout(375, 300, 2)
    const b = bridgeLayout(375, 300, 6)
    expect(b.plankW).toBeLessThan(a.plankW)
    for (const l of [a, b]) {
      expect(l.gapL).toBeGreaterThan(40)
      expect(l.gapR).toBeLessThan(375 - 40)
    }
    expect(slotX(a, 0)).toBeGreaterThan(a.gapL)
    expect(slotX(a, 1)).toBeLessThan(a.gapR)
  })
  it('a plank flies from its start to its slot and overshoots gently', () => {
    const from = { x: 200, y: 400 }
    const to = { x: 100, y: 180 }
    expect(flyPose(0, from, to).x).toBeCloseTo(200)
    const end = flyPose(1, from, to)
    expect(end.x).toBeCloseTo(100)
    expect(end.y).toBeCloseTo(180)
    expect(end.rot).toBeCloseTo(0)
    expect(easeOutBack(0.8)).toBeGreaterThan(1)
  })
  it('a hop is an arc between two points', () => {
    const a = { x: 0, y: 100 }
    const b = { x: 60, y: 100 }
    expect(hopPose(0, a, b, 30)).toEqual(a)
    expect(hopPose(1, a, b, 30)).toEqual(b)
    expect(hopPose(0.5, a, b, 30).y).toBeCloseTo(70)
    expect(hopSquash(0.95)).toBeLessThan(1)
    expect(hopSquash(0.5)).toBeGreaterThan(1)
  })
  it('a cracked plank holds, then falls faster and fades', () => {
    expect(fallOffset(100, 300).dy).toBe(0)
    expect(fallOffset(900, 300).dy).toBeGreaterThan(fallOffset(600, 300).dy)
    expect(fallOffset(1500, 300).alpha).toBe(0)
  })
})
