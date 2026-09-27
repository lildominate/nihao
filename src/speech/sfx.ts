// OWNER: Voice agent. Synthesised UI sound effects (WebAudio, no files).

export type Sfx = 'correct' | 'wrong' | 'complete' | 'tap'

type Ctx = AudioContext
let ctx: Ctx | null = null
let master: GainNode | null = null

function getCtx(): Ctx | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.35
      master.connect(ctx.destination)
    } catch { ctx = null; return null }
  }
  // iOS may leave the context 'suspended' or 'interrupted' (after backgrounding / calls)
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})
  return ctx
}

/** Resume the AudioContext from a user gesture (iOS). */
export function unlockAudio(): void {
  const c = getCtx()
  if (!c || !master) return
  // play one silent sample — required by older iOS to unlock output
  const buf = c.createBuffer(1, 1, 22050)
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(master)
  src.start(0)
}

function tone(c: Ctx, freq: number, start: number, dur: number, opts: { type?: OscillatorType; vol?: number; attack?: number; endFreq?: number } = {}) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, start)
  if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, start + dur)
  const vol = opts.vol ?? 0.5
  const attack = opts.attack ?? 0.008
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(vol, start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g)
  g.connect(master!)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** Bell-ish note: fundamental + soft octave partial. */
function bell(c: Ctx, freq: number, start: number, dur: number, vol = 0.45) {
  tone(c, freq, start, dur, { type: 'triangle', vol })
  tone(c, freq * 2, start, dur * 0.6, { type: 'sine', vol: vol * 0.25 })
}

export function playSfx(s: Sfx): void {
  const c = getCtx()
  if (!c || !master) return
  const t = c.currentTime + 0.01
  switch (s) {
    case 'correct':
      bell(c, 783.99, t, 0.18)          // G5
      bell(c, 1174.66, t + 0.09, 0.35)  // D6
      break
    case 'wrong': {
      // low, soft, slightly detuned buzz through a lowpass
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 600
      lp.connect(master)
      for (const f of [155, 158.5]) {
        const osc = c.createOscillator()
        const g = c.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, t)
        osc.frequency.linearRampToValueAtTime(f * 0.85, t + 0.3)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
        g.gain.setValueAtTime(0.22, t + 0.12)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
        osc.connect(g); g.connect(lp)
        osc.start(t); osc.stop(t + 0.35)
      }
      break
    }
    case 'complete': {
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
      notes.forEach((f, i) => bell(c, f, t + i * 0.1, 0.25, 0.4))
      const end = t + notes.length * 0.1 + 0.05
      for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(c, f, end, 0.8, { type: 'triangle', vol: 0.16, attack: 0.02 })
      break
    }
    case 'tap':
      tone(c, 1400, t, 0.045, { type: 'sine', vol: 0.25, attack: 0.002, endFreq: 900 })
      break
  }
}
