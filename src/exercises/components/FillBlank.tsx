import { useEffect, useMemo, useState } from 'react'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import { ChoiceList, Instruction, type ExProps } from './common'
import { explainPinyinChoice } from './explain'
import { infoFor, pinyinKey } from './lineInfo'

/** Sentence pinyin with one chunk missing (Swedish meaning shown) → pick the missing chunk. */
export function FillBlank({ ex, course, settings, verdict, setChecker }: ExProps<'fill-blank'>) {
  const info = useMemo(() => infoFor(course, ex.item), [course, ex.item])
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => {
    setChecker(sel == null ? null : () =>
      pinyinKey(sel) === pinyinKey(ex.answer)
        ? { status: 'correct' }
        : { status: 'wrong', answer: { pinyin: info.chunks.join(' ') }, explain: explainPinyinChoice(course, sel, ex.answer, info.wordIds) })
  }, [sel, ex, setChecker, course, info.chunks, info.wordIds])

  const filled = verdict ? ex.answer : sel
  const gapState = !verdict ? (sel ? 'border-sky bg-sky-soft' : 'border-dashed border-ink-muted/50 bg-surface-2') : verdict.status === 'wrong' ? 'border-danger bg-danger-soft' : 'border-brand bg-brand-soft'

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Fyll i det som saknas</Instruction>
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-b-4 border-line bg-surface px-4 py-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 text-2xl leading-snug font-bold" aria-live="polite">
          {info.chunks.map((c, i) =>
            i === ex.blankIndex ? (
              <span key={i} className="inline-flex items-center gap-1">
              <span
                className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-xl border-2 px-2 transition-colors ${gapState}`}
                aria-label={filled ? `Lucka: ${filled}` : 'Tom lucka'}
              >
                {filled ? <span key={filled} className="animate-pop"><PinyinText pinyin={filled} colored={settings.toneColors} /></span> : <span className="text-ink-muted/60" aria-hidden="true">?</span>}
              </span>
              {/* The answer is the bare word; keep the chunk's trailing punctuation ("lǎo shī ,") visible after the gap. */}
              {c.match(/\s*([,.!?，。！？]+)$/)?.[1]}
              </span>
            ) : (
              <PinyinText key={i} pinyin={c} colored={settings.toneColors} />
            ),
          )}
        </div>
        <div className="flex items-center gap-2 border-t-2 border-line pt-3">
          <p className="flex-1 text-ink-muted">”{info.sv}”</p>
          {verdict && <SpeakButton hanzi={info.hanzi} size="sm" rate={settings.speechRate} className="!h-11 !w-11 animate-pop" />}
        </div>
      </div>
      <ChoiceList
        options={ex.options}
        answer={ex.answer}
        selected={sel}
        onSelect={setSel}
        verdict={verdict}
        settings={settings}
        columns={ex.options.every((o) => o.length <= 10) ? 2 : 1}
        render={(o) => <PinyinText pinyin={o} colored={settings.toneColors} className="text-xl" />}
      />
    </div>
  )
}
