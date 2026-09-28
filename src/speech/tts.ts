// OWNER: Voice agent. Text-to-speech via the Web Speech API (zh-CN).

const synth: SpeechSynthesis | undefined =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isAndroid = /Android/i.test(ua)
const isChromeDesktop = /Chrome\//.test(ua) && !isAndroid && !/Edg\//.test(ua)
/** iPhone/iPad (iPadOS reports as Mac with touch). */
export const isIOS = /iPad|iPhone|iPod/.test(ua) ||
  (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let defaultRate = 0.85
let voice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

/** Sets the default speech rate (0.5–1.2), e.g. from settings.speechRate. */
export function setDefaultSpeechRate(rate: number): void {
  if (Number.isFinite(rate)) defaultRate = Math.min(1.5, Math.max(0.3, rate))
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  const name = v.name.toLowerCase()
  const uri = (v.voiceURI || '').toLowerCase()
  let s = 0
  if (lang === 'zh-cn' || lang === 'cmn-cn' || lang === 'cmn-hans-cn') s += 100
  else if (lang.startsWith('zh-hans') || lang === 'zh') s += 80
  else if (lang === 'zh-tw' || lang.startsWith('cmn')) s += 50
  else if (lang === 'zh-hk' || lang.startsWith('yue')) s += 5 // Cantonese — last resort
  else if (lang.startsWith('zh')) s += 30
  else return -1
  if (/cantonese|粤|粵|hong kong/.test(name)) s -= 40
  if (/natural|neural|online/.test(name)) s += 30
  // Apple: com.apple.voice.{compact|enhanced|premium}.zh-CN.<Name>; names may carry "(Enhanced)"/"(Premium)"
  if (/premium/.test(name) || /\.premium\./.test(uri)) s += 30
  else if (/enhanced|增强|高品质/.test(name) || /\.enhanced\./.test(uri)) s += 22
  else if (/\.compact\./.test(uri)) s -= 5
  if (/lilian|yu-shu|yushu|tingting|婷婷|xiaoxiao|xiaoyi|yunxi|shanshan|lili/.test(name)) s += 15
  if (/meijia|美佳/.test(name)) s += 5 // Taiwan Mandarin — fine, but prefer mainland
  if (/google/.test(name)) s += 12
  if (/eloquence|novelty|grandma|grandpa|rocko|shelley|flo|reed|sandy/.test(name)) s -= 20
  if (v.localService) s += 2 // works offline, starts faster
  return s
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!synth) return null
  const voices = synth.getVoices()
  if (voices.length) voicesLoaded = true
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const v of voices) {
    const sc = scoreVoice(v)
    if (sc > bestScore) { best = v; bestScore = sc }
  }
  voice = bestScore >= 0 ? best : null
  return voice
}

if (synth) {
  pickVoice()
  synth.addEventListener?.('voiceschanged', () => { pickVoice() })
}

/** Waits (briefly) for voices to load — Chrome populates them asynchronously. */
let waitedForVoices = false
function voicesReady(timeoutMs = 1500): Promise<void> {
  if (!synth || voicesLoaded || waitedForVoices) return Promise.resolve()
  waitedForVoices = true
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); synth.removeEventListener?.('voiceschanged', onChange); resolve() }
    const onChange = () => { pickVoice(); done() }
    const t = setTimeout(() => { pickVoice(); done() }, timeoutMs)
    synth.addEventListener?.('voiceschanged', onChange)
    if (pickVoice() || voicesLoaded) done()
  })
}

/** True if a zh-CN voice is available (may become true after voiceschanged). */
export function hasChineseVoice(): boolean {
  return !!(voice ?? pickVoice())
}

/** Name of the selected voice (for a settings/debug screen). */
export function chineseVoiceName(): string | null {
  return (voice ?? pickVoice())?.name ?? null
}

export function isSpeechSynthesisAvailable(): boolean {
  return !!synth
}

// ─── Multi-voice (high-variability phonetic training) ────────

export type VoiceMode = 'auto' | 'primary' | 'rotate'

export interface ChineseVoiceInfo {
  name: string
  lang: string
  voiceURI: string
  localService: boolean
  quality: 'premium' | 'enhanced' | 'standard'
  /** true for the voice used by default ("primary"). */
  primary: boolean
}

let multiVoice = true
/** Enable/disable voice rotation for `voice: 'auto'` (call with settings.multiVoice ?? true). */
export function setMultiVoice(enabled: boolean): void { multiVoice = enabled !== false }
export function isMultiVoiceEnabled(): boolean { return multiVoice }

function isMandarin(v: SpeechSynthesisVoice): boolean {
  const lang = v.lang.replace('_', '-').toLowerCase()
  const name = v.name.toLowerCase()
  if (lang === 'zh-hk' || lang === 'zh-mo' || lang.startsWith('yue')) return false
  if (/cantonese|粤|粵|hong kong|香港/.test(name)) return false
  return lang === 'zh' || lang.startsWith('zh-') || lang.startsWith('cmn')
}

/** "Tingting (Enhanced)" / "Tingting" → "tingting" (one entry per speaker). */
function speakerKey(v: SpeechSynthesisVoice): string {
  return v.name.toLowerCase().replace(/\(.*?\)|（.*?）/g, '').replace(/\b(enhanced|premium|compact|siri)\b/g, '').replace(/\s+/g, ' ').trim()
}

function qualityOf(v: SpeechSynthesisVoice): ChineseVoiceInfo['quality'] {
  const name = v.name.toLowerCase(), uri = (v.voiceURI || '').toLowerCase()
  if (/premium/.test(name) || /\.premium\./.test(uri)) return 'premium'
  if (/enhanced|增强|高品质|natural|neural/.test(name) || /\.enhanced\./.test(uri)) return 'enhanced'
  return 'standard'
}

/** Good Mandarin voices (zh-CN/zh-TW, no Cantonese, no novelty voices), primary first, one per speaker. */
function goodVoices(): SpeechSynthesisVoice[] {
  if (!synth) return []
  const primary = voice ?? pickVoice()
  const best = new Map<string, { v: SpeechSynthesisVoice; s: number }>()
  for (const v of synth.getVoices()) {
    if (!isMandarin(v)) continue
    const s = scoreVoice(v)
    if (s < 40) continue
    const key = speakerKey(v)
    const prev = best.get(key)
    if (!prev || s > prev.s || v === primary) best.set(key, { v, s: v === primary ? Infinity : s })
  }
  return [...best.values()].sort((a, b) => b.s - a.s).map((x) => x.v)
}

/** The Mandarin voices used for rotation (primary first; excludes Cantonese zh-HK). */
export function listChineseVoices(): ChineseVoiceInfo[] {
  return goodVoices().map((v, i) => ({
    name: v.name, lang: v.lang, voiceURI: v.voiceURI, localService: v.localService,
    quality: qualityOf(v), primary: i === 0,
  }))
}

let rotateIdx = 0
let lastUsedVoice: string | null = null
/** Name of the voice used by the latest speak() (changes when rotating). */
export function lastVoiceName(): string | null { return lastUsedVoice }

/** Picks a voice (+ a pitch variation when only one voice exists and rotation was asked for explicitly). */
function chooseVoice(mode: VoiceMode): { v: SpeechSynthesisVoice | null; pitch: number } {
  const primary = voice ?? pickVoice()
  if (mode === 'primary' || (mode === 'auto' && !multiVoice)) return { v: primary, pitch: 1 }
  const list = goodVoices()
  if (list.length > 1) {
    const v = list[rotateIdx % list.length]
    rotateIdx++
    return { v, pitch: 1 }
  }
  if (mode === 'rotate') {
    // Only one voice: vary the pitch a little so the ear still meets some variability.
    const pitches = [1, 0.85, 1.15]
    const pitch = pitches[rotateIdx % pitches.length]
    rotateIdx++
    return { v: primary, pitch }
  }
  return { v: primary, pitch: 1 }
}

// ─── Swedish voice (hands-free listening) ────────────────────

function scoreSvVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  if (!lang.startsWith('sv')) return -1
  const name = v.name.toLowerCase(), uri = (v.voiceURI || '').toLowerCase()
  let s = lang === 'sv-se' ? 50 : 30
  if (/premium/.test(name) || /\.premium\./.test(uri)) s += 30
  else if (/enhanced|natural|neural|online/.test(name) || /\.enhanced\./.test(uri)) s += 22
  if (/alva|klara|oskar|sofie|mattias|hillevi|google/.test(name)) s += 10
  if (/eloquence|novelty|grandma|grandpa|rocko|shelley|flo|reed|sandy/.test(name)) s -= 20
  if (v.localService) s += 2
  return s
}

function pickSvVoice(): SpeechSynthesisVoice | null {
  if (!synth) return null
  let best: SpeechSynthesisVoice | null = null, bestScore = -1
  for (const v of synth.getVoices()) {
    const sc = scoreSvVoice(v)
    if (sc > bestScore) { best = v; bestScore = sc }
  }
  return bestScore >= 0 ? best : null
}

/** True if a Swedish (sv-SE) voice exists. */
export function hasSwedishVoice(): boolean { return !!pickSvVoice() }

// ─── Speaking ────────────────────────────────────────────────

// Keep references so Chrome doesn't GC the utterance (which drops onend).
let current: { utter: SpeechSynthesisUtterance; finish: () => void } | null = null
let keepAlive: ReturnType<typeof setInterval> | null = null
let speakSeq = 0

function clearKeepAlive() {
  if (keepAlive) { clearInterval(keepAlive); keepAlive = null }
}

export function stopSpeaking(): void {
  speakSeq++
  clearKeepAlive()
  const c = current
  current = null
  c?.finish()
  synth?.cancel()
}

export interface SpeakOptions {
  rate?: number
  slow?: boolean
  /**
   * 'primary' (default): the best voice. 'rotate': cycle through all good Mandarin voices.
   * 'auto': rotate if multi-voice is on (setMultiVoice / settings.multiVoice) and >1 voice exists, else primary.
   */
  voice?: VoiceMode
  /** Called with the chosen voice's name just before speaking (handy with rotation). */
  onVoice?: (name: string | null) => void
}

/** Speak Chinese text (pass HANZI for correct pronunciation). Resolves when finished (never rejects/hangs). */
export async function speak(hanzi: string, opts?: SpeakOptions): Promise<void> {
  if (!synth || !hanzi.trim()) return
  const wasBusy = synth.speaking || synth.pending || current !== null
  stopSpeaking()
  const seq = speakSeq
  // NB: avoid awaits when possible — iOS requires synth.speak() to run synchronously
  // inside the tap handler until speech has been unlocked once.
  if (!voicesLoaded && !waitedForVoices) await voicesReady()
  // Chrome sometimes ignores speak() issued synchronously after cancel()
  if (wasBusy && !isIOS) await new Promise((r) => setTimeout(r, 60))
  if (seq !== speakSeq) return // superseded meanwhile

  const base = opts?.rate ?? defaultRate
  const rate = opts?.slow ? Math.min(0.6, base * 0.75) : base
  const { v, pitch } = chooseVoice(opts?.voice ?? 'primary')
  lastUsedVoice = v?.name ?? null
  opts?.onVoice?.(lastUsedVoice)
  return utter(hanzi, v, v?.lang ?? 'zh-CN', rate, pitch)
}

/**
 * Speak Swedish text with an sv-SE voice. Resolves `false` right away if no Swedish voice exists
 * (the caller should then show the text instead).
 */
export async function speakSwedish(text: string, opts?: { rate?: number }): Promise<boolean> {
  if (!synth || !text.trim()) return false
  if (!voicesLoaded && !waitedForVoices) await voicesReady()
  const sv = pickSvVoice()
  if (!sv) return false
  const wasBusy = synth.speaking || synth.pending || current !== null
  stopSpeaking()
  const seq = speakSeq
  if (wasBusy && !isIOS) await new Promise((r) => setTimeout(r, 60))
  if (seq !== speakSeq) return true
  await utter(text, sv, sv.lang, opts?.rate ?? 1, 1)
  return true
}

function utter(text: string, v: SpeechSynthesisVoice | null, lang: string, rate: number, pitch: number): Promise<void> {
  const s = synth!
  return new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    if (v) u.voice = v
    u.rate = rate
    u.pitch = pitch
    u.volume = 1

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (current?.utter === u) { current = null; clearKeepAlive() }
      resolve()
    }
    // Fallback so the promise never hangs (lost onend, no audio output, …)
    const est = 1500 + ([...text].length * 450) / Math.max(rate, 0.3)
    const timer = setTimeout(finish, Math.min(est, 30000))

    u.onend = finish
    u.onerror = finish
    current = { utter: u, finish }

    s.speak(u)
    // iOS/Safari can get stuck in paused state
    if (s.paused) s.resume()
    // Chrome desktop stops long utterances after ~15 s unless nudged
    if (isChromeDesktop && [...text].length > 30) {
      clearKeepAlive()
      keepAlive = setInterval(() => {
        if (!s.speaking) { clearKeepAlive(); return }
        s.pause()
        s.resume()
      }, 10000)
    }
  })
}

let unlocked = false
/**
 * iOS only allows speech after a user gesture. Call from a tap handler (done
 * automatically on the first pointerdown/keydown anywhere in the page).
 */
export function unlockSpeech(): void {
  if (unlocked || !synth) return
  unlocked = true
  try {
    if (!synth.speaking) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      u.lang = 'zh-CN'
      synth.speak(u)
    }
  } catch { /* ignore */ }
}
