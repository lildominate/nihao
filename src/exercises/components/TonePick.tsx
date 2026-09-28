import { useEffect, useState } from 'react'
import type { Tone } from '../../types'
import { SpeakButton } from '../../speech/SpeakButton'
import { PinyinText } from '../../speech/PinyinText'
import { syllableHanzi, voiceHint } from '../items'
import { infoFor } from './lineInfo'
import { norm, syllableBase, syllables, withTone } from '../pinyinUtil'
import { Instruction, type ExProps } from './common'
import { TONE_NAME, TONE_SHAPE, toneLine } from './explain'
import { ToneGlyph } from './ToneGlyph'
import { optionClass, pickFx, PRESS, type OptionState } from './util'

const TONE_NAMES: Record<Tone, string> = { 1: '1:a tonen', 2: '2:a tonen', 3: '3:e tonen', 4: '4:e tonen', 5: 'neutral ton' }
const TONE_HINTS: Record<number, string> = { 1: 'hög & jämn', 2: 'stigande', 3: 'dalande–stigande', 4: 'fallande' }
const TONE_TEXT: Record<number, string> = { 1: 'text-tone-1', 2: 'text-tone-2', 3: 'text-tone-3', 4: 'text-tone-4' }

/** Kept for compatibility: the pitch-contour glyph now lives in ToneGlyph.tsx. */
export { ToneGlyph as ToneContour } from './ToneGlyph'

/** Hear a syllable → pick its tone. */
export function TonePick({ ex, course, settings, verdict, setChecker }: ExProps<'tone-pick'>) {
  const info = infoFor(course, ex.item)
  const [sel, setSel] = useState<Tone | null>(null)
  const base = syllableBase(ex.syllable)
  const sylHanzi = syllableHanzi(course, ex.item, ex.syllable)
  const wordSyls = syllables(info.pinyin)
  const target = wordSyls.findIndex((s) => norm(s) === norm(ex.syllable))

  useEffect(() => {
    setChecker(sel == null ? null : () =>
      sel === ex.answer
        ? { status: 'correct', note: TONE_NAMES[ex.answer] }
        : { status: 'wrong', answer: { pinyin: ex.syllable }, audio: sylHanzi, explain: `Du valde ${TONE_NAME[sel]} (${TONE_SHAPE[sel]}). ${toneLine(ex.answer)}` })
  }, [sel, ex, setChecker, sylHanzi])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Vilken ton hör du?</Instruction>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-end gap-4">
          <SpeakButton hanzi={sylHanzi} size="lg" autoPlay rate={settings.speechRate} voice={voiceHint(ex)} label="Lyssna på stavelsen" />
          <SpeakButton hanzi={sylHanzi} size="md" slow rate={settings.speechRate} voice={voiceHint(ex)} />
        </div>
        {wordSyls.length > 1 && target >= 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-xl">
            {wordSyls.map((s, i) =>
              i === target && !verdict ? (
                <span key={i} className="rounded-md border-b-4 border-sky px-1 font-extrabold text-sky-dark">{base}</span>
              ) : (
                <PinyinText key={i} pinyin={s} colored={settings.toneColors} className={`font-bold ${i === target ? 'underline decoration-4 underline-offset-4' : 'opacity-70'}`} />
              ),
            )}
            <SpeakButton hanzi={info.hanzi} size="sm" rate={settings.speechRate} label="Lyssna på hela ordet" />
          </div>
        )}
        <p className="text-ink-muted">”{info.sv}”</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([1, 2, 3, 4] as Tone[]).map((t) => {
          let state: OptionState = sel === t ? 'selected' : 'idle'
          if (verdict) state = t === ex.answer ? 'right' : t === sel ? 'wrong' : 'dim'
          return (
            <button
              key={t}
              type="button"
              disabled={!!verdict}
              onClick={() => { pickFx(settings); setSel(t) }}
              aria-label={`${TONE_NAMES[t]}: ${withTone(base, t)}`}
              className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-b-4 px-2 py-3 ${PRESS} ${optionClass(state)}`}
            >
              <span className={`text-3xl font-extrabold ${settings.toneColors ? TONE_TEXT[t] : ''}`}>{withTone(base, t)}</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                <ToneGlyph tone={t} className="h-4 w-5" /> {TONE_HINTS[t]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
