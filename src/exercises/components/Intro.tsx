import { speak } from '../../speech'
import { parsePinyin, toneTextClass } from '../../speech/pinyin'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import type { Tone, Word } from '../../types'
import { useReducedMotion } from '../../motion'
import { getWord, syllableHanzi } from '../items'
import { type ExProps } from './common'
import { TONE_NAME, TONE_SHAPE } from './explain'
import { exampleFor, infoFor, tidyPinyin } from './lineInfo'
import { ToneGlyph } from './ToneGlyph'

const POS_SV: Partial<Record<NonNullable<Word['pos']>, string>> = {
  noun: 'substantiv', verb: 'verb', adj: 'adjektiv', adv: 'adverb', pron: 'pronomen', num: 'räkneord',
  measure: 'måttord', particle: 'partikel', phrase: 'fras',
}

/** Fallback memory hook when the word has no note: describe the tone melody. */
function toneHook(tones: Tone[]): string {
  if (tones.length === 1) return `Melodin är ${TONE_SHAPE[tones[0]]}. Säg det högt och rita kurvan i luften med handen!`
  const shapes = tones.map((t) => TONE_SHAPE[t].split(',')[0])
  return `Melodin: ${shapes.join(' → ')}. Rita kurvorna med fingret medan du säger det.`
}

/** New-word card: tone-coloured pinyin with contour drawings, audio, example and a memory hook. Not scored. */
export function Intro({ ex, course, settings }: ExProps<'intro'>) {
  const info = infoFor(course, ex.item)
  const w = getWord(course, ex.item)
  const reduced = useReducedMotion() || !!settings.reduceMotion
  const syls = parsePinyin(info.pinyin).filter((s) => !s.isPunct)
  const example = w ? exampleFor(course, w.id) : undefined
  const bigText = syls.length > 4 ? 'text-3xl' : syls.length > 2 ? 'text-4xl' : 'text-5xl'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold tracking-wide text-gold-dark uppercase">✨ Nytt ord</span>
        {w?.pos && POS_SV[w.pos] && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-ink-muted uppercase">{POS_SV[w.pos]}</span>}
      </div>

      <div className="relative flex animate-pop flex-col items-center gap-4 overflow-hidden rounded-3xl border-2 border-b-4 border-line bg-surface px-3 pt-6 pb-5 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gold/15 to-transparent" aria-hidden="true" />
        {/* Syllables: tap one to hear it alone */}
        <div className="relative flex flex-wrap items-end justify-center gap-x-1 gap-y-2">
          {syls.map((s, i) => {
            const color = settings.toneColors ? toneTextClass(s.tone) : 'text-ink'
            return (
              <button
                key={i}
                type="button"
                onClick={() => void speak(syllableHanzi(course, ex.item, s.text), { rate: settings.speechRate })}
                aria-label={`Lyssna på ${s.text}, ${TONE_NAME[s.tone]}`}
                className={`flex min-h-11 min-w-11 flex-col items-center rounded-2xl px-2 pt-1 pb-1.5 press hover:bg-surface-2 ${color}`}
              >
                <span className={`${bigText} leading-tight font-extrabold`} lang="zh-Latn-pinyin">{s.text}</span>
                <ToneGlyph tone={s.tone} staff draw={!reduced} delayMs={250 + i * 220} className="mt-1 h-10 w-12" />
                <span className="text-[11px] font-extrabold tracking-wide uppercase opacity-80">{s.tone === 5 ? 'neutral' : `${s.tone}:${s.tone <= 2 ? 'a' : 'e'} ton`}</span>
              </button>
            )
          })}
        </div>
        {settings.showHanzi && info.hanzi && <span className="text-lg text-ink-muted" lang="zh-CN">{info.hanzi}</span>}

        <div className="flex items-end gap-4">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={settings.speechRate} label="Lyssna" />
          <SpeakButton hanzi={info.hanzi} size="md" slow rate={settings.speechRate} />
        </div>

        <div>
          <p className="text-3xl font-extrabold text-ink">{info.sv}</p>
          {w?.svAlt?.length ? <p className="mt-1 text-ink-muted">även: {w.svAlt.join(', ')}</p> : null}
        </div>
      </div>

      <div className="flex gap-3 rounded-2xl bg-sky-soft px-4 py-3 text-sky-dark">
        <span className="text-xl" aria-hidden="true">💡</span>
        <p><span className="font-extrabold">Minnesknep: </span>{w?.note ?? toneHook(syls.map((s) => s.tone))}</p>
      </div>

      {example && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-line px-3 py-3">
          <SpeakButton hanzi={example.hanzi} size="sm" rate={settings.speechRate} label="Lyssna på exemplet" className="!h-11 !w-11" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-wide text-ink-muted uppercase">I en mening</p>
            <PinyinText pinyin={tidyPinyin(example.pinyin)} colored={settings.toneColors} className="text-lg font-bold" />
            <p className="text-sm text-ink-muted">{example.sv}</p>
          </div>
        </div>
      )}
    </div>
  )
}
