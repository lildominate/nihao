// OWNER: Speech/Lab agent. "Tallabbet" — tone meter, shadowing, hands-free listening, pronunciation guide.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useProgress } from '../progress'
import { listChineseVoices, pitchTrackingSupport, setMultiVoice, speak } from '../speech'
import { Panda } from '../mascot/Panda'
import { GuideMode, ToneShapeIcon } from './GuideMode'
import { HandsfreeMode } from './HandsfreeMode'
import { ShadowMode } from './ShadowMode'
import { ToneMode } from './ToneMode'

type Mode = 'tones' | 'shadow' | 'handsfree' | 'guide'

/** Number of good Mandarin voices (updates when the browser loads its voices). */
function useVoiceCount(): number {
  const [n, setN] = useState(() => listChineseVoices().length)
  useEffect(() => {
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
    const update = () => setN(listChineseVoices().length)
    const t = setTimeout(update, 600)
    synth?.addEventListener?.('voiceschanged', update)
    return () => { clearTimeout(t); synth?.removeEventListener?.('voiceschanged', update) }
  }, [])
  return n
}

export function LabHub() {
  const { state } = useProgress()
  const multi = state.settings.multiVoice ?? true
  const [mode, setMode] = useState<Mode | null>(null)
  const voices = useVoiceCount()
  const mic = pitchTrackingSupport()

  useEffect(() => { setMultiVoice(multi) }, [multi])

  const close = () => setMode(null)

  return (
    <section className="space-y-3" aria-labelledby="lab-title">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-tone-4 to-tone-3 p-4 text-white">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute right-16 -bottom-10 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <button type="button" onClick={() => speak('你好', { voice: 'auto' })} aria-label="Pānpan säger hej" className="shrink-0 transition-transform active:scale-95">
            <Panda mood="wave" size={72} />
          </button>
          <div className="min-w-0">
            <h2 id="lab-title" className="text-xl font-black">Tallabbet</h2>
            <p className="text-sm font-semibold text-white/85">Träna öra och uttal – se din röst som en kurva.</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
              {voices > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5">
                  🎙️ {voices === 1 ? '1 röst' : `${voices} röster${multi ? ' växlar' : ''}`}
                </span>
              )}
              {!mic.available && <span className="rounded-full bg-white/20 px-2 py-0.5">🎤 ingen mikrofon</span>}
            </div>
          </div>
        </div>
      </div>

      <ModeCard color="bg-tone-1" dark="border-red-800" title="Tonmätaren" subtitle="Säg ordet och se din tonkurva över målet"
        onClick={() => setMode('tones')}
        art={<div className="grid grid-cols-2 gap-0.5">{([1, 2, 3, 4] as const).map((t) => <ToneShapeIcon key={t} tone={t} className="h-6 w-8 rounded bg-white" />)}</div>} />
      <ModeCard color="bg-sky" dark="border-sky-dark" title="Skugga" subtitle="Lyssna på en mening och säg den direkt efter"
        onClick={() => setMode('shadow')} art={<span className="text-3xl" aria-hidden="true">🗣️</span>} />
      <ModeCard color="bg-brand" dark="border-brand-dark" title="Lyssna handsfree" subtitle="Kinesiska → paus → svenska. Perfekt på promenaden"
        onClick={() => setMode('handsfree')} art={<span className="text-3xl" aria-hidden="true">🎧</span>} />
      <ModeCard color="bg-gold" dark="border-gold-dark" title="Uttalsguide" subtitle="Alla ljud i pinyin – tryck och lyssna" ink
        onClick={() => setMode('guide')} art={<span className="text-xl font-black" aria-hidden="true">zh ü x</span>} />

      {mode === 'tones' && <ToneMode onClose={close} />}
      {mode === 'shadow' && <ShadowMode onClose={close} />}
      {mode === 'handsfree' && <HandsfreeMode onClose={close} />}
      {mode === 'guide' && <GuideMode onClose={close} />}
    </section>
  )
}

function ModeCard({ color, dark, title, subtitle, art, onClick, ink }: {
  color: string; dark: string; title: string; subtitle: string; art: ReactNode; onClick: () => void; ink?: boolean
}) {
  return (
    <button type="button" onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-3xl border-b-4 p-4 text-left transition-transform press active:translate-y-0.5 active:border-b-2 ${color} ${dark} ${ink ? 'text-ink' : 'text-white'}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-black">{title}</span>
        <span className={`block text-sm font-semibold ${ink ? 'text-ink/75' : 'text-white/85'}`}>{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center justify-center">{art}</span>
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 opacity-70 transition-transform group-active:translate-x-0.5" aria-hidden="true">
        <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
