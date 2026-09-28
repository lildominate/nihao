// OWNER: Speech/Lab agent. Real-time pitch tracking from the microphone (getUserMedia + AnalyserNode + YIN).
import { getAudioContext, setAudioSessionType, unlockAudio } from '../sfx'
import { stopSpeaking } from '../tts'
import { stopListening } from '../recognition'
import type { PitchFrame, PitchRange } from './contour'
import { detectPitch, rms } from './yin'

export type MicErrorCode = 'unsupported' | 'insecure' | 'not-allowed' | 'no-mic' | 'other'

const MIC_MESSAGES: Record<MicErrorCode, string> = {
  unsupported: 'Den här webbläsaren kan inte använda mikrofonen för tonmätning.',
  insecure: 'Mikrofonen kräver en säker anslutning (https).',
  'not-allowed': 'Mikrofonen är blockerad. Tillåt mikrofonen (på iPhone: Inställningar › Appar › Safari › Mikrofon) och försök igen.',
  'no-mic': 'Ingen mikrofon hittades.',
  other: 'Mikrofonen startade inte. Försök igen.',
}

/** Error from startPitchTracking; `message` is Swedish and user-presentable. */
export class MicError extends Error {
  code: MicErrorCode
  constructor(code: MicErrorCode) {
    super(MIC_MESSAGES[code])
    this.name = 'MicError'
    this.code = code
  }
}

/** Can we track pitch from the mic here? */
export function pitchTrackingSupport(): { available: boolean; reason?: MicErrorCode; message?: string } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return { available: false, reason: 'unsupported', message: MIC_MESSAGES.unsupported }
  if (window.isSecureContext === false) return { available: false, reason: 'insecure', message: MIC_MESSAGES.insecure }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
  if (!navigator.mediaDevices?.getUserMedia || !AC) return { available: false, reason: 'unsupported', message: MIC_MESSAGES.unsupported }
  return { available: true }
}

export function isPitchTrackingAvailable(): boolean {
  return pitchTrackingSupport().available
}

export interface PitchTracker {
  /** Frames so far. */
  readonly frames: PitchFrame[]
  /** Stops the mic (releases it immediately — important on iOS) and returns all frames. */
  stop(): PitchFrame[]
  readonly stopped: boolean
}

export interface PitchTrackingOptions {
  /** Called for every analysed frame (~60/s). */
  onFrame?(frame: PitchFrame): void
  /** Called once when tracking ends by itself (silence after speech or maxMs). */
  onAutoStop?(frames: PitchFrame[]): void
  /** Hard limit, default 5000 ms. */
  maxMs?: number
  /** Stop after this much silence following speech (ms). Default 800. 0 = never. */
  silenceMs?: number
}

const PERM_KEY = 'nihao.micGranted'

/**
 * Starts tracking pitch from the microphone. MUST be called directly from a tap handler (iOS):
 * getUserMedia and AudioContext.resume() are invoked synchronously before the first await.
 * Rejects with MicError. The mic is released as soon as tracking stops.
 */
export function startPitchTracking(opts: PitchTrackingOptions = {}): Promise<PitchTracker> {
  const support = pitchTrackingSupport()
  if (!support.available) return Promise.reject(new MicError(support.reason ?? 'unsupported'))
  stopSpeaking()
  stopListening()
  // iOS: recording needs the play-and-record session; restored to 'playback' on stop.
  setAudioSessionType('play-and-record')
  let streamP: Promise<MediaStream>
  try {
    streamP = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 },
    })
  } catch (err) {
    setAudioSessionType('playback')
    return Promise.reject(mapErr(err))
  }
  const ctx = getAudioContext() // resumes inside the gesture
  unlockAudio()

  return streamP.then(
    (stream) => {
      try { localStorage.setItem(PERM_KEY, '1') } catch { /* private mode */ }
      if (!ctx) {
        stream.getTracks().forEach((t) => t.stop())
        setAudioSessionType('playback')
        throw new MicError('unsupported')
      }
      if (ctx.state !== 'running') void ctx.resume().catch(() => {})
      return track(ctx, stream, opts)
    },
    (err) => {
      setAudioSessionType('playback')
      throw mapErr(err)
    },
  )
}

function mapErr(err: unknown): MicError {
  if (err instanceof MicError) return err
  const name = (err as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return new MicError('not-allowed')
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return new MicError('no-mic')
  if (name === 'TypeError') return new MicError('unsupported')
  return new MicError('other')
}

function track(ctx: AudioContext, stream: MediaStream, opts: PitchTrackingOptions): PitchTracker {
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0
  // Safari only pulls audio through nodes that reach the destination: route via a muted gain.
  const mute = ctx.createGain()
  mute.gain.value = 0
  source.connect(analyser)
  analyser.connect(mute)
  mute.connect(ctx.destination)

  const buf = new Float32Array(analyser.fftSize)
  const bytes = new Uint8Array(analyser.fftSize)
  const hasFloat = typeof analyser.getFloatTimeDomainData === 'function'
  const frames: PitchFrame[] = []
  const t0 = performance.now()
  const maxMs = opts.maxMs ?? 5000
  const silenceMs = opts.silenceMs ?? 800
  const noise: number[] = []
  let gate = 0.01
  let voicedMs = 0
  let lastVoicedT = -1
  let lastT = -1
  let stopped = false
  let interval: ReturnType<typeof setInterval> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = (): PitchFrame[] => {
    if (stopped) return frames
    stopped = true
    clearInterval(interval)
    clearTimeout(timer)
    try { source.disconnect(); analyser.disconnect(); mute.disconnect() } catch { /* ignore */ }
    stream.getTracks().forEach((t) => t.stop())
    setAudioSessionType('playback')
    return frames
  }

  const tick = () => {
    if (stopped) return
    const t = performance.now() - t0
    if (t - lastT >= 10) {
      lastT = t
      if (hasFloat) analyser.getFloatTimeDomainData(buf)
      else {
        analyser.getByteTimeDomainData(bytes)
        for (let i = 0; i < bytes.length; i++) buf[i] = (bytes[i] - 128) / 128
      }
      const level = rms(buf)
      // adaptive noise gate from the first ~250 ms
      if (t < 250) {
        noise.push(level)
        const sorted = [...noise].sort((a, b) => a - b)
        gate = Math.max(0.006, Math.min(0.05, sorted[sorted.length >> 1] * 2.5))
      }
      let hz: number | null = null
      if (level >= gate) {
        const est = detectPitch(buf, ctx.sampleRate)
        if (est && est.clarity >= 0.6) hz = est.hz
      }
      const frame: PitchFrame = { t, hz, rms: level }
      frames.push(frame)
      if (hz !== null) {
        if (lastVoicedT >= 0 && t - lastVoicedT < 60) voicedMs += t - lastVoicedT
        lastVoicedT = t
      }
      opts.onFrame?.(frame)
      const silentAfterSpeech = silenceMs > 0 && voicedMs >= 150 && lastVoicedT >= 0 && t - lastVoicedT >= silenceMs
      if (silentAfterSpeech || t >= maxMs) {
        stop()
        opts.onAutoStop?.(frames)
        return
      }
    }
  }
  // A timer, not rAF: analysis must not stall when painting is throttled.
  interval = setInterval(tick, 16)
  // timers are throttled in background tabs: make sure the mic is always released
  timer = setTimeout(() => { if (!stopped) { stop(); opts.onAutoStop?.(frames) } }, maxMs + 1500)

  return {
    frames,
    stop,
    get stopped() { return stopped },
  }
}

// ─── Persisted pitch range (per device) ─────────────────────

const RANGE_KEY = 'nihao.pitchRange'

export function loadPitchRange(): PitchRange | null {
  try {
    const raw = localStorage.getItem(RANGE_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as PitchRange
    return Number.isFinite(r.low) && Number.isFinite(r.high) && r.high > r.low ? r : null
  } catch { return null }
}

export function savePitchRange(r: PitchRange | null): void {
  try {
    if (r) localStorage.setItem(RANGE_KEY, JSON.stringify({ low: +r.low.toFixed(2), high: +r.high.toFixed(2) }))
    else localStorage.removeItem(RANGE_KEY)
  } catch { /* ignore */ }
}
