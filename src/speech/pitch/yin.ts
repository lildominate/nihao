// OWNER: Speech/Lab agent. Hand-written YIN pitch detector (de Cheveigné & Kawahara 2002). Pure, unit tested.

export interface PitchEstimate {
  /** Fundamental frequency in Hz. */
  hz: number
  /** 0–1: 1 − the YIN aperiodicity at the chosen lag. > ~0.7 = clearly voiced. */
  clarity: number
}

export interface YinOptions {
  /** Lowest pitch searched (Hz). Default 65 (deep male voice). */
  minHz?: number
  /** Highest pitch searched (Hz). Default 500 (high female/child voice). */
  maxHz?: number
  /** Absolute threshold on the cumulative-mean-normalised difference. Default 0.15. */
  threshold?: number
  /** Below this RMS the frame counts as silence. Default 0.002. */
  minRms?: number
}

/** Root mean square of a buffer. */
export function rms(buf: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return buf.length ? Math.sqrt(sum / buf.length) : 0
}

/**
 * Low-passes and decimates to roughly 16 kHz (speech pitch lives well below 1 kHz), which keeps
 * YIN cheap enough for 60 fps on a phone. Also removes DC.
 */
function prepare(buf: ArrayLike<number>, sampleRate: number): { x: Float32Array; sr: number } {
  const factor = Math.max(1, Math.floor(sampleRate / 16000))
  const n = Math.floor(buf.length / factor)
  const x = new Float32Array(n)
  let mean = 0
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = 0; k < factor; k++) s += buf[i * factor + k]
    x[i] = s / factor
    mean += x[i]
  }
  mean /= n || 1
  for (let i = 0; i < n; i++) x[i] -= mean
  return { x, sr: sampleRate / factor }
}

/** Estimate the pitch of one frame (e.g. 2048 samples). Returns null for silence/unvoiced frames. */
export function detectPitch(buf: ArrayLike<number>, sampleRate: number, opts: YinOptions = {}): PitchEstimate | null {
  const minHz = opts.minHz ?? 65
  const maxHz = opts.maxHz ?? 500
  const threshold = opts.threshold ?? 0.15
  if (rms(buf) < (opts.minRms ?? 0.002)) return null

  const { x, sr } = prepare(buf, sampleRate)
  const n = x.length
  const tauMin = Math.max(2, Math.floor(sr / maxHz))
  const tauMax = Math.min(Math.ceil(sr / minHz), Math.floor(n / 2))
  if (tauMax <= tauMin + 2) return null
  const w = n - tauMax

  // 1–2. Difference function d(τ) and cumulative mean normalised difference d'(τ).
  const cmnd = new Float32Array(tauMax + 2)
  cmnd[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax + 1 && tau < n - w + 1; tau++) {
    let d = 0
    for (let j = 0; j < w; j++) {
      const diff = x[j] - x[j + tau]
      d += diff * diff
    }
    running += d
    cmnd[tau] = running > 0 ? (d * tau) / running : 1
  }
  const last = Math.min(tauMax, cmnd.length - 2)

  // 3. Absolute threshold: first dip below the threshold, walked down to its local minimum.
  let tau = -1
  for (let t = tauMin; t <= last; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= last && cmnd[t + 1] < cmnd[t]) t++
      tau = t
      break
    }
  }
  // No dip under the threshold: fall back to the global minimum (reported with low clarity).
  if (tau < 0) {
    let best = Infinity
    for (let t = tauMin; t <= last; t++) if (cmnd[t] < best) { best = cmnd[t]; tau = t }
    if (tau < 0 || best > 0.5) return null
  }

  // 4. Parabolic interpolation for sub-sample precision.
  let betterTau = tau
  if (tau > 1 && tau < last) {
    const s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1]
    const denom = s0 + s2 - 2 * s1
    if (Math.abs(denom) > 1e-12) {
      const shift = (s0 - s2) / (2 * denom)
      if (Math.abs(shift) < 1) betterTau = tau + shift
    }
  }
  const hz = sr / betterTau
  if (!Number.isFinite(hz) || hz < minHz * 0.9 || hz > maxHz * 1.1) return null
  return { hz, clarity: Math.max(0, Math.min(1, 1 - cmnd[tau])) }
}
