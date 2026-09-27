import { useEffect, useState } from 'react'
import { SpeakButton } from '../../speech/SpeakButton'
import { itemInfo } from '../items'
import { ChoiceList, Instruction, ItemPinyin, type ExProps } from './common'

/** Hear audio → pick the Swedish meaning. */
export function ListenChoose({ ex, course, settings, verdict, setChecker }: ExProps<'listen-choose'>) {
  const info = itemInfo(course, ex.item)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    setChecker(sel == null ? null : () => (sel === ex.answer ? { status: 'correct' } : { status: 'wrong', answer: { text: ex.answer } }))
  }, [sel, ex, setChecker])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Tryck på det du hör</Instruction>
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="flex items-end justify-center gap-4">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={settings.speechRate} />
          <SpeakButton hanzi={info.hanzi} size="md" slow rate={settings.speechRate} />
        </div>
        <div className="flex min-h-10 items-center text-2xl">
          {verdict && <span className="animate-fade"><ItemPinyin pinyin={info.pinyin} hanzi={info.hanzi} settings={settings} /></span>}
        </div>
      </div>
      <ChoiceList options={ex.options} answer={ex.answer} selected={sel} onSelect={setSel} verdict={verdict} settings={settings} />
    </div>
  )
}
