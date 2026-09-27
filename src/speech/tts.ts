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

/** Speak Chinese text (pass HANZI for correct pronunciation). Resolves when finished (never rejects/hangs). */
export async function speak(hanzi: string, opts?: { rate?: number; slow?: boolean }): Promise<void> {
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

  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(hanzi)
    utter.lang = voice?.lang ?? 'zh-CN'
    if (voice) utter.voice = voice
    utter.rate = rate
    utter.pitch = 1
    utter.volume = 1

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (current?.utter === utter) { current = null; clearKeepAlive() }
      resolve()
    }
    // Fallback so the promise never hangs (lost onend, no audio output, …)
    const est = 1500 + ([...hanzi].length * 450) / Math.max(rate, 0.3)
    const timer = setTimeout(finish, Math.min(est, 30000))

    utter.onend = finish
    utter.onerror = finish
    current = { utter, finish }

    synth.speak(utter)
    // iOS/Safari can get stuck in paused state
    if (synth.paused) synth.resume()
    // Chrome desktop stops long utterances after ~15 s unless nudged
    if (isChromeDesktop && [...hanzi].length > 30) {
      clearKeepAlive()
      keepAlive = setInterval(() => {
        if (!synth.speaking) { clearKeepAlive(); return }
        synth.pause()
        synth.resume()
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
