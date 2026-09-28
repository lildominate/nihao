// OWNER: Speech/Lab agent. React hook: record the mic, show a live trace, analyse tones against a target.
import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeAttempt, cleanContour, hzToSt, normalizeSt, type AttemptResult, type PitchFrame, type PitchRange } from './pitch/contour'
import { loadPitchRange, MicError, pitchTrackingSupport, savePitchRange, startPitchTracking, type PitchTracker } from './pitch/mic'
import type { LivePoint } from './ToneCanvas'

export type ToneRecorderState = 'idle' | 'starting' | 'recording' | 'done'

/** Suggested max recording length for a target of `syllables` syllables. */
export function recordingMs(syllables: number): number {
  return Math.min(9000, 1800 + syllables * 650)
}

export function useToneRecorder(target: { pinyin: string; hanzi?: string } | null, opts?: { maxMs?: number }) {
  const [state, setState] = useState<ToneRecorderState>('idle')
  const [live, setLive] = useState<LivePoint[] | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tracker = useRef<PitchTracker | null>(null)
  const mounted = useRef(true)
  const targetRef = useRef(target)
  const seq = useRef(0)
  useEffect(() => { targetRef.current = target })

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; tracker.current?.stop(); tracker.current = null }
  }, [])

  // reset when the target changes
  const key = target ? `${target.pinyin}|${target.hanzi ?? ''}` : ''
  useEffect(() => {
    seq.current++
    tracker.current?.stop()
    tracker.current = null
    setState('idle'); setLive(null); setResult(null); setError(null)
  }, [key])

  const finish = useCallback((frames: PitchFrame[], my: number) => {
    if (!mounted.current || my !== seq.current) return
    tracker.current = null
    const t = targetRef.current
    if (!t) { setState('idle'); return }
    const res = analyzeAttempt(frames, t, loadPitchRange())
    if (res.range) savePitchRange(res.range)
    setResult(res)
    setLive(null)
    setState('done')
  }, [])

  /** Start recording. Call DIRECTLY from a tap handler (iOS). Toggles: a second call stops. */
  const start = useCallback(() => {
    if (tracker.current) { const my = seq.current; finish(tracker.current.stop(), my); return }
    const t = targetRef.current
    if (!t) return
    const my = ++seq.current
    setError(null); setResult(null); setLive([]); setState('starting')
    const range: PitchRange = loadPitchRange() ?? { low: -2, high: 14 } // rough default until calibrated
    const syllables = t.pinyin.split(/\s+/).filter((s) => /\p{L}/u.test(s)).length
    const pts: LivePoint[] = []
    const recent: number[] = []
    let lastPush = 0
    startPitchTracking({
      maxMs: opts?.maxMs ?? recordingMs(syllables),
      silenceMs: syllables > 2 ? 1000 : 750,
      onFrame: (f) => {
        if (f.hz === null) { pts.push({ t: f.t, v: null }); recent.length = 0 }
        else {
          recent.push(hzToSt(f.hz)); if (recent.length > 5) recent.shift()
          const sm = cleanContour(recent)
          pts.push({ t: f.t, v: normalizeSt(sm[sm.length - 1] ?? hzToSt(f.hz), range) })
        }
        if (f.t - lastPush > 33 && mounted.current && my === seq.current) { lastPush = f.t; setLive([...pts]) }
      },
      onAutoStop: (frames) => finish(frames, my),
    }).then(
      (tr) => {
        if (!mounted.current || my !== seq.current) { tr.stop(); return }
        tracker.current = tr
        setState('recording')
      },
      (err) => {
        if (!mounted.current || my !== seq.current) return
        setError(err instanceof MicError ? err.message : 'Mikrofonen startade inte. Försök igen.')
        setLive(null)
        setState('idle')
      },
    )
  }, [finish, opts?.maxMs])

  const reset = useCallback(() => {
    seq.current++
    tracker.current?.stop(); tracker.current = null
    setState('idle'); setLive(null); setResult(null); setError(null)
  }, [])

  return { state, live, result, error, start, reset, support: pitchTrackingSupport() }
}
