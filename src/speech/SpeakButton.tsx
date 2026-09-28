// OWNER: Voice agent. Round speaker button that plays hanzi via TTS (with slow "turtle" variant).
import { useEffect, useRef, useState } from 'react'
import { speak } from './tts'
import type { VoiceMode } from './tts'

const SIZES = {
  sm: { btn: 'h-10 w-10', icon: 'h-5 w-5' },
  md: { btn: 'h-14 w-14', icon: 'h-7 w-7' },
  lg: { btn: 'h-24 w-24', icon: 'h-12 w-12' },
} as const

function SpeakerIcon({ className, active }: { className: string; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" fill="currentColor" />
      <path d="M16.2 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className={active ? 'animate-pulse' : ''} />
      <path d="M18.8 6.4a7.6 7.6 0 0 1 0 11.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className={active ? 'animate-pulse [animation-delay:150ms]' : 'opacity-90'} />
    </svg>
  )
}

function TurtleIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 15.5c0-4 3.1-7 7-7s7 3 7 7H4Z" fill="currentColor" />
      <path d="M8 12.2 11 10l3 2.2M11 10v5.5" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="13.2" r="2.2" fill="currentColor" />
      <path d="M6 15.5v2.3M15.5 15.5v2.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M4 15.5 2.3 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export interface SpeakButtonProps {
  hanzi: string
  size?: 'sm' | 'md' | 'lg'
  /** Speaks slowly and shows a turtle icon. */
  slow?: boolean
  /** Speak once on mount (and whenever `hanzi` changes). */
  autoPlay?: boolean
  /** Normal speech rate (e.g. settings.speechRate). */
  rate?: number
  className?: string
  label?: string
  onEnd?: () => void
  /** Voice selection, e.g. 'rotate' for multi-voice tone training. Default primary. */
  voice?: VoiceMode
}

/** Duolingo-style round blue speaker button. */
export function SpeakButton({ hanzi, size = 'md', slow = false, autoPlay = false, rate, className = '', label, onEnd, voice }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const mounted = useRef(true)
  const seq = useRef(0)
  const latest = useRef({ hanzi, slow, rate, onEnd, voice })
  useEffect(() => { latest.current = { hanzi, slow, rate, onEnd, voice } })

  const play = () => {
    const my = ++seq.current
    const { hanzi: h, slow: s, rate: r, onEnd: done, voice: v } = latest.current
    setSpeaking(true)
    // speak() is called synchronously inside the click handler (required on iOS)
    void speak(h, { slow: s, rate: r, voice: v }).then(() => {
      if (!mounted.current || my !== seq.current) return
      setSpeaking(false)
      done?.()
    })
  }

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // StrictMode-safe autoplay: the timer of the first (discarded) effect run is cleared in cleanup.
  useEffect(() => {
    if (!autoPlay || !hanzi) return
    const t = setTimeout(play, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, hanzi])

  const sz = SIZES[size]
  const color = slow
    ? 'bg-sky-soft text-sky-dark border-sky/40'
    : 'bg-sky text-white border-sky-dark'

  return (
    <button
      type="button"
      onClick={play}
      aria-label={label ?? (slow ? 'Lyssna långsamt' : 'Lyssna')}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-2xl border-b-4 ${color} ${sz.btn}
        transition-transform duration-100 select-none active:translate-y-0.5 active:border-b-2
        ${speaking ? 'scale-105' : ''} ${className}`}
    >
      {speaking && <span className="pointer-events-none absolute inset-0 animate-ping rounded-2xl bg-sky/30" />}
      {slow ? <TurtleIcon className={`${sz.icon} ${speaking ? 'animate-bob' : ''}`} /> : <SpeakerIcon className={sz.icon} active={speaking} />}
    </button>
  )
}
