// OWNER: Speech/Lab agent. "Tonmätaren": say a word, see your pitch over the ideal tone contour.
import { useEffect, useMemo, useRef, useState } from 'react'
import { course } from '../data/course'
import { useProgress } from '../progress'
import {
  PinyinText, playSfx, SHAPE_SV, speak, stopSpeaking, ToneCanvas, toneTargets, useToneRecorder,
} from '../speech'
import { toneTextClass } from '../speech/pinyin'
import { celebrate, haptic, replay, Transition } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { toneItems, type LabItem } from './items'
import { LabScreen, LabSummary, ListenButton, RecordButton, useLabSession, VoiceChip } from './shared'

const PASS = 60

export function ToneMode({ onClose }: { onClose: () => void }) {
  const [round, setRound] = useState(0)
  return <ToneRound key={round} onClose={onClose} onAgain={() => setRound((r) => r + 1)} />
}

function ToneRound({ onClose, onAgain }: { onClose: () => void; onAgain: () => void }) {
  const progress = useProgress()
  const { settings } = progress.state
  const [items] = useState<LabItem[]>(() => toneItems(course, progress.knownWordIds(), 8))
  const [idx, setIdx] = useState(0)
  const [best, setBest] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [summary, setSummary] = useState<ReturnType<ReturnType<typeof useLabSession>['finish']> | null>(null)
  const session = useLabSession()
  const item = items[idx]
  const target = useMemo(() => (item ? { pinyin: item.pinyin, hanzi: item.hanzi } : null), [item])
  const targets = useMemo(() => (item ? toneTargets(item.pinyin, item.hanzi) : []), [item])
  const rec = useToneRecorder(target)
  const [speaking, setSpeaking] = useState(false)
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const [selfGrade, setSelfGrade] = useState(false)

  const play = (slow = false) => {
    setSpeaking(true)
    // multi-voice: each replay may use a different speaker (high-variability training)
    void speak(item.hanzi, { voice: 'auto', slow, rate: settings.speechRate, onVoice: setVoiceName }).then(() => setSpeaking(false))
  }

  // autoplay each new item
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play })
  useEffect(() => {
    if (summary) return
    const t = setTimeout(() => playRef.current(), 350)
    return () => { clearTimeout(t); stopSpeaking() }
  }, [idx, summary])

  // react to a finished attempt
  const cardRef = useRef<HTMLDivElement>(null)
  const lastResult = useRef(rec.result)
  useEffect(() => {
    if (!rec.result || rec.result === lastResult.current) return
    lastResult.current = rec.result
    setAttempts((a) => a + 1)
    setBest((b) => Math.max(b, rec.result!.score))
    const card = cardRef.current
    if (rec.result.score >= PASS) {
      playSfx('correct'); haptic('success')
      celebrate('burst', card ? { from: card } : undefined)
    } else {
      if (card) replay(card, 'shake')
      haptic('error')
    }
  }, [rec.result])

  const next = (correctOverride?: boolean) => {
    const correct = correctOverride ?? best >= PASS
    session.record(item.key, item.ref, correct)
    stopSpeaking()
    rec.reset()
    if (idx + 1 >= items.length) {
      setSummary(session.finish())
      return
    }
    setIdx(idx + 1); setBest(0); setAttempts(0); setSelfGrade(false)
  }

  const micBlocked = !rec.support.available || !!rec.error
  const result = rec.result
  const mood = rec.state === 'recording' ? 'think' : result ? (result.ok ? 'cheer' : 'happy') : 'wave'

  if (summary) {
    return (
      <LabScreen title="Tonmätaren" emoji="📈" onClose={onClose}>
        <LabSummary title="Tonerna tränade!" subtitle={summary.correct >= summary.total * 0.8 ? 'Dina toner sitter riktigt bra.' : 'Varje försök tränar örat och rösten.'} stats={summary} onClose={onClose} onAgain={onAgain} />
      </LabScreen>
    )
  }

  return (
    <LabScreen title="Tonmätaren" emoji="📈" progress={idx / items.length} onClose={onClose}
      footer={
        <div className="flex gap-3">
          {attempts === 0 && !selfGrade ? (
            <Button variant="ghost" className="flex-1" onClick={() => next(false)}>Hoppa över</Button>
          ) : null}
          {selfGrade ? (
            <>
              <Button variant="secondary" className="flex-1" onClick={() => next(false)}>Öva mer</Button>
              <Button className="flex-1" onClick={() => next(true)}>Lät rätt!</Button>
            </>
          ) : (
            <Button className="flex-1" disabled={attempts === 0} onClick={() => next()}>
              {best >= PASS ? 'Nästa' : attempts > 0 ? 'Gå vidare' : 'Nästa'}
            </Button>
          )}
        </div>
      }>
      <Transition swapKey={idx} kind="slide" className="flex flex-1 flex-col gap-4 pt-2">
        <div className="flex items-end gap-3">
          <Panda mood={mood} size={64} className="shrink-0" />
          <div className="relative flex-1 rounded-2xl border-2 border-line bg-surface px-3 py-2 text-sm font-bold text-ink">
            <span className="absolute -left-2 bottom-4 h-3 w-3 rotate-45 border-b-2 border-l-2 border-line bg-surface" />
            {rec.state === 'recording' ? 'Jag lyssnar … säg ordet!' : result ? result.feedback : 'Lyssna, tryck på mikrofonen och härma tonen.'}
          </div>
        </div>

        <div ref={cardRef} className="rounded-3xl border-2 border-b-4 border-line p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <PinyinText pinyin={item.pinyin} colored={settings.toneColors} className="block text-4xl font-black tracking-tight" />
              {settings.showHanzi && <div className="mt-0.5 text-lg text-ink-muted" lang="zh-CN">{item.hanzi}</div>}
              <div className="mt-1 font-semibold text-ink-muted">{item.sv}</div>
            </div>
            <VoiceChip name={voiceName} />
          </div>
          <ToneCanvas className="mt-3" targets={targets} result={rec.state === 'done' ? result : null}
            live={rec.state === 'recording' || rec.state === 'starting' ? rec.live : null}
            liveMaxMs={1800 + targets.length * 650} />
          <div className="mt-1 flex items-center gap-3 text-xs font-bold text-ink-muted">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-5 rounded-full bg-tone-3/30" /> mål</span>
            <span className="inline-flex items-center gap-1"><span className="h-1 w-5 rounded-full bg-ink" /> din röst</span>
            {best > 0 && <span className="ml-auto">Bäst: {best}/100</span>}
          </div>
        </div>

        {result && rec.state === 'done' && (
          <div className="flex flex-wrap gap-2 animate-fade">
            {result.syllables.filter((s) => s.scored).map((s, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-1.5 ${s.ok ? 'border-brand/40 bg-brand-soft' : 'border-danger/30 bg-danger-soft'}`}>
                <span className={`text-lg font-black ${toneTextClass(s.surface)}`}>{s.text}</span>
                <span className="text-xs font-bold text-ink-muted">{SHAPE_SV[s.shape]}</span>
                <span className={`text-sm font-black ${s.ok ? 'text-brand-dark' : 'text-danger'}`}>{s.score}</span>
              </div>
            ))}
            {result.syllables.some((s) => s.surface !== s.tone) && (
              <p className="w-full text-xs font-semibold text-ink-muted">Tonen ändras här (tonsandhi) – kurvan visar hur det faktiskt låter.</p>
            )}
          </div>
        )}

        {micBlocked && (
          <div className="rounded-2xl border-2 border-warn/40 bg-warn/10 p-3 text-sm font-semibold">
            {rec.error ?? rec.support.message}
            {!selfGrade && (
              <button type="button" className="mt-2 block font-black text-sky-dark underline" onClick={() => setSelfGrade(true)}>
                Öva utan mikrofon – bedöm dig själv
              </button>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-center gap-5 pt-2 pb-1">
          <ListenButton onClick={() => play(true)} slow />
          <RecordButton recording={rec.state === 'recording'} starting={rec.state === 'starting'}
            disabled={!rec.support.available} onClick={rec.start} label="Spela in din röst" />
          <ListenButton onClick={() => play(false)} speaking={speaking} />
        </div>
        <p className="text-center text-xs font-semibold text-ink-muted">
          {rec.state === 'recording' ? 'Tryck igen för att sluta' : 'Mikrofonen stängs av automatiskt när du tystnar'}
        </p>
      </Transition>
    </LabScreen>
  )
}
