import { useMemo, useState } from 'react'
import { recognitionSupport } from '../../speech'
import { MicButton } from '../../speech/MicButton'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import { Instruction, ItemPinyin, type ExProps } from './common'
import { infoFor, tidyPinyin } from './lineInfo'
import { PRESS } from './util'

/**
 * Shadowing: listen, then repeat aloud. Uses the mic when recognition works, but the learner can
 * always self-grade ("Jag sa det rätt" / "Öva igen") — never blocks. Skippable via the footer.
 */
export function Shadow({ ex, course, settings, verdict, submit }: ExProps<'shadow'>) {
  const info = useMemo(() => infoFor(course, ex.item), [course, ex.item])
  const [support] = useState(recognitionSupport)
  const useMic = support.available && settings.speakingExercises
  const [tries, setTries] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listened, setListened] = useState(false)
  const [manual, setManual] = useState(false)
  const selfGrade = !useMic || support.unreliable || manual || tries > 0 || !!error

  const btn = `flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-b-4 px-3 py-3 text-base font-extrabold ${PRESS}`

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Lyssna och säg efter</Instruction>

      <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-b-4 border-line bg-surface px-4 py-5 text-center">
        <ItemPinyin pinyin={tidyPinyin(info.pinyin)} hanzi={info.hanzi} settings={settings} className={info.chunks.length > 4 ? 'text-2xl' : 'text-4xl'} />
        <p className="text-ink-muted">”{info.sv}”</p>
        <div className="flex items-end gap-4">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={settings.speechRate} onEnd={() => setListened(true)} />
          <SpeakButton hanzi={info.hanzi} size="md" slow rate={settings.speechRate} onEnd={() => setListened(true)} />
        </div>
      </div>

      <ol className="flex justify-center gap-2 text-sm font-bold" aria-label="Steg">
        <li className={`rounded-full px-3 py-1 ${listened ? 'bg-brand-soft text-brand-dark' : 'bg-sky-soft text-sky-dark'}`}>1. Lyssna {listened && '✓'}</li>
        <li className={`rounded-full px-3 py-1 ${listened ? 'bg-sky-soft text-sky-dark' : 'bg-surface-2 text-ink-muted'}`}>2. Säg det högt – samma melodi</li>
      </ol>

      {useMic && (
        <div className="flex flex-col items-center gap-3">
          <MicButton
            expected={{ hanzi: info.hanzi, pinyin: info.pinyin }}
            disabled={!!verdict}
            onResult={(c) => {
              setError(null)
              const said = c.heardPinyin || c.heard
              setHeard(said)
              if (c.ok) return submit({ status: 'correct', heard: said })
              setTries((n) => n + 1)
            }}
            onError={(msg) => setError(msg)}
          />
          {!verdict && heard == null && !error && <p className="text-sm font-bold text-ink-muted">Tryck och säg det</p>}
          {!verdict && !selfGrade && (
            <button type="button" onClick={() => setManual(true)} className="press min-h-11 rounded-full px-4 text-sm font-extrabold text-sky-dark hover:bg-sky-soft">
              Bedöm själv i stället
            </button>
          )}
          {heard != null && !verdict && (
            <div className="animate-fade text-center" aria-live="polite">
              <p className="text-ink-muted">Jag hörde:</p>
              <PinyinText pinyin={heard || '…'} colored={settings.toneColors} className="text-xl font-bold" />
              <p className="mt-1 text-sm font-bold text-ink-muted">Försök igen – eller bedöm själv nedan.</p>
            </div>
          )}
          {error && <p className="animate-fade rounded-2xl bg-danger-soft px-4 py-3 text-center text-danger" aria-live="polite">{error}</p>}
        </div>
      )}

      {selfGrade && !verdict && (
        <div className="flex animate-fade flex-col gap-2">
          {!useMic && <p className="text-center text-sm text-ink-muted">Säg det högt och jämför med ljudet. Hur gick det?</p>}
          <div className="flex gap-3">
            <button
              type="button"
              className={`${btn} border-line bg-surface text-ink hover:bg-surface-2`}
              onClick={() => submit({ status: 'wrong', soft: true, title: 'Öva lite till', note: 'Ingen fara – den kommer tillbaka strax.' })}
            >
              <span aria-hidden="true">↻</span> Öva igen
            </button>
            <button
              type="button"
              className={`${btn} border-brand-dark bg-brand text-white`}
              onClick={() => submit({ status: 'correct', heard: heard ?? undefined })}
            >
              <span aria-hidden="true">✓</span> Jag sa det rätt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
