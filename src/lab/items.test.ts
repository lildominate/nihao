import { describe, expect, it } from 'vitest'
import { course } from '../data/course'
import { handsfreeItems, shadowItems, shuffle, TONE_BASICS, toneItems } from './items'
import { guideInitials, guideFinals, TONES_GUIDE } from './guideData'

const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) }

describe('lab items', () => {
  it('tone items fall back to mā má mǎ mà + first-unit words when nothing is known', () => {
    const items = toneItems(course, [], 8, seeded())
    expect(items.slice(0, 4)).toEqual(TONE_BASICS)
    expect(items.length).toBe(8)
    expect(items.slice(4).every((i) => i.ref?.kind === 'word')).toBe(true)
  })

  it('tone items use known words when there are enough', () => {
    const known = course.units[1].lessons.flatMap((l) => l.newWords)
    const items = toneItems(course, known, 6, seeded())
    expect(items).toHaveLength(6)
    expect(items.every((i) => i.ref && known.includes(i.ref.id))).toBe(true)
  })

  it('shadow items only use known words (or unit 1 as fallback)', () => {
    const u1 = course.units[0].lessons.flatMap((l) => l.sentences)
    expect(shadowItems(course, [], 5, seeded()).every((i) => u1.includes(i.ref!.id))).toBe(true)
    const known = course.units.slice(0, 3).flatMap((u) => u.lessons.flatMap((l) => l.newWords))
    for (const it of shadowItems(course, known, 6, seeded())) {
      const s = course.sentences[it.ref!.id]
      expect(s.wordIds.every((w) => known.includes(w)) || u1.includes(s.id)).toBe(true)
    }
  })

  it('hands-free unit source interleaves words and sentences', () => {
    const items = handsfreeItems(course, [], { kind: 'unit', unitId: course.units[0].id })
    expect(items.some((i) => i.ref?.kind === 'word')).toBe(true)
    expect(items.some((i) => i.ref?.kind === 'sentence')).toBe(true)
    expect(items.every((i) => i.hanzi && i.pinyin && i.sv)).toBe(true)
  })

  it('shuffle keeps all elements', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded()).sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('pronunciation guide data', () => {
  it('has all 23 initials incl. y and w, each with an example', () => {
    const ids = guideInitials.map((i) => i.symbol)
    for (const s of 'b p m f d t n l g k h j q x zh ch sh r z c s y w'.split(' ')) expect(ids).toContain(s)
    expect(guideInitials.every((i) => i.hanzi && i.example && i.sv)).toBe(true)
  })
  it('finals have hanzi examples and tones cover 1–4 + neutral', () => {
    expect(guideFinals.length).toBeGreaterThan(30)
    expect(guideFinals.every((f) => [...f.hanzi].length === 1)).toBe(true)
    expect(TONES_GUIDE.map((t) => t.tone)).toEqual([1, 2, 3, 4, 5])
  })
})
