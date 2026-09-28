import { useState } from 'react'
import { MicButton } from '../../speech/MicButton'
import { recognitionSupport } from '../../speech'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import { infoFor } from './lineInfo'
import { Instruction, ItemPinyin, type ExProps } from './common'

const MAX_TRIES = 3

/** Say it → speech recognition. Skippable via the footer ("Kan inte prata nu"). */
export function Speak({ ex, course, settings, verdict, submit }: ExProps<'speak'>) {
  const info = infoFor(course, ex.item)
  const [support] = useState(recognitionSupport)
  const [tries, setTries] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Säg det här</Instruction>
      <div className="flex items-center gap-3">
        <SpeakButton hanzi={info.hanzi} size="md" rate={settings.speechRate} />
        <div className="flex flex-col items-start">
          <ItemPinyin pinyin={info.pinyin} hanzi={info.hanzi} settings={settings} className="text-3xl" />
          <span className="mt-1 text-ink-muted">”{info.sv}”</span>
        </div>
      </div>

      {!support.available ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-ink-muted">
          {support.hint ?? 'Taligenkänning stöds inte här.'} Tryck på <b>Kan inte prata nu</b> för att gå vidare.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 py-2">
          <MicButton
            expected={{ hanzi: info.hanzi, pinyin: info.pinyin }}
            disabled={!!verdict}
            onResult={(c) => {
              setError(null)
              const said = c.heardPinyin || c.heard
              setHeard(said)
              if (c.ok) return submit({ status: 'correct', heard: said })
              const n = tries + 1
              setTries(n)
              if (n >= MAX_TRIES) submit({ status: 'wrong', heard: said, answer: { pinyin: info.pinyin } })
            }}
            onError={(msg) => setError(msg)}
          />
          {!verdict && <p className="text-sm font-bold text-ink-muted">Tryck och säg det</p>}
          {heard != null && !verdict && (
            <div className="animate-fade text-center">
              <p className="text-ink-muted">Jag hörde:</p>
              <PinyinText pinyin={heard || '…'} colored={settings.toneColors} className="text-xl font-bold" />
              <p className="mt-1 font-bold text-danger">Inte riktigt – försök igen! ({tries}/{MAX_TRIES})</p>
            </div>
          )}
          {error && <p className="animate-fade rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger">{error}</p>}
          {support.unreliable && support.hint && !error && <p className="text-center text-xs text-ink-muted">{support.hint}</p>}
        </div>
      )}
    </div>
  )
}
