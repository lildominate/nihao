import { useEffect, useMemo, useState } from 'react'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import type { DialogueLine } from '../../types'
import { Instruction, type ExProps } from './common'
import { explainPinyinChoice } from './explain'
import { getLine, infoFor, pinyinKey, tidyPinyin } from './lineInfo'
import { optionClass, pickFx, PRESS, type OptionState } from './util'

/** How many earlier lines to show above the reply. */
const CONTEXT_LINES = 2

function Bubble({ line, name, mine, showSv, autoPlay, rate, toneColors }: {
  line: DialogueLine
  name: string
  mine: boolean
  showSv: boolean
  autoPlay?: boolean
  rate: number
  toneColors: boolean
}) {
  if (line.speaker === 'N') {
    return (
      <div className="flex animate-fade items-center gap-2 self-center rounded-2xl bg-surface-2 px-3 py-2 text-center">
        <SpeakButton hanzi={line.hanzi} size="sm" autoPlay={autoPlay} rate={rate} className="!h-11 !w-11" />
        <div className="italic">
          <PinyinText pinyin={tidyPinyin(line.chunks.join(' '))} colored={toneColors} className="font-bold" />
          {showSv && <p className="text-sm text-ink-muted">{line.sv}</p>}
        </div>
      </div>
    )
  }
  return (
    <div className={`flex max-w-[88%] animate-fade flex-col ${mine ? 'items-end self-end' : 'items-start self-start'}`}>
      <span className="mb-1 px-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">{name}</span>
      <div className={`flex items-center gap-2 rounded-3xl border-2 px-3 py-2 ${mine ? 'flex-row-reverse rounded-br-md border-brand/40 bg-brand-soft' : 'rounded-bl-md border-line bg-surface'}`}>
        <SpeakButton hanzi={line.hanzi} size="sm" autoPlay={autoPlay} rate={rate} className="!h-11 !w-11" label={`Lyssna på ${name}`} />
        <div className={mine ? 'text-right' : ''}>
          <PinyinText pinyin={tidyPinyin(line.chunks.join(' '))} colored={toneColors} className="text-xl font-bold" />
          {showSv && <p className="text-sm text-ink-muted">{line.sv}</p>}
        </div>
      </div>
    </div>
  )
}

/** Chat mini-scene: previous line(s) with audio → pick the reply (pinyin bubbles). */
export function DialogueReply({ ex, course, settings, verdict, setChecker }: ExProps<'dialogue-reply'>) {
  const info = useMemo(() => infoFor(course, ex.item), [course, ex.item])
  const found = useMemo(() => getLine(course, ex.item), [course, ex.item])
  const [sel, setSel] = useState<string | null>(null)
  const [showSv, setShowSv] = useState(false)

  useEffect(() => {
    setChecker(sel == null ? null : () =>
      pinyinKey(sel) === pinyinKey(ex.answer)
        ? { status: 'correct' }
        : { status: 'wrong', answer: { pinyin: ex.answer, text: info.sv }, explain: explainPinyinChoice(course, sel, ex.answer, info.wordIds) })
  }, [sel, ex, setChecker, course, info.sv, info.wordIds])

  // Keys 1–9 pick a reply (like ChoiceList).
  const locked = !!verdict
  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const n = Number(e.key)
      if (n >= 1 && n <= ex.options.length) { pickFx(settings); setSel(ex.options[n - 1]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, ex.options, settings])

  const d = found?.dialogue
  const replySpeaker = found?.line.speaker ?? 'A'
  const prev = found ? d!.lines.slice(Math.max(0, found.index - CONTEXT_LINES), found.index) : []
  const nameOf = (s: DialogueLine['speaker']) => (s === 'N' ? 'Berättaren' : d?.speakers[s] ?? s)

  return (
    <div className="flex flex-col gap-5">
      <Instruction>Vad svarar du?</Instruction>

      {d && (
        <div className="flex items-start gap-2 rounded-2xl bg-gold/15 px-3 py-2 text-sm text-ink">
          <span aria-hidden="true">🎬</span>
          <p><span className="font-extrabold">{d.title}.</span> {d.context}</p>
        </div>
      )}

      <div className="flex flex-col gap-3" aria-label="Samtal">
        {prev.map((l, i) => (
          <Bubble
            key={i}
            line={l}
            name={nameOf(l.speaker)}
            mine={l.speaker === replySpeaker}
            showSv={showSv}
            autoPlay={i === prev.length - 1}
            rate={settings.speechRate}
            toneColors={settings.toneColors}
          />
        ))}

        {/* The reply slot */}
        <div className="flex max-w-[88%] flex-col items-end self-end" aria-live="polite">
          <span className="mb-1 px-2 text-xs font-extrabold tracking-wide text-ink-muted uppercase">{nameOf(replySpeaker)}</span>
          {verdict ? (
            <div className={`animate-pop rounded-3xl rounded-br-md border-2 px-4 py-2 text-right ${verdict.status === 'wrong' ? 'border-danger/40 bg-danger-soft' : 'border-brand/40 bg-brand-soft'}`}>
              <PinyinText pinyin={tidyPinyin(ex.answer)} colored={settings.toneColors} className="text-xl font-bold" />
              <p className="text-sm text-ink-muted">{info.sv}</p>
            </div>
          ) : sel ? (
            <div key={sel} className="animate-pop rounded-3xl rounded-br-md border-2 border-sky bg-sky-soft px-4 py-2">
              <PinyinText pinyin={tidyPinyin(sel)} colored={settings.toneColors} className="text-xl font-bold" />
            </div>
          ) : (
            <div className="flex h-11 items-center gap-1.5 rounded-3xl rounded-br-md bg-surface-2 px-4" aria-label="Väntar på ditt svar">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink-muted/60" style={{ animationDelay: `${i * 150}ms` }} />)}
            </div>
          )}
        </div>
      </div>

      {prev.length > 0 && (
        <button
          type="button"
          onClick={() => setShowSv((v) => !v)}
          aria-pressed={showSv}
          className="press min-h-11 self-center rounded-full px-4 text-sm font-extrabold text-sky-dark hover:bg-sky-soft"
        >
          {showSv ? 'Dölj svenska' : 'Visa svenska'}
        </button>
      )}

      <div className="flex flex-col items-end gap-3" role="radiogroup" aria-label="Svarsalternativ">
        {ex.options.map((o) => {
          let state: OptionState = sel === o ? 'selected' : 'idle'
          if (locked) state = o === ex.answer ? 'right' : o === sel ? 'wrong' : 'dim'
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={sel === o}
              disabled={locked}
              onClick={() => { pickFx(settings); setSel(o) }}
              className={`min-h-14 max-w-full rounded-3xl rounded-br-md border-2 border-b-4 px-4 py-2 text-right text-xl font-bold ${PRESS} ${optionClass(state)}`}
            >
              <PinyinText pinyin={tidyPinyin(o)} colored={settings.toneColors && state !== 'dim'} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
