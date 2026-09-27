// OWNER: Voice agent. Public API of the speech module — signatures are the contract.
import type { Tone } from '../types'
import { unlockAudio } from './sfx'
import { unlockSpeech } from './tts'

/**
 * speak(hanzi, { rate?, slow? }) — Speak Chinese text (pass HANZI). Resolves when finished; never hangs.
 * stopSpeaking(), hasChineseVoice(), setDefaultSpeechRate(rate) (call with settings.speechRate).
 */
export { speak, stopSpeaking, hasChineseVoice, setDefaultSpeechRate, chineseVoiceName, isSpeechSynthesisAvailable, unlockSpeech, isIOS } from './tts'

/**
 * listenAndCheck(expected, { timeoutMs? }) — listen via mic (zh-CN) and compare to the expected item.
 * Rejects with SpeechError (code: 'unsupported' | 'not-allowed' | 'no-speech' | …, Swedish `message`).
 * SpokenCheck.score is 0–1.
 */
export { isRecognitionAvailable, listenAndCheck, stopListening, recognizeOnce, recognitionSupport, isStandalonePwa, SpeechError } from './recognition'
export type { SpeechErrorCode } from './recognition'
export type { SpokenCheck } from './score'

export { playSfx, unlockAudio } from './sfx'
export type { Sfx } from './sfx'

export { PinyinText } from './PinyinText'
export { SpeakButton } from './SpeakButton'
export { MicButton } from './MicButton'

export type { Tone }

// iOS: speech + WebAudio must be unlocked inside a user gesture. Do it on the first interaction.
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockSpeech()
    unlockAudio()
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
}
