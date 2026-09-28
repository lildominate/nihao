// Dialogue / story player: plays lines one by one (TTS), speaker bubbles (A left, B right, N narrator),
// tap a bubble to replay it, Swedish translation toggle. Ends with finishSession({ source: 'dialogue' }).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Dialogue, DialogueLine } from '../types'
import { useProgress } from '../progress'
import { PinyinText, speak, stopSpeaking } from '../speech'
import { CelebrationOverlay, CountUp } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressRing'
import { BookIcon, ChatIcon, CloseIcon, PauseIcon, PlayIcon, ReplayIcon, SpeakerIcon, TranslateIcon, BoltIcon } from './icons'
import { markDialogueSeen } from './util'

const PAUSE_MS = 750
const lineText = (l: DialogueLine) => l.chunks.join(' ')

export function DialogueScreen({ dialogue, onClose }: { dialogue: Dialogue; onClose: () => void }) {
  const { state, finishSession } = useProgress()
  const lines = dialogue.lines
  const story = dialogue.kind === 'story'
  const [shown, setShown] = useState(0)          // lines revealed so far
  const [active, setActive] = useState<number | null>(null)
  const [playing, setPlaying] = useState(true)
  const [showSv, setShowSv] = useState(false)
  const [done, setDone] = useState<{ xp: number } | null>(null)
  const startedAt = useRef(Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const run = useRef(0)

  // Autoplay loop: reveal → speak → pause → next.
  useEffect(() => {
    if (!playing || done) return
    const token = ++run.current
    let timer: ReturnType<typeof setTimeout> | undefined
    const step = async (i: number) => {
      if (token !== run.current) return
      if (i >= lines.length) { setPlaying(false); setActive(null); return }
      setShown((n) => Math.max(n, i + 1))
      setActive(i)
      const t0 = Date.now()
      await speak(lines[i].hanzi, { rate: state.settings.speechRate })
      if (token !== run.current) return
      // Without a zh voice speak() resolves at once — give each line reading time instead.
      const readMs = Math.max(0, lines[i].chunks.join(' ').split(' ').length * 450 - (Date.now() - t0))
      timer = setTimeout(() => step(i + 1), PAUSE_MS + readMs)
    }
    void step(shown)
    return () => { run.current++; if (timer) clearTimeout(timer); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, done])

  useEffect(() => () => stopSpeaking(), [])

  // Keep the newest/active bubble in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${active ?? shown - 1}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [active, shown])

  const replay = async (i: number) => {
    run.current++
    setPlaying(false)
    setActive(i)
    await speak(lines[i].hanzi, { rate: state.settings.speechRate })
    setActive((a) => (a === i ? null : a))
  }

  const restart = () => { run.current++; stopSpeaking(); setShown(0); setActive(null); setPlaying(false); setTimeout(() => setPlaying(true), 50) }

  const finished = shown >= lines.length && !playing
  const finish = () => {
    stopSpeaking()
    const r = finishSession({ lessonId: null, source: 'dialogue', total: 0, correct: 0, mistakes: 0, durationMs: Date.now() - startedAt.current, items: [] })
    markDialogueSeen(dialogue.id)
    setDone({ xp: r.xpEarned })
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 px-4 pt-2 pb-2">
        <button type="button" onClick={() => { stopSpeaking(); onClose() }} aria-label="Stäng" className="-ml-1 grid h-10 w-10 place-items-center rounded-xl text-ink-faint active:bg-surface-2"><CloseIcon size={26} /></button>
        <ProgressBar value={lines.length ? shown / lines.length : 0} className="flex-1" color={story ? 'var(--color-plum)' : 'var(--color-sky)'} />
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 pt-2 pb-6">
        <div className="flex items-start gap-3 rounded-3xl border border-line/80 bg-surface p-4 shadow-card">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${story ? 'bg-plum-soft text-plum' : 'bg-sky-soft text-sky'}`}>
            {story ? <BookIcon size={26} /> : <ChatIcon size={26} />}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-extrabold tracking-wider uppercase ${story ? 'text-plum' : 'text-sky'}`}>{story ? 'Berättelse' : 'Dialog'}</div>
            <h1 className="font-display text-xl leading-tight font-semibold">{dialogue.title}</h1>
            <p className="mt-0.5 text-sm font-semibold text-ink-muted">{dialogue.context}</p>
          </div>
        </div>

        {lines.slice(0, shown).map((l, i) => (
          <Bubble key={i} index={i} line={l} name={l.speaker === 'N' ? '' : dialogue.speakers[l.speaker]} active={active === i}
            showSv={showSv} colored={state.settings.toneColors} onTap={() => void replay(i)} />
        ))}
        {finished && (
          <div className="flex animate-rise flex-col items-center pt-4 text-center">
            <Panda mood="happy" size={88} />
            <p className="font-display text-lg font-semibold">Slut! Vill du höra den igen?</p>
            <p className="text-sm font-semibold text-ink-muted">Tryck på en replik för att lyssna på just den.</p>
          </div>
        )}
      </div>

      <div className="border-t border-line/70 bg-surface/90 px-4 pt-3 pb-4 backdrop-blur">
        {finished ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="shrink-0 px-4" aria-label="Spela från början" onClick={restart}><ReplayIcon size={22} /></Button>
            <Button className="flex-1" size="lg" onClick={finish}>Klar</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setShowSv((v) => !v)} aria-pressed={showSv}
              className={`flex h-12 items-center gap-1.5 rounded-2xl border-2 px-3 text-sm font-extrabold transition-colors ${showSv ? 'border-brand bg-brand-soft text-brand-dark dark:text-brand' : 'border-line text-ink-muted'}`}>
              <TranslateIcon size={20} /> Svenska
            </button>
            <Button size="lg" variant={story ? 'plum' : 'sky'} className="w-20 !rounded-full !px-0" aria-label={playing ? 'Pausa' : 'Spela'}
              onClick={() => { if (playing) { run.current++; stopSpeaking(); setPlaying(false); setActive(null) } else setPlaying(true) }}>
              {playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
            </Button>
            <button type="button" onClick={restart} className="flex h-12 items-center gap-1.5 rounded-2xl border-2 border-line px-3 text-sm font-extrabold text-ink-muted">
              <ReplayIcon size={18} /> Om
            </button>
          </div>
        )}
      </div>
      <CelebrationOverlay open={!!done} title={story ? 'Berättelsen är slut!' : 'Bra lyssnat!'}
        subtitle={`Du hörde ${lines.length} repliker på kinesiska.`} mood="cheer" confetti="stars" onClose={onClose}>
        <div className="flex items-center gap-2 rounded-2xl bg-warn-soft px-5 py-3 font-display text-2xl font-semibold text-warn-dark">
          <BoltIcon size={26} /> +<CountUp value={done?.xp ?? 0} from={0} /> XP
        </div>
      </CelebrationOverlay>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-canvas canvas-bg">
      <div className="mx-auto flex h-full max-w-md flex-col pt-safe pb-safe px-safe">{children}</div>
    </div>
  )
}

function Bubble({ index, line, name, active, showSv, colored, onTap }: {
  index: number; line: DialogueLine; name: string; active: boolean; showSv: boolean; colored: boolean; onTap: () => void
}) {
  if (line.speaker === 'N') {
    return (
      <button type="button" data-line={index} onClick={onTap}
        className={`block w-full animate-rise rounded-3xl border-2 bg-surface px-4 py-3 text-center shadow-card transition-colors ${active ? 'border-plum' : 'border-transparent'}`}>
        <PinyinText pinyin={lineText(line)} colored={colored} className="text-[19px] leading-snug font-extrabold" />
        {showSv && <div className="mt-1 text-sm font-semibold text-ink-muted italic">{line.sv}</div>}
      </button>
    )
  }
  const right = line.speaker === 'B'
  const color = right ? 'var(--color-sky)' : 'var(--color-brand)'
  return (
    <div data-line={index} className={`flex animate-rise items-end gap-2 ${right ? 'flex-row-reverse' : ''}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-semibold text-white shadow-soft" style={{ background: color }} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <button type="button" onClick={onTap}
        className={`relative max-w-[78%] rounded-3xl border-2 px-4 py-2.5 text-left shadow-card transition-[border-color,transform] active:scale-[0.98] ${right ? 'rounded-br-md' : 'rounded-bl-md'} ${active ? '' : 'border-transparent'} bg-surface`}
        style={active ? { borderColor: color } : undefined}>
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide uppercase" style={{ color }}>
          {name}
          <SpeakerIcon size={13} className={active ? 'animate-pulse' : 'opacity-60'} />
        </div>
        <PinyinText pinyin={lineText(line)} colored={colored} className="text-[19px] leading-snug font-extrabold" />
        {showSv && <div className="mt-1 text-sm leading-snug font-semibold text-ink-muted">{line.sv}</div>}
      </button>
    </div>
  )
}
