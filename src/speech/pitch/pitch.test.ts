import { describe, expect, it } from 'vitest'
import { detectPitch, rms } from './yin'
import {
  analyzeAttempt, classifyContour, cleanContour, hzToSt, idealContour, scoreTone, segmentSyllables,
  surfaceTones, toneTargets, updateRange, type PitchFrame, type PitchRange,
} from './contour'

const SR = 48000
const N = 2048

function sine(hz: number, sr = SR, n = N, amp = 0.5, harmonics = false): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const ph = (2 * Math.PI * hz * i) / sr
    out[i] = amp * (harmonics ? 0.6 * Math.sin(ph) + 0.3 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph) : Math.sin(ph))
  }
  return out
}

/** Phase-continuous glide as a single long signal (Hz as a function of time). */
function glide(f: (t: number) => number, seconds: number, sr = SR, harmonics = true): Float32Array {
  const n = Math.floor(seconds * sr)
  const out = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * f(i / sr)) / sr
    out[i] = 0.4 * (harmonics ? 0.6 * Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase) : Math.sin(phase))
  }
  return out
}

/** Runs the detector over a signal like the live tracker does (hop 10 ms). */
function track(signal: Float32Array, sr = SR, hopMs = 10): PitchFrame[] {
  const hop = Math.floor((sr * hopMs) / 1000)
  const frames: PitchFrame[] = []
  for (let start = 0; start + N <= signal.length; start += hop) {
    const buf = signal.subarray(start, start + N)
    const est = detectPitch(buf, sr)
    // time stamp = centre of the window
    frames.push({ t: ((start + N / 2) / sr) * 1000, hz: est && est.clarity > 0.6 ? est.hz : null, rms: rms(buf) })
  }
  return frames
}

describe('detectPitch (YIN)', () => {
  it.each([80, 110, 150, 220, 330, 440])('finds a %i Hz sine within 1 %', (hz) => {
    const est = detectPitch(sine(hz), SR)
    expect(est).not.toBeNull()
    expect(Math.abs(est!.hz - hz) / hz).toBeLessThan(0.01)
    expect(est!.clarity).toBeGreaterThan(0.85)
  })

  it('works at 44.1 kHz and with harmonics (no octave error)', () => {
    for (const hz of [100, 180, 260]) {
      const est = detectPitch(sine(hz, 44100, N, 0.5, true), 44100)
      expect(est).not.toBeNull()
      expect(Math.abs(est!.hz - hz) / hz).toBeLessThan(0.015)
    }
  })

  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull()
  })

  it('rejects white noise (null or low clarity)', () => {
    let seed = 1
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    const noise = new Float32Array(N).map(() => rnd() * 0.3)
    const est = detectPitch(noise, SR)
    expect(est === null || est.clarity < 0.6).toBe(true)
  })

  it('tracks a rising glide 150 → 250 Hz', () => {
    const frames = track(glide((t) => 150 + 100 * (t / 0.5), 0.5)).filter((f) => f.hz !== null)
    expect(frames.length).toBeGreaterThan(20)
    const first = frames[0].hz!, last = frames[frames.length - 1].hz!
    expect(first).toBeGreaterThan(145)
    expect(first).toBeLessThan(175)
    expect(last).toBeGreaterThan(225)
    expect(last).toBeLessThan(255)
    // (almost) monotonic
    let backwards = 0
    for (let i = 1; i < frames.length; i++) if (frames[i].hz! < frames[i - 1].hz! - 1) backwards++
    expect(backwards).toBeLessThan(2)
  })
})

describe('classifyContour', () => {
  const range: PitchRange = { low: 0, high: 10 } // 100 Hz … ~178 Hz
  const line = (from: number, to: number, n = 30) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))
  const dip = (a: number, lo: number, b: number, n = 30) => [...line(a, lo, Math.round(n * 0.6)), ...line(lo, b, n - Math.round(n * 0.6)).slice(1)]

  it('level high = tone 1', () => {
    expect(classifyContour(line(9, 9.3), range).shape).toBe('level')
  })
  it('rising = tone 2', () => {
    expect(classifyContour(line(4, 9), range).shape).toBe('rising')
  })
  it('rising with a small early dip is still tone 2', () => {
    expect(classifyContour([...line(5, 4.5, 6), ...line(4.5, 9.5, 24)], range).shape).toBe('rising')
  })
  it('dip = tone 3', () => {
    expect(classifyContour(dip(3, 0, 5), range).shape).toBe('dip')
  })
  it('low and flat = half-third (low)', () => {
    expect(classifyContour(line(2, 0.8), range).shape).toBe('low')
  })
  it('falling = tone 4', () => {
    expect(classifyContour(line(10, 2), range).shape).toBe('falling')
  })
  it('too short = unclear', () => {
    expect(classifyContour([1, 2], range).shape).toBe('unclear')
  })
  it('classifies without a range (shape only)', () => {
    expect(classifyContour(line(3, 3.2)).shape).toBe('level')
    expect(classifyContour(line(8, 1)).shape).toBe('falling')
  })

  it('end-to-end: synthetic glides through the detector get the right shape', () => {
    const cases: [(t: number) => number, string][] = [
      [() => 200, 'level'],
      [(t) => 150 + 110 * (t / 0.45), 'rising'],
      [(t) => 240 - 120 * (t / 0.45), 'falling'],
      [(t) => { const x = t / 0.45; return x < 0.6 ? 160 - 50 * (x / 0.6) : 110 + 70 * ((x - 0.6) / 0.4) }, 'dip'],
    ]
    for (const [f, shape] of cases) {
      const st = track(glide(f, 0.45)).filter((fr) => fr.hz !== null).map((fr) => hzToSt(fr.hz!))
      expect(classifyContour(cleanContour(st)).shape, shape).toBe(shape)
    }
  })
})

describe('scoreTone', () => {
  const range: PitchRange = { low: 0, high: 10 }
  const line = (from: number, to: number, n = 30) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1))
  it('praises a correct rising tone in Swedish', () => {
    const r = scoreTone(2, classifyContour(line(3, 9), range))
    expect(r.ok).toBe(true)
    expect(r.feedback).toBe('Bra! Stigande som en fråga.')
  })
  it('asks for a higher start on a low level tone 1', () => {
    const r = scoreTone(1, classifyContour(line(3.5, 3.7), range))
    expect(r.feedback).toMatch(/börja högre/i)
  })
  it('fails a rising contour for tone 4', () => {
    expect(scoreTone(4, classifyContour(line(3, 9), range)).ok).toBe(false)
  })
  it('accepts a low half-third inside a phrase', () => {
    expect(scoreTone(3, classifyContour(line(2, 0.8), range), { final: false }).score).toBe(100)
  })
})

describe('sandhi + targets', () => {
  it('3+3 → 2+3 (nǐ hǎo)', () => {
    expect(surfaceTones([3, 3], ['ni', 'hao'])).toEqual([2, 3])
    expect(toneTargets('nǐ hǎo').map((t) => t.surface)).toEqual([2, 3])
  })
  it('不 before a 4th tone → 2nd', () => {
    expect(surfaceTones([4, 4], ['bu', 'shi'], '不是')).toEqual([2, 4])
    expect(surfaceTones([4, 3], ['bu', 'hao'], '不好')).toEqual([4, 3])
  })
  it('一 sandhi', () => {
    expect(surfaceTones([1, 4], ['yi', 'ge'], '一个')).toEqual([2, 4])
    expect(surfaceTones([1, 1], ['yi', 'tian'], '一天')).toEqual([4, 1])
  })
  it('ideal contours stay in 0–1 and have the right direction', () => {
    const t2 = idealContour(2), t4 = idealContour(4)
    expect(t2[t2.length - 1]).toBeGreaterThan(t2[0])
    expect(t4[t4.length - 1]).toBeLessThan(t4[0])
    for (const t of [1, 2, 3, 4, 5] as const) for (const v of idealContour(t)) expect(v >= 0 && v <= 1).toBe(true)
  })
})

describe('segmentation + range', () => {
  const syl = (t0: number, ms: number, f: (x: number) => number): PitchFrame[] =>
    Array.from({ length: Math.round(ms / 10) }, (_, i) => ({ t: t0 + i * 10, hz: f(i / (ms / 10 - 1)), rms: 0.1 }))

  it('splits two syllables at the silent gap', () => {
    const frames = [...syl(0, 300, (x) => 120 + 80 * x), { t: 305, hz: null, rms: 0 }, ...syl(400, 300, (x) => 220 - 110 * x)]
    const segs = segmentSyllables(frames, 2)
    expect(segs).toHaveLength(2)
    expect(segs[0].to).toBeLessThan(400)
    expect(segs[1].from).toBeGreaterThanOrEqual(400)
  })

  it('splits a continuous run at the energy dip when there is no gap', () => {
    const frames = syl(0, 600, (x) => 150 + 30 * x).map((f, i) => ({ ...f, rms: Math.abs(i - 36) < 3 ? 0.02 : 0.1 }))
    const segs = segmentSyllables(frames, 2)
    expect(segs).toHaveLength(2)
    expect(Math.abs(segs[1].from - 350)).toBeLessThanOrEqual(40)
  })

  it('merges extra runs across the smallest gap', () => {
    const frames = [...syl(0, 200, () => 150), ...syl(260, 200, () => 150), ...syl(700, 200, () => 150)]
    expect(segmentSyllables(frames, 2)).toHaveLength(2)
  })

  it('range widens fast, never collapses below 6 st', () => {
    let r = updateRange(null, Array.from({ length: 20 }, () => 5))!
    expect(r.high - r.low).toBeGreaterThanOrEqual(6)
    for (let i = 0; i < 10; i++) r = updateRange(r, Array.from({ length: 20 }, () => 5))!
    expect(r.high - r.low).toBeGreaterThanOrEqual(6)
    r = updateRange(r, Array.from({ length: 20 }, (_, i) => 0 + i))!
    expect(r.high).toBeGreaterThan(12)
  })

  it('analyzeAttempt scores "nǐ hǎo" said as ní hǎo', () => {
    const frames = [
      ...syl(0, 280, (x) => 140 + 70 * x), // rising (sandhi 2nd)
      { t: 290, hz: null, rms: 0 }, { t: 330, hz: null, rms: 0 },
      ...syl(360, 360, (x) => (x < 0.6 ? 130 - 35 * (x / 0.6) : 95 + 50 * ((x - 0.6) / 0.4))), // dip
    ]
    const res = analyzeAttempt(frames, { pinyin: 'nǐ hǎo', hanzi: '你好' }, { low: hzToSt(90), high: hzToSt(90) + 11 })
    expect(res.syllables.map((s) => s.shape)).toEqual(['rising', 'dip'])
    expect(res.ok).toBe(true)
    expect(res.score).toBeGreaterThanOrEqual(85)
  })

  it('analyzeAttempt handles silence gracefully', () => {
    const res = analyzeAttempt([{ t: 0, hz: null, rms: 0 }], { pinyin: 'mā' }, null)
    expect(res.ok).toBe(false)
    expect(res.feedback).toMatch(/hörde/)
  })
})
