// Shared shell constants + hooks.
import { useEffect, useState } from 'react'
import { chineseVoiceName, hasChineseVoice, isSpeechSynthesisAvailable } from '../speech'

export const GOALS = [
  { xp: 10, label: 'Lugnt', note: '≈ 5 min/dag' },
  { xp: 20, label: 'Normalt', note: '≈ 10 min/dag' },
  { xp: 30, label: 'Seriöst', note: '≈ 15 min/dag' },
  { xp: 50, label: 'Intensivt', note: '≈ 25 min/dag' },
]

/** Re-renders when the browser's voice list changes (Chrome/Android load voices async). */
export function useVoices(): { has: boolean; name: string | null; synth: boolean } {
  const [, force] = useState(0)
  useEffect(() => {
    const s = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    const on = () => force((n) => n + 1)
    s?.addEventListener?.('voiceschanged', on)
    const t = setTimeout(on, 1200)
    return () => { s?.removeEventListener?.('voiceschanged', on); clearTimeout(t) }
  }, [])
  return { has: hasChineseVoice(), name: chineseVoiceName(), synth: isSpeechSynthesisAvailable() }
}
