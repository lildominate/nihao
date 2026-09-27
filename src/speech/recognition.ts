// OWNER: Voice agent. Speech recognition (zh-CN) via the Web Speech API.
import type { SpokenCheck } from './score'
import { isIOS, stopSpeaking } from './tts'

// Minimal typings — the Web Speech recognition API is not in every TS DOM lib.
interface RecAlternative { transcript: string; confidence: number }
interface RecResult { readonly length: number; readonly isFinal: boolean; [i: number]: RecAlternative }
interface RecResultList { readonly length: number; [i: number]: RecResult }
interface RecEvent { results: RecResultList; resultIndex: number }
interface RecErrorEvent { error: string; message?: string }
interface Rec {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecEvent) => void) | null
  onerror: ((e: RecErrorEvent) => void) | null
  onend: (() => void) | null
  onaudiostart?: (() => void) | null
  onstart?: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecCtor = new () => Rec

function getCtor(): RecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Running as an installed home-screen app (iOS standalone / display-mode standalone). */
export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches
}

export function isRecognitionAvailable(): boolean {
  return !!getCtor() && (typeof window === 'undefined' || window.isSecureContext !== false)
}

/**
 * More detail than isRecognitionAvailable(): `unreliable` is true where recognition exists but
 * is known to be flaky (iOS — especially the home-screen app). UI may show a hint / offer "skip".
 */
export function recognitionSupport(): { available: boolean; unreliable: boolean; hint?: string } {
  const available = isRecognitionAvailable()
  if (!available) return { available, unreliable: false, hint: MESSAGES.unsupported }
  if (isIOS) {
    return {
      available,
      unreliable: true,
      hint: isStandalonePwa() ? IOS_STANDALONE_HINT : IOS_HINT,
    }
  }
  return { available, unreliable: false }
}

export type SpeechErrorCode = 'unsupported' | 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'aborted' | 'other'

/** Error thrown by listenAndCheck. `message` is Swedish and can be shown to the learner. */
export class SpeechError extends Error {
  code: SpeechErrorCode
  constructor(code: SpeechErrorCode, message: string) {
    super(message)
    this.name = 'SpeechError'
    this.code = code
  }
}

const IOS_HINT = 'På iPhone kräver taligenkänning att Diktering är på (Inställningar › Allmänt › Tangentbord › Aktivera diktering).'
const IOS_STANDALONE_HINT = IOS_HINT + ' Fungerar mikrofonen inte i hemskärmsappen – öppna appen i Safari i stället.'

const MESSAGES: Record<SpeechErrorCode, string> = {
  'unsupported': isIOS
    ? 'Taligenkänning är inte tillgänglig här. Uppdatera iOS eller öppna appen i Safari.'
    : 'Taligenkänning stöds inte i den här webbläsaren. Prova Chrome eller Safari.',
  'not-allowed': isIOS
    ? 'Mikrofonen eller taligenkänningen är blockerad. Tillåt mikrofon och taligenkänning för Safari (Inställningar › Appar › Safari) och se till att Diktering är på.'
    : 'Mikrofonen är blockerad. Tillåt mikrofonen i webbläsarens inställningar.',
  'no-speech': 'Jag hörde inget – tryck och prata lite högre.',
  'audio-capture': 'Ingen mikrofon hittades.',
  'network': 'Taligenkänningen behöver internetanslutning.',
  'aborted': 'Lyssningen avbröts.',
  'other': isIOS && isStandalonePwa()
    ? 'Taligenkänningen startade inte. I hemskärmsappen fungerar den ibland inte på iPhone – prova att öppna appen i Safari.'
    : 'Något gick fel med taligenkänningen. Försök igen.',
}

function mapError(err: string): SpeechError {
  const code: SpeechErrorCode =
    err === 'not-allowed' || err === 'service-not-allowed' ? 'not-allowed'
    : err === 'no-speech' ? 'no-speech'
    : err === 'audio-capture' ? 'audio-capture'
    : err === 'network' ? 'network'
    : err === 'aborted' ? 'aborted'
    : 'other'
  return new SpeechError(code, MESSAGES[code])
}

let active: { rec: Rec; cancel: () => void } | null = null

export function stopListening(): void {
  const a = active
  active = null
  a?.cancel()
}

/** Low-level: listen once and return up to 5 transcripts (best first). */
export function recognizeOnce(opts?: { timeoutMs?: number; lang?: string }): Promise<string[]> {
  const Ctor = getCtor()
  if (!Ctor) return Promise.reject(new SpeechError('unsupported', MESSAGES.unsupported))
  stopListening()
  stopSpeaking() // the mic must not hear our own TTS

  return new Promise<string[]>((resolve, reject) => {
    const rec = new Ctor()
    rec.lang = opts?.lang ?? 'zh-CN'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 5

    let transcripts: string[] | null = null
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(hardTimer)
      clearTimeout(startTimer)
      clearTimeout(silenceTimer)
      if (active?.rec === rec) active = null
      fn()
    }

    let started = false
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    const markStarted = () => { started = true }
    rec.onstart = markStarted
    rec.onaudiostart = markStarted

    rec.onresult = (e) => {
      markStarted()
      // Concatenate all results (one utterance may arrive split); alternatives of the last segment vary.
      const results = Array.from({ length: e.results.length }, (_, r) => e.results[r])
      if (!results.length) return
      const head = results.slice(0, -1).map((r) => r[0]?.transcript ?? '').join('')
      const last = results[results.length - 1]
      const list: string[] = []
      for (let k = 0; k < last.length; k++) {
        const t = (head + (last[k]?.transcript ?? '')).trim()
        if (t && !list.includes(t)) list.push(t)
      }
      if (!list.length) return
      transcripts = list
      clearTimeout(silenceTimer)
      if (results.every((r) => r.isFinal)) {
        settle(() => resolve(list))
        try { rec.stop() } catch { /* ignore */ }
      } else {
        // iOS keeps sending partial results and may never finalise on its own: stop after a pause
        silenceTimer = setTimeout(() => { try { rec.stop() } catch { /* ignore */ } }, 1200)
      }
    }
    rec.onerror = (e) => {
      // with a partial transcript in hand, prefer it over e.g. an iOS 'no-speech'/'aborted' at the end
      if (transcripts && e.error !== 'not-allowed' && e.error !== 'service-not-allowed') settle(() => resolve(transcripts!))
      else settle(() => reject(mapError(e.error)))
    }
    rec.onend = () => settle(() => (transcripts ? resolve(transcripts) : reject(mapError('no-speech'))))

    // Soft timeout: stop the mic (gives the engine a chance to deliver a result) …
    const timeoutMs = opts?.timeoutMs ?? 8000
    const timer = setTimeout(() => { try { rec.stop() } catch { /* ignore */ } }, timeoutMs)
    // … hard timeout: never hang, even if onend never fires (seen on iOS)
    const hardTimer = setTimeout(() => {
      settle(() => reject(mapError('no-speech')))
      try { rec.abort() } catch { /* ignore */ }
    }, timeoutMs + 2500)

    // iOS (esp. standalone): start() may silently do nothing. Detect and fail with a helpful message.
    // Generous, because the first start shows a permission prompt the user must answer.
    const startTimer = setTimeout(() => {
      if (!isIOS || started || settled) return
      settle(() => reject(mapError('other')))
      try { rec.abort() } catch { /* ignore */ }
    }, 12000)

    active = {
      rec,
      cancel: () => {
        settle(() => reject(mapError('aborted')))
        try { rec.abort() } catch { /* ignore */ }
      },
    }

    try {
      rec.start()
    } catch (err) {
      settle(() => reject(err instanceof Error && err.name === 'NotAllowedError' ? mapError('not-allowed') : mapError('other')))
    }
  })
}

/** Listen via mic (zh-CN) and compare to the expected item. Rejects (SpeechError) on permission/no-speech errors. */
export async function listenAndCheck(expected: { hanzi: string; pinyin: string }, opts?: { timeoutMs?: number }): Promise<SpokenCheck> {
  // pinyin-pro's dictionary is large: load it in parallel with listening, not in the main bundle
  const scorer = import('./score')
  scorer.catch(() => {})
  const transcripts = await recognizeOnce(opts)
  const { scoreAlternatives } = await scorer
  return scoreAlternatives(expected, transcripts)
}
