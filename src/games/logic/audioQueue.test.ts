import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioSequencer, type AudioDeps } from './audioQueue'

function fake(hasVoice = true, speakMs = 1000) {
  const log: string[] = []
  let playing = 0
  let maxPlaying = 0
  const d: AudioDeps = {
    hasVoice: () => hasVoice,
    stop: () => { log.push('stop') },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
    speak: async (t) => {
      log.push(`start:${t}`)
      playing++
      maxPlaying = Math.max(maxPlaying, playing)
      if (hasVoice) await new Promise((r) => setTimeout(r, speakMs))
      playing--
      log.push(`end:${t}`)
    },
  }
  return { d, log, max: () => maxPlaying }
}

describe('AudioSequencer', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('plays queued cues one after another, never overlapping', async () => {
    const f = fake()
    const s = new AudioSequencer(f.d)
    void s.enqueue('a'); void s.enqueue('b'); void s.enqueue('c')
    await vi.advanceTimersByTimeAsync(3500)
    expect(f.log.filter((l) => !l.startsWith('stop'))).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c'])
    expect(f.max()).toBe(1)
    expect(s.busy).toBe(false)
  })

  it('idle() resolves only after everything has finished', async () => {
    const f = fake()
    const s = new AudioSequencer(f.d)
    void s.enqueue('a')
    let idle = false
    void s.idle().then(() => { idle = true })
    await vi.advanceTimersByTimeAsync(900)
    expect(idle).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(idle).toBe(true)
  })

  it('cancel stops audio and stale cues never start or trigger follow-ups', async () => {
    const f = fake()
    const s = new AudioSequencer(f.d)
    const a = s.enqueue('a')
    const b = s.enqueue('b')
    await vi.advanceTimersByTimeAsync(300)
    s.cancel()
    expect(f.log).toContain('stop')
    await vi.advanceTimersByTimeAsync(5000)
    expect(await a).toBe(false)
    expect(await b).toBe(false)
    expect(f.log).not.toContain('start:b')
    // a new cue after the cancel plays normally
    const c = s.enqueue('c')
    await vi.advanceTimersByTimeAsync(1100)
    expect(await c).toBe(true)
  })

  it('a new cue after cancel does not wait for the stale one', async () => {
    const f = fake()
    const s = new AudioSequencer(f.d)
    void s.enqueue('a')
    await vi.advanceTimersByTimeAsync(100)
    s.cancel()
    void s.enqueue('b')
    await vi.advanceTimersByTimeAsync(50)
    expect(f.log).toContain('start:b')
  })

  it('replay interrupts the current cue on purpose', async () => {
    const f = fake()
    const s = new AudioSequencer(f.d)
    void s.enqueue('a')
    await vi.advanceTimersByTimeAsync(200)
    const r = s.replay('a')
    await vi.advanceTimersByTimeAsync(1100)
    expect(await r).toBe(true)
  })

  it('without a voice each cue still holds the queue for the reading time', async () => {
    const f = fake(false)
    const s = new AudioSequencer(f.d, { silentMs: 1300 })
    const a = s.enqueue('a')
    void s.enqueue('b')
    await vi.advanceTimersByTimeAsync(1200)
    expect(f.log).toEqual(['start:a', 'end:a'])
    await vi.advanceTimersByTimeAsync(200)
    expect(await a).toBe(true)
    expect(f.log).toContain('start:b')
  })

  it('a stuck speak() cannot block the queue forever', async () => {
    const d: AudioDeps = { ...fake().d, speak: () => new Promise(() => undefined) }
    const s = new AudioSequencer(d, { maxMs: 2000 })
    const a = s.enqueue('a')
    await vi.advanceTimersByTimeAsync(2100)
    expect(await a).toBe(true)
    expect(s.busy).toBe(false)
  })
})
