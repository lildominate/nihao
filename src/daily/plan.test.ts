import { describe, expect, it } from 'vitest'
import { ENERGY, planDay, STEP_MINUTES } from './plan'
import type { DayContext } from './plan'

const full: DayContext = { dueCount: 12, hasNextLesson: true, knownWords: 40, hasDialogue: true, hasVideo: true, hasSong: true }
const minutes = (p: string[]) => p.reduce((n, s) => n + STEP_MINUTES[s as keyof typeof STEP_MINUTES], 0)

describe('Dagens pass', () => {
  it('starts with review when words are due', () => {
    expect(planDay('normal', 'surprise', full)[0]).toBe('review')
  })
  it('puts the craving right after review', () => {
    expect(planDay('normal', 'game', full).slice(0, 2)).toEqual(['review', 'game'])
    expect(planDay('normal', 'song', full).slice(0, 2)).toEqual(['review', 'song'])
  })
  it('fits the energy budget (± one step)', () => {
    for (const e of ['low', 'normal', 'high'] as const) {
      const p = planDay(e, 'surprise', full)
      expect(minutes(p)).toBeLessThanOrEqual(ENERGY[e].minutes + 5)
    }
    expect(planDay('high', 'surprise', full).length).toBeGreaterThan(planDay('low', 'surprise', full).length)
  })
  it('never repeats the same step back-to-back', () => {
    for (const e of ['low', 'normal', 'high'] as const) {
      const p = planDay(e, 'lesson', full)
      p.forEach((s, i) => { if (i) expect(s).not.toBe(p[i - 1]) })
    }
  })
  it('a brand-new learner gets the first lesson, no games or review', () => {
    const fresh: DayContext = { dueCount: 0, hasNextLesson: true, knownWords: 0, hasDialogue: false, hasVideo: true, hasSong: false }
    const p = planDay('low', 'game', fresh)
    expect(p[0]).toBe('lesson')
    expect(p).not.toContain('game')
    expect(p).not.toContain('review')
  })
  it('skips unavailable steps (no song lyrics → no song)', () => {
    expect(planDay('high', 'song', { ...full, hasSong: false })).not.toContain('song')
  })
})
