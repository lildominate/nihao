import { useEffect, useState } from 'react'
import { checkTypedPinyin, numbersToMarks } from '../../speech/pinyin'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import { itemInfo } from '../items'
import { Instruction, PromptCard, type ExProps } from './common'

/** See Swedish (and optionally hear it) → type the pinyin. Tone numbers ("shui3") are fine. */
export function TypePinyin({ ex, course, settings, verdict, setChecker }: ExProps<'type-pinyin'>) {
  const info = itemInfo(course, ex.item)
  const [value, setValue] = useState('')
  useEffect(() => {
    setChecker(!value.trim() ? null : () => {
      const r = checkTypedPinyin(value, info.pinyin)
      if (r === 'exact') return { status: 'correct' }
      if (r === 'tones-wrong') return { status: 'almost', answer: { pinyin: info.pinyin } }
      return { status: 'wrong', answer: { pinyin: info.pinyin } }
    })
  }, [value, info.pinyin, setChecker])

  const preview = /\d/.test(value) ? numbersToMarks(value) : ''
  const border = !verdict ? 'border-line focus:border-sky' : verdict.status === 'wrong' ? 'border-danger bg-danger-soft' : 'border-brand bg-brand-soft'

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Skriv på pinyin</Instruction>
      <div className="flex items-center gap-3">
        <PromptCard className="text-2xl">”{info.sv}”</PromptCard>
        <SpeakButton hanzi={info.hanzi} size="sm" rate={settings.speechRate} label="Lyssna (ledtråd)" />
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!!verdict}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          lang="zh-Latn-pinyin"
          aria-label="Pinyin"
          placeholder="t.ex. shui3"
          className={`w-full rounded-2xl border-2 bg-surface-2 px-4 py-4 text-2xl font-bold text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-muted/60 ${border}`}
        />
        <div className="min-h-7 px-1 text-xl">
          {preview && <PinyinText pinyin={preview} colored={settings.toneColors} className="font-bold" />}
        </div>
        <p className="px-1 text-sm text-ink-muted">
          Tips: skriv tonen som en siffra efter stavelsen – <b className="text-ink">shui3</b> blir <b className="text-ink">shuǐ</b>. Neutral ton behöver ingen siffra.
        </p>
      </div>
    </div>
  )
}
