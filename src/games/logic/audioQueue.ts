// OWNER: Games agent. Audio sequencer (pure, injectable): one word at a time, never cut off,
// stale promises never trigger follow-ups (epoch token), readable pause when there is no TTS voice.

export interface AudioDeps {
  /** Speaks and resolves when finished (may resolve immediately without a voice). */
  speak(text: string): Promise<void>
  /** Stops current speech immediately. */
  stop(): void
  hasVoice(): boolean
  sleep(ms: number): Promise<void>
  now(): number
}

export interface AudioOptions {
  /** Minimum time a cue occupies when there is no voice (reading time). */
  silentMs?: number
  /** Safety cap so a stuck speak() can never block the game. */
  maxMs?: number
}

export class AudioSequencer {
  private epoch = 0
  private tail: Promise<void> = Promise.resolve()
  private pending = 0
  private waiters: (() => void)[] = []
  private readonly silentMs: number
  private readonly maxMs: number

  private readonly d: AudioDeps

  constructor(d: AudioDeps, opts: AudioOptions = {}) {
    this.d = d
    this.silentMs = opts.silentMs ?? 1300
    this.maxMs = opts.maxMs ?? 6000
  }

  get busy(): boolean { return this.pending > 0 }
  get token(): number { return this.epoch }

  /**
   * Queue a cue: it starts only after everything queued before it has finished.
   * Resolves true if it played to the end in the same epoch, false if it was cancelled.
   */
  enqueue(text: string): Promise<boolean> {
    const my = this.epoch
    this.pending++
    const run = this.tail.then(async () => {
      if (my !== this.epoch) return false
      const t0 = this.d.now()
      const voice = this.d.hasVoice()
      await Promise.race([this.d.speak(text).catch(() => undefined), this.d.sleep(this.maxMs)])
      if (my !== this.epoch) return false
      if (!voice) {
        const rest = this.silentMs - (this.d.now() - t0)
        if (rest > 0) await this.d.sleep(rest)
      }
      return my === this.epoch
    })
    this.tail = run.then(() => undefined, () => undefined)
    return run.finally(() => {
      if (my !== this.epoch) return // stale: cancel() already reset the counter
      this.pending = Math.max(0, this.pending - 1)
      if (this.pending === 0) this.flush()
    })
  }

  /** Cancel everything (exit / restart / pause): stops audio, invalidates queued and playing cues. */
  cancel(): void {
    this.epoch++
    this.tail = Promise.resolve()
    this.pending = 0
    this.d.stop()
    this.flush()
  }

  /** Cancel then play (an explicit "listen again" from the player). */
  replay(text: string): Promise<boolean> {
    this.cancel()
    return this.enqueue(text)
  }

  /** Resolves once nothing is queued or playing (or when cancelled). */
  idle(): Promise<void> {
    if (this.pending === 0) return Promise.resolve()
    return new Promise((res) => this.waiters.push(res))
  }

  private flush() {
    const w = this.waiters
    this.waiters = []
    for (const f of w) f()
  }
}

/** Real dependencies wired by the game component. */
export function browserAudioDeps(speak: (t: string) => Promise<void>, stop: () => void, hasVoice: () => boolean): AudioDeps {
  return { speak, stop, hasVoice, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => performance.now() }
}
