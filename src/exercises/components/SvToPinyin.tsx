import { useEffect, useState } from 'react'
import { speak } from '../../speech'
import { wordByPinyin } from '../items'
import { PinyinText } from '../../speech/PinyinText'
import { infoFor } from './lineInfo'
import { explainPinyinChoice } from './explain'
import { ChoiceList, Instruction, PromptCard, type ExProps } from './common'

/** See Swedish → pick the pinyin. */
export function SvToPinyin({ ex, course, settings, verdict, setChecker }: ExProps<'sv-to-pinyin'>) {
  const info = infoFor(course, ex.item)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    setChecker(sel == null ? null : () => (sel === ex.answer ? { status: 'correct' } : { status: 'wrong', answer: { pinyin: ex.answer }, explain: explainPinyinChoice(course, sel, ex.answer, info.wordIds) }))
  }, [sel, ex, setChecker, course, info.wordIds])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Hur säger man det här?</Instruction>
      <PromptCard className="self-start text-2xl">”{info.sv}”</PromptCard>
      <ChoiceList
        options={ex.options}
        answer={ex.answer}
        selected={sel}
        onSelect={(o) => {
          setSel(o)
          // Hear each option when tapped (hanzi drives TTS; unknown pinyin stays silent).
          const hanzi = o === ex.answer ? info.hanzi : wordByPinyin(course, o)?.hanzi
          if (hanzi) void speak(hanzi, { rate: settings.speechRate })
        }}
        verdict={verdict}
        settings={settings}
        render={(o) => <PinyinText pinyin={o} colored={settings.toneColors} className="text-xl" />}
      />
    </div>
  )
}
