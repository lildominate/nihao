import { useEffect, useState } from 'react'
import { SpeakButton } from '../../speech/SpeakButton'
import { itemInfo } from '../items'
import { ChoiceList, Instruction, ItemPinyin, type ExProps } from './common'

/** See pinyin → pick the Swedish meaning. */
export function PinyinToSv({ ex, course, settings, verdict, setChecker }: ExProps<'pinyin-to-sv'>) {
  const info = itemInfo(course, ex.item)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    setChecker(sel == null ? null : () => (sel === ex.answer ? { status: 'correct' } : { status: 'wrong', answer: { text: ex.answer } }))
  }, [sel, ex, setChecker])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Vad betyder det här?</Instruction>
      <div className="flex items-center justify-center gap-4 py-4">
        <SpeakButton hanzi={info.hanzi} size="md" autoPlay rate={settings.speechRate} />
        <ItemPinyin pinyin={info.pinyin} hanzi={info.hanzi} settings={settings} className="text-3xl sm:text-4xl" />
      </div>
      <ChoiceList options={ex.options} answer={ex.answer} selected={sel} onSelect={setSel} verdict={verdict} settings={settings} />
    </div>
  )
}
