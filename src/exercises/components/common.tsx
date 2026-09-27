// Shared bits for exercise components.
import { useEffect, type ReactNode } from 'react'
import type { Course, Exercise, ItemRef, Settings } from '../../types'
import { PinyinText } from '../../speech/PinyinText'
import { optionClass, sfx, type OptionState } from './util'

export interface Verdict {
  status: 'correct' | 'almost' | 'wrong'
  /** Correct answer to show (pinyin is rendered with tone colours). */
  answer?: { pinyin?: string; text?: string }
  /** What speech recognition heard. */
  heard?: string
  /** Extra line, e.g. "3:e tonen". */
  note?: string
  /** match-pairs: items that were mismatched at least once. */
  mistakeItems?: ItemRef[]
}

export interface ExProps<T extends Exercise['type']> {
  ex: Extract<Exercise, { type: T }>
  course: Course
  settings: Settings
  /** Non-null once the answer has been checked → component is locked. */
  verdict: Verdict | null
  /** Register how to grade the current answer (null = nothing to check yet → button disabled). */
  setChecker: (fn: (() => Verdict) | null) => void
  /** Grade immediately (match-pairs, speak). */
  submit: (v: Verdict) => void
}

export function Instruction({ children }: { children: ReactNode }) {
  return <h2 className="text-[22px] leading-tight font-extrabold text-ink sm:text-2xl">{children}</h2>
}

/** Pinyin with optional small hanzi under it (settings.showHanzi). */
export function ItemPinyin({ pinyin, hanzi, settings, className = '' }: { pinyin: string; hanzi?: string; settings: Settings; className?: string }) {
  return (
    <span className="inline-flex flex-col items-center">
      <PinyinText pinyin={pinyin} colored={settings.toneColors} className={`font-bold ${className}`} />
      {settings.showHanzi && hanzi && <span className="mt-0.5 text-sm font-normal text-ink-muted" lang="zh-CN">{hanzi}</span>}
    </span>
  )
}

/** Speech-bubble style prompt card. */
export function PromptCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg font-bold text-ink ${className}`}>
      {children}
    </div>
  )
}

/** Vertical list of big answer buttons (also selectable with keys 1–9). */
export function ChoiceList({ options, answer, selected, onSelect, verdict, render, settings }: {
  options: string[]
  answer: string
  selected: string | null
  onSelect: (o: string) => void
  verdict: Verdict | null
  render?: (o: string) => ReactNode
  settings: Settings
}) {
  const locked = !!verdict
  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const n = Number(e.key)
      if (n >= 1 && n <= options.length) { sfx(settings, 'tap'); onSelect(options[n - 1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, options, onSelect, settings])

  return (
    <div className="grid gap-3" role="radiogroup">
      {options.map((o, i) => {
        let state: OptionState = selected === o ? 'selected' : 'idle'
        if (locked) state = o === answer ? 'right' : o === selected ? 'wrong' : 'dim'
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={selected === o}
            disabled={locked}
            onClick={() => { sfx(settings, 'tap'); onSelect(o) }}
            className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-lg font-bold transition-colors active:translate-y-0.5 active:border-b-2 disabled:active:translate-y-0 disabled:active:border-b-4 ${optionClass(state)}`}
          >
            <span className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-current/30 text-sm opacity-60 sm:inline-flex">{i + 1}</span>
            <span className="min-w-0 flex-1 break-words">{render ? render(o) : o}</span>
          </button>
        )
      })}
    </div>
  )
}
