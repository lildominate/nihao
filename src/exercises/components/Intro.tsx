import { SpeakButton } from '../../speech/SpeakButton'
import type { Word } from '../../types'
import { getWord, itemInfo } from '../items'
import { Instruction, ItemPinyin, type ExProps } from './common'

const POS_SV: Partial<Record<NonNullable<Word['pos']>, string>> = {
  noun: 'substantiv', verb: 'verb', adj: 'adjektiv', adv: 'adverb', pron: 'pronomen', num: 'räkneord',
  measure: 'måttord', particle: 'partikel', phrase: 'fras',
}

/** New-word card: listen, see pinyin + meaning. Not scored. */
export function Intro({ ex, course, settings }: ExProps<'intro'>) {
  const info = itemInfo(course, ex.item)
  const w = getWord(course, ex.item)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold tracking-wide text-gold-dark uppercase">Nytt ord</span>
      </div>
      <Instruction>Lyssna och lär dig</Instruction>
      <div className="flex animate-pop flex-col items-center gap-5 rounded-3xl border-2 border-b-4 border-line bg-surface px-4 py-8 text-center">
        <ItemPinyin pinyin={info.pinyin} hanzi={info.hanzi} settings={settings} className="text-5xl" />
        <div className="flex items-end gap-4">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={settings.speechRate} />
          <SpeakButton hanzi={info.hanzi} size="md" slow rate={settings.speechRate} />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-ink">{info.sv}</p>
          {w?.svAlt?.length ? <p className="mt-1 text-ink-muted">även: {w.svAlt.join(', ')}</p> : null}
          {w?.pos && POS_SV[w.pos] && <p className="mt-1 text-xs font-bold tracking-wide text-ink-muted uppercase">{POS_SV[w.pos]}</p>}
        </div>
      </div>
      {w?.note && (
        <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sky-dark">
          <span aria-hidden="true">💡 </span>{w.note}
        </p>
      )}
    </div>
  )
}
