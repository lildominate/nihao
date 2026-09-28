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
    // iOS 17+: Web Audio defaults to the "ambient" session, which the ring/silent switch mutes —
    // so the learner heard the TTS voice but never the correct/wrong feedback. "playback" makes
    // the effects audible like the voice (it may briefly duck other audio, e.g. music).
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session) try { session.type = 'playback' } catch { /* unsupported */ }
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
  primeElements()
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

// ─── <audio>-element path (primary on iOS) ─────────────────
// Learners still heard no "ding" on iPhone: WebAudio gets suspended/interrupted by TTS and
// backgrounding in ways resume() can't always recover. Plain <audio> elements playing
// pre-rendered WAVs are the most reliable way to make short UI sounds audible there.

const RATE = 22050
type Voice = { f: number; at: number; dur: number; wave: 'tri' | 'sine' | 'saw'; vol: number; bend?: number }

function renderWav(voices: Voice[], total: number, lowpassHz?: number): string {
  const n = Math.ceil(total * RATE)
  const buf = new Float32Array(n)
  for (const v of voices) {
    let phase = 0
    const start = Math.floor(v.at * RATE), len = Math.floor(v.dur * RATE)
    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / RATE
      const f = v.f * (v.bend ? 1 - v.bend * (t / v.dur) : 1)
      phase = (phase + f / RATE) % 1
      const w = v.wave === 'sine' ? Math.sin(2 * Math.PI * phase)
        : v.wave === 'saw' ? 2 * phase - 1
        : 1 - 4 * Math.abs(phase - 0.5)
      const env = Math.min(1, t / 0.008) * Math.exp(-5 * (t / v.dur))
      buf[start + i] += w * env * v.vol
    }
  }
  if (lowpassHz) {
    const a = 1 - Math.exp((-2 * Math.PI * lowpassHz) / RATE)
    let y = 0
    for (let i = 0; i < n; i++) { y += a * (buf[i] - y); buf[i] = y }
  }
  let peak = 0
  for (const x of buf) peak = Math.max(peak, Math.abs(x))
  const gain = peak > 0 ? 0.7 / peak : 0
  const bytes = new DataView(new ArrayBuffer(44 + n * 2))
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) bytes.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true)
  bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true)
  str(36, 'data'); bytes.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i] * gain)) * 0x7fff, true)
  return URL.createObjectURL(new Blob([bytes.buffer], { type: 'audio/wav' }))
}

const bellV = (f: number, at: number, dur: number, vol = 0.45): Voice[] => [
  { f, at, dur, wave: 'tri', vol },
  { f: f * 2, at, dur: dur * 0.6, wave: 'sine', vol: vol * 0.25 },
]

let elements: Partial<Record<Sfx, HTMLAudioElement>> | null = null
function getElements(): Partial<Record<Sfx, HTMLAudioElement>> | null {
  if (elements) return elements
  if (typeof window === 'undefined' || typeof Audio === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  try {
    const mk = (url: string) => { const a = new Audio(url); a.preload = 'auto'; return a }
    const arp = [523.25, 659.25, 783.99, 1046.5]
    elements = {
      correct: mk(renderWav([...bellV(783.99, 0, 0.18), ...bellV(1174.66, 0.09, 0.35)], 0.5)),
      wrong: mk(renderWav([
        { f: 155, at: 0, dur: 0.33, wave: 'saw', vol: 0.22, bend: 0.15 },
        { f: 158.5, at: 0, dur: 0.33, wave: 'saw', vol: 0.22, bend: 0.15 },
      ], 0.4, 600)),
      complete: mk(renderWav([
        ...arp.flatMap((f, i) => bellV(f, i * 0.1, 0.25, 0.4)),
        ...arp.map((f): Voice => ({ f, at: 0.45, dur: 0.8, wave: 'tri', vol: 0.16 })),
      ], 1.3)),
    }
  } catch { elements = null }
  return elements
}

let primed = false
/** Elements played for real — priming must not pause those (first tap may be the answer tap). */
const playedForReal = new Set<HTMLAudioElement>()
/** iOS only lets an <audio> element play later if it was first played inside a tap. */
function primeElements(): void {
  if (primed) return
  const els = getElements()
  if (!els) return
  primed = true
  for (const a of Object.values(els)) {
    if (!a) continue
    a.muted = true
    void a.play().then(() => { if (playedForReal.has(a)) return; a.pause(); a.currentTime = 0; a.muted = false }).catch(() => { a.muted = false; primed = false })
  }
}

function playElement(s: Sfx): boolean {
  const a = getElements()?.[s]
  if (!a) return false
  try {
    playedForReal.add(a)
    a.muted = false
    a.currentTime = 0
    void a.play().catch(() => {})
    return true
  } catch { return false }
}

export function playSfx(s: Sfx): void {
  // Feedback sounds go through <audio> (reliable on iOS); the tiny tap click stays on WebAudio.
  if (s !== 'tap' && playElement(s)) return
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

/** The shared AudioContext (created/resumed on demand — call inside a tap on iOS). Null without WebAudio. */
export function getAudioContext(): AudioContext | null {
  return getCtx()
}

/**
 * iOS 17+ audio session type. 'playback' (our default) keeps effects audible with the silent switch on;
 * switch to 'play-and-record' while the microphone is open, then back to 'playback'.
 */
export function setAudioSessionType(type: 'playback' | 'play-and-record'): void {
  if (typeof navigator === 'undefined') return
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
  if (session) try { session.type = type } catch { /* unsupported */ }
}
