import { useEffect, useState } from 'react'
import { PinyinText } from '../../speech/PinyinText'
import { itemInfo } from '../items'
import { ChoiceList, Instruction, PromptCard, type ExProps } from './common'

/** See Swedish → pick the pinyin. */
export function SvToPinyin({ ex, course, settings, verdict, setChecker }: ExProps<'sv-to-pinyin'>) {
  const info = itemInfo(course, ex.item)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    setChecker(sel == null ? null : () => (sel === ex.answer ? { status: 'correct' } : { status: 'wrong', answer: { pinyin: ex.answer } }))
  }, [sel, ex, setChecker])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Hur säger man det här?</Instruction>
      <PromptCard className="self-start text-2xl">”{info.sv}”</PromptCard>
      <ChoiceList
        options={ex.options}
        answer={ex.answer}
        selected={sel}
        onSelect={setSel}
        verdict={verdict}
        settings={settings}
        render={(o) => <PinyinText pinyin={o} colored={settings.toneColors} className="text-xl" />}
      />
    </div>
  )
}
