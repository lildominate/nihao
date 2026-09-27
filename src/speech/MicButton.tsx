// OWNER: Voice agent. Big microphone button: listens (zh-CN) and reports a SpokenCheck.
import { useEffect, useRef, useState } from 'react'
import { isRecognitionAvailable, listenAndCheck, SpeechError, stopListening } from './recognition'
import type { SpokenCheck } from './score'

export interface MicButtonProps {
  expected: { hanzi: string; pinyin: string }
  onResult(check: SpokenCheck): void
  /** Swedish, user-presentable error message. */
  onError?(msg: string, code?: string): void
  disabled?: boolean
  timeoutMs?: number
  className?: string
}

function MicIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function MicButton({ expected, onResult, onError, disabled, timeoutMs, className = '' }: MicButtonProps) {
  const [state, setState] = useState<'idle' | 'listening'>('idle')
  const mounted = useRef(true)
  const cbs = useRef({ onResult, onError })
  useEffect(() => { cbs.current = { onResult, onError } })

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stopListening() }
  }, [])

  const click = async () => {
    if (state === 'listening') { stopListening(); return }
    // NB: no await before listenAndCheck — iOS wants recognition.start() inside the tap handler.
    if (isRecognitionAvailable()) setState('listening')
    try {
      const check = await listenAndCheck(expected, { timeoutMs })
      if (mounted.current) cbs.current.onResult(check)
    } catch (err) {
      if (!mounted.current) return
      if (err instanceof SpeechError) {
        if (err.code !== 'aborted') cbs.current.onError?.(err.message, err.code)
      } else {
        cbs.current.onError?.('Något gick fel med taligenkänningen. Försök igen.', 'other')
      }
    } finally {
      if (mounted.current) setState('idle')
    }
  }

  const listening = state === 'listening'
  return (
    <button
      type="button"
      onClick={click}
      disabled={disabled}
      aria-label={listening ? 'Sluta lyssna' : 'Tryck och säg det'}
      aria-pressed={listening}
      className={`relative inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-b-4 select-none
        transition-transform duration-100 active:translate-y-0.5 active:border-b-2 disabled:opacity-50
        ${listening ? 'bg-danger text-white border-red-800 scale-105' : 'bg-sky text-white border-sky-dark'} ${className}`}
    >
      {listening && (
        <>
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-danger/40" />
          <span className="pointer-events-none absolute -inset-3 animate-pulse rounded-full border-4 border-danger/30" />
        </>
      )}
      <MicIcon className="relative h-11 w-11" />
    </button>
  )
}
