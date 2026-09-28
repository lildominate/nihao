// OWNER: Speech/Lab agent. "Skugga": listen to a sentence, say it right after (tone meter + recognition + self-grade).
import { useEffect, useMemo, useRef, useState } from 'react'
import { course } from '../data/course'
import { useProgress } from '../progress'
import {
  MicButton, PinyinText, playSfx, recognitionSupport, speak, stopSpeaking, ToneCanvas, toneTargets, useToneRecorder,
  type SpokenCheck,
} from '../speech'
import { celebrate, haptic, replay, Transition } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { shadowItems, type LabItem } from './items'
import { LabScreen, LabSummary, ListenButton, RecordButton, useLabSession, VoiceChip } from './shared'

export function ShadowMode({ onClose }: { onClose: () => void }) {
  const [round, setRound] = useState(0)
  return <ShadowRound key={round} onClose={onClose} onAgain={() => setRound((r) => r + 1)} />
}

function ShadowRound({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const progress = useProgress()
  const { settings } = progress.state
  const [items] = useState<LabItem[]>(() => shadowItems(course, progress.knownWordIds(), 6))
  const [idx, setIdx] = useState(0)
  const [hideText, setHideText] = useState(false)
  const [plays, setPlays] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [check, setCheck] = useState<SpokenCheck | null>(null)
  const [recError, setRecError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReturnType<ReturnType<typeof useLabSession>['finish']> | null>(null)
  const session = useLabSession()
  const item = items[idx]
  const target = useMemo(() => (item ? { pinyin: item.pinyin, hanzi: item.hanzi } : null), [item])
  const targets = useMemo(() => (item ? toneTargets(item.pinyin, item.hanzi) : []), [item])
  const rec = useToneRecorder(target)
  const recog = recognitionSupport()
  const useRecognition = settings.speakingExercises && recog.available

  const play = (slow = false) => {
    setSpeaking(true)
    setPlays((p) => p + 1)
    void speak(item.hanzi, { voice: 'auto', slow, rate: settings.speechRate, onVoice: setVoiceName }).then(() => setSpeaking(false))
  }
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play })
  useEffect(() => {
    if (summary) return
    const t = setTimeout(() => playRef.current(), 400)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [idx, summary])

  const cardRef = useRef<HTMLDivElement>(null)
  const feedback = (ok: boolean) => {
    const card = cardRef.current
    if (ok) { playSfx('correct'); haptic('success'); celebrate('burst', card ? { from: card } : undefined) }
    else { if (card) replay(card, 'shake'); haptic('error') }
  }
  const lastResult = useRef(rec.result)
  useEffect(() => {
    if (!rec.result || rec.result === lastResult.current) return
    lastResult.current = rec.result
    feedback(rec.result.ok)
  }, [rec.result])

  const onCheck = (c: SpokenCheck) => {
    setCheck(c)
    setRecError(null)
    feedback(c.ok)
  }

  const next = (correct: boolean) => {
    session.record(item.key, item.ref, correct)
    stopSpeaking()
    rec.reset()
    setCheck(null); setRecError(null); setPlays(0)
    if (idx + 1 >= items.length) { setSummary(session.finish()); return }
    setIdx(idx + 1)
  }

  if (summary) {
    return (
      <LabScreen title="Skugga" emoji="🗣️" onClose={onClose}>
        <LabSummary title="Bra skuggat!" subtitle="Att härma rytm och melodi är det snabbaste sättet att låta naturlig." stats={summary} onClose={onClose} onAgain={onAgain} />
      </LabScreen>
    )
  }

  const attempted = rec.state === 'done' || !!check
  const autoOk = check?.ok === true
  const tr = rec.result

  return (
    <LabScreen title="Skugga" emoji="🗣️" progress={idx / items.length} onClose={onClose}
      footer={
        autoOk ? (
          <Button className="w-full" onClick={() => next(true)}>Nästa</Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => next(false)}>{attempted ? 'Öva mer' : 'Hoppa över'}</Button>
            <Button className="flex-1" disabled={plays === 0} onClick={() => next(true)}>Det satt!</Button>
          </div>
        )
      }>
      <Transition swapKey={idx} kind="slide" className="flex flex-1 flex-col gap-4 pt-2">
        <div className="flex items-end gap-3">
          <Panda mood={autoOk || tr?.ok ? 'cheer' : speaking ? 'happy' : 'think'} size={60} className="shrink-0" />
          <div className="relative flex-1 rounded-2xl border-2 border-line px-3 py-2 text-sm font-bold">
            <span className="absolute -left-2 bottom-4 h-3 w-3 rotate-45 border-b-2 border-l-2 border-line bg-surface" />
            {speaking ? 'Lyssna på melodin …' : rec.state === 'recording' ? 'Säg det nu – samma takt!' : tr ? tr.feedback : 'Lyssna och säg meningen direkt efter – härma rytm och toner.'}
          </div>
        </div>

        <div ref={cardRef} className="rounded-3xl border-2 border-b-4 border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <VoiceChip name={voiceName} />
            <button type="button" onClick={() => setHideText((h) => !h)} className="ml-auto rounded-full bg-surface-2 px-3 py-1 text-xs font-black text-ink-muted">
              {hideText ? 'Visa text' : 'Dölj text'}
            </button>
          </div>
          <div className={`mt-2 transition-[filter,opacity] ${hideText ? 'select-none opacity-60 blur-md' : ''}`} aria-hidden={hideText}>
            <PinyinText pinyin={item.pinyin} colored={settings.toneColors} className="block text-2xl font-black leading-snug" />
            {settings.showHanzi && <div className="text-ink-muted" lang="zh-CN">{item.hanzi}</div>}
            <div className="mt-1 font-semibold text-ink-muted">{item.sv}</div>
          </div>
          {rec.support.available && (
            <ToneCanvas className="mt-3" height={140} targets={targets} result={rec.state === 'done' ? tr : null}
              live={rec.state === 'recording' || rec.state === 'starting' ? rec.live : null} liveMaxMs={1800 + targets.length * 650} />
          )}
          {tr && rec.state === 'done' && (
            <div className="mt-2 flex items-center gap-2 text-sm font-bold">
              <span className={`rounded-full px-2.5 py-0.5 text-white ${tr.ok ? 'bg-brand' : 'bg-warn'}`}>Toner {tr.score}/100</span>
            </div>
          )}
        </div>

        {check && (
          <div className={`rounded-2xl border-2 p-3 text-sm font-bold animate-fade ${check.ok ? 'border-brand/40 bg-brand-soft text-brand-dark' : 'border-danger/30 bg-danger-soft text-danger'}`}>
            {check.ok ? 'Orden satt! ' : 'Inte riktigt. '}
            <span className="font-semibold text-ink">Jag hörde: {check.heardPinyin || check.heard || '–'}</span>
          </div>
        )}
        {(rec.error || recError) && (
          <div className="rounded-2xl border-2 border-warn/40 bg-warn/10 p-3 text-sm font-semibold">{rec.error ?? recError}</div>
        )}
        {!rec.support.available && !useRecognition && (
          <p className="rounded-2xl bg-surface-2 p-3 text-sm font-semibold text-ink-muted">
            Mikrofonen är inte tillgänglig här. Säg meningen högt direkt efter rösten och bedöm dig själv.
          </p>
        )}

        <div className="mt-auto flex items-center justify-center gap-4 pt-2">
          <ListenButton onClick={() => play(true)} slow />
          <ListenButton onClick={() => play(false)} speaking={speaking} />
          {rec.support.available && (
            <RecordButton recording={rec.state === 'recording'} starting={rec.state === 'starting'} onClick={rec.start} label="Spela in tonerna" />
          )}
        </div>
        {useRecognition && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-surface-2 p-2">
            <span className="text-sm font-bold text-ink-muted">Kolla orden:</span>
            <MicButton className="h-16! w-16!" expected={{ hanzi: item.hanzi, pinyin: item.pinyin }} onResult={onCheck}
              onError={(msg) => setRecError(msg)} />
          </div>
        )}
        {useRecognition && recog.unreliable && recog.hint && <p className="text-center text-xs font-semibold text-ink-muted">{recog.hint}</p>}
      </Transition>
    </LabScreen>
  )
}
