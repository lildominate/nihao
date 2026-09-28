// OWNER: Lesson-engine agent. Full-screen player: progress bar, exercise, check/continue footer.
// On completion it plays the 'complete' sfx and calls onFinish immediately; the shell shows the celebration screen.
// v2 (agent 2): new exercise types, teaching feedback panel with Pānpan, combo milestones, optional onSummary export.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Course, Exercise, ItemResult, LessonResult, Settings } from '../types'
import { course as defaultCourse } from '../data/course'
import { useProgress } from '../progress'
import { Panda } from '../mascot/Panda'
import { celebrate, haptic, replay, Transition } from '../motion'
import { SpeakButton } from '../speech/SpeakButton'
import { recognitionSupport, setDefaultSpeechRate, speak, stopListening, stopSpeaking } from '../speech'
import { PinyinText } from '../speech/PinyinText'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import type { ExProps, Verdict } from './components/common'
import { sfx } from './components/util'
import { audioFor, tidyPinyin } from './components/lineInfo'
import { summarizeLesson, type LessonSummary } from './components/summary'
import { FillBlank } from './components/FillBlank'
import { ListenBuild } from './components/ListenBuild'
import { DialogueReply } from './components/DialogueReply'
import { Shadow } from './components/Shadow'
import { Intro } from './components/Intro'
import { ListenChoose } from './components/ListenChoose'
import { PinyinToSv } from './components/PinyinToSv'
import { SvToPinyin } from './components/SvToPinyin'
import { TonePick } from './components/TonePick'
import { MatchPairs } from './components/MatchPairs'
import { BuildPinyin } from './components/BuildPinyin'
import { BuildSv } from './components/BuildSv'
import { TypePinyin } from './components/TypePinyin'
import { Speak } from './components/Speak'

export interface LessonPlayerProps {
  exercises: Exercise[]
  lessonId: string | null
  title?: string
  onFinish: (result: LessonResult) => void   // called when learner taps "Fortsätt" on the result screen
  onExit: () => void                         // X button (confirm first)
  /** Defaults to the app course (src/data/course). */
  course?: Course
  /** Optional: called right before onFinish with per-item data for "Ord du övade" in the shell's celebration. */
  onSummary?: (summary: LessonSummary) => void
}

export type { LessonSummary, PractisedItem } from './components/summary'

interface QItem { ex: Exercise; orig: number; attempt: number; uid: number }

const PRAISE = ['Bra jobbat!', 'Snyggt!', 'Utmärkt!', 'Helt rätt!', 'Toppen!', 'Klockrent!', 'Perfekt!', 'Grymt!', 'Du har koll!', 'Kanon!', 'Så ska det låta!', 'Hǎo! Jättebra!']
const RETRY_PRAISE = ['Nu sitter det!', 'Där satt den!', 'Snyggt – nu kan du den!', 'Bättre än förra gången!']
const WRONG_TITLE = ['Inte riktigt', 'Oj, inte den', 'Inte den här gången']

/** Combo milestones: message + celebration. */
function comboMilestone(n: number): { text: string; fx: 'burst' | 'stars' | 'fireworks' } | null {
  if (n === 5) return { text: '5 i rad – du är varm! 🔥', fx: 'burst' }
  if (n === 10) return { text: '10 i rad – ostoppbar! 🔥🔥', fx: 'stars' }
  if (n === 15) return { text: '15 i rad – mästarklass! 🏆', fx: 'fireworks' }
  if (n > 15 && n % 5 === 0) return { text: `${n} i rad – helt otroligt! 🏆`, fx: 'fireworks' }
  return null
}

function pick<T>(arr: T[], not?: T): T {
  const pool = arr.length > 1 && not !== undefined ? arr.filter((x) => x !== not) : arr
  return pool[Math.floor(Math.random() * pool.length)]
}

const isSpeaking = (e: Exercise) => e.type === 'speak' || e.type === 'shadow'

// Local keyframes (CSS only) used by exercise components.
const STYLES = `@keyframes nh-draw{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.nh-draw{stroke-dasharray:100;stroke-dashoffset:100;animation:nh-draw .7s cubic-bezier(.4,0,.2,1) forwards}
@keyframes nh-shine{0%{transform:translateX(-120%)}60%,100%{transform:translateX(320%)}}
.nh-shine{animation:nh-shine 2.6s ease-in-out infinite}
@keyframes nh-panda-in{0%{transform:translateY(40%) scale(.7) rotate(-8deg);opacity:0}60%{transform:translateY(-6%) scale(1.06) rotate(3deg);opacity:1}100%{transform:none}}
.nh-panda-in{animation:nh-panda-in .5s cubic-bezier(.34,1.56,.64,1) both}
@media (prefers-reduced-motion: reduce){.nh-shine{animation:none;opacity:0}.nh-draw{animation:none;stroke-dashoffset:0}}`

function ExerciseView(p: Omit<ExProps<Exercise['type']>, 'ex'> & { ex: Exercise }): ReactNode {
  const { ex, ...rest } = p
  switch (ex.type) {
    case 'intro': return <Intro ex={ex} {...rest} />
    case 'listen-choose': return <ListenChoose ex={ex} {...rest} />
    case 'pinyin-to-sv': return <PinyinToSv ex={ex} {...rest} />
    case 'sv-to-pinyin': return <SvToPinyin ex={ex} {...rest} />
    case 'tone-pick': return <TonePick ex={ex} {...rest} />
    case 'match-pairs': return <MatchPairs ex={ex} {...rest} />
    case 'build-pinyin': return <BuildPinyin ex={ex} {...rest} />
    case 'build-sv': return <BuildSv ex={ex} {...rest} />
    case 'type-pinyin': return <TypePinyin ex={ex} {...rest} />
    case 'speak': return <Speak ex={ex} {...rest} />
    case 'fill-blank': return <FillBlank ex={ex} {...rest} />
    case 'listen-build': return <ListenBuild ex={ex} {...rest} />
    case 'dialogue-reply': return <DialogueReply ex={ex} {...rest} />
    case 'shadow': return <Shadow ex={ex} {...rest} />
  }
}

export function LessonPlayer({ exercises, lessonId, onFinish, onExit, course = defaultCourse, onSummary }: LessonPlayerProps) {
  const { state: { settings } } = useProgress()
  const [support] = useState(recognitionSupport)

  // Speaking exercises are dropped up-front when the mic can't work or the learner turned them off.
  // Shadowing works without a mic (self-graded), so it only needs speaking to be switched on.
  const initial = useMemo(() => {
    const keepSpeak = settings.speakingExercises && support.available
    return exercises.filter((e) => (e.type === 'speak' ? keepSpeak : e.type === 'shadow' ? settings.speakingExercises : true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises])

  const [queue, setQueue] = useState<QItem[]>(() => initial.map((ex, i) => ({ ex, orig: i, attempt: 0, uid: i })))
  const [pos, setPos] = useState(0)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [canCheck, setCanCheck] = useState(false)
  const [combo, setCombo] = useState(0)
  const [done, setDone] = useState<Set<number>>(() => new Set())
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())
  const [confirmExit, setConfirmExit] = useState(false)
  const [praise, setPraise] = useState(PRAISE[0])
  const [wrongTitle, setWrongTitle] = useState(WRONG_TITLE[0])
  const [milestone, setMilestone] = useState<string | null>(null)
  const bestCombo = useRef(0)

  const checker = useRef<(() => Verdict) | null>(null)
  const actionRef = useRef<HTMLDivElement>(null)   // footer action area (particles origin)
  const comboRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)     // exercise body (shakes on a wrong answer)
  const log = useRef<ItemResult[]>([])
  const mistakes = useRef(0)
  const firstCorrect = useRef(0)
  const startedAt = useRef(Date.now())
  const uidSeq = useRef(initial.length)
  const audioTimer = useRef<number | undefined>(undefined)
  // Ref guards: two quick taps/Enters can arrive before React re-renders.
  const gradedUid = useRef(-1)
  const advancedFrom = useRef(-1)
  const finished = useRef(false)

  const current = queue[pos] as QItem | undefined

  useEffect(() => { setDefaultSpeechRate(settings.speechRate) }, [settings.speechRate])
  useEffect(() => () => { clearTimeout(audioTimer.current); stopSpeaking(); stopListening() }, [])

  const setChecker = useCallback((fn: (() => Verdict) | null) => {
    checker.current = fn
    setCanCheck(!!fn)
  }, [])

  const progressTotal = initial.length - skipped.size
  const progress = progressTotal > 0 ? done.size / progressTotal : 0

  const finish = (skip: Set<number>) => {
    const r: LessonResult = {
      lessonId,
      total: initial.filter((e, i) => e.type !== 'intro' && !skip.has(i)).length,
      correct: firstCorrect.current,
      mistakes: mistakes.current,
      durationMs: Date.now() - startedAt.current,
      items: [...log.current],
    }
    sfx(settings, 'complete')
    haptic('success')
    if (onSummary) {
      try { onSummary(summarizeLesson(r, course, initial, bestCombo.current)) } catch { /* summary is optional */ }
    }
    // The shell shows its own celebration screen, so hand off immediately (no double result screen).
    done_(r)
  }

  const advance = (q: QItem[] = queue, skip: Set<number> = skipped) => {
    if (advancedFrom.current === pos) return
    advancedFrom.current = pos
    clearTimeout(audioTimer.current)
    stopSpeaking()
    checker.current = null
    setCanCheck(false)
    setVerdict(null)
    setMilestone(null)
    if (pos + 1 >= q.length) finish(skip)
    else setPos(pos + 1)
  }

  const grade = (v: Verdict) => {
    if (!current || verdict || gradedUid.current === current.uid) return
    gradedUid.current = current.uid
    const { ex } = current
    const ok = v.status !== 'wrong'
    setVerdict(v)

    // Log every attempt (retries included) — progress grades SRS by the first attempt per item.
    if (ex.type === 'match-pairs') {
      const missed = new Set((v.mistakeItems ?? []).map((r) => `${r.kind}:${r.id}`))
      for (const item of ex.items) log.current.push({ item, correct: !missed.has(`${item.kind}:${item.id}`) })
      mistakes.current += missed.size
      if (current.attempt === 0 && missed.size === 0) firstCorrect.current++
    } else {
      log.current.push({ item: ex.item, correct: ok })
      if (!ok) mistakes.current++
      if (ok && current.attempt === 0) firstCorrect.current++
    }

    if (ok) {
      const c = combo + 1
      setCombo(c)
      bestCombo.current = Math.max(bestCombo.current, c)
      setDone((d) => new Set(d).add(current.orig))
      setPraise((p) => pick(current.attempt > 0 ? RETRY_PRAISE : PRAISE, p))
      sfx(settings, 'correct')
      haptic('success')
      const m = comboMilestone(c)
      setMilestone(m?.text ?? null)
      if (m) celebrate(m.fx === 'burst' ? 'stars' : m.fx, { from: comboRef.current ?? undefined })
      else celebrate('burst', { from: actionRef.current ?? undefined, intensity: 0.6 })
      const audio = audioFor(course, ex)
      if (audio) {
        clearTimeout(audioTimer.current)
        audioTimer.current = window.setTimeout(() => { void speak(audio, { rate: settings.speechRate }) }, 350)
      }
    } else {
      setCombo(0)
      setMilestone(null)
      setWrongTitle((t) => pick(WRONG_TITLE, t))
      if (!v.soft) { sfx(settings, 'wrong'); haptic('error'); replay(bodyRef.current, 'shake') }
      // Duolingo-style: re-queue the mistake at the end until answered correctly.
      setQueue((q) => [...q, { ex: current.ex, orig: current.orig, attempt: current.attempt + 1, uid: uidSeq.current++ }])
    }
  }

  const check = () => {
    if (checker.current && !verdict) grade(checker.current())
  }

  const continueIntro = () => {
    if (!current) return
    setDone((d) => new Set(d).add(current.orig))
    advance()
  }

  /** "Kan inte prata nu": skip this and every remaining speak/shadow exercise in the lesson. */
  const skipSpeaking = () => {
    const skip = new Set(skipped)
    queue.forEach((q, i) => { if (i >= pos && isSpeaking(q.ex) && !done.has(q.orig)) skip.add(q.orig) })
    setSkipped(skip)
    const q = queue.filter((item, i) => i <= pos || !isSpeaking(item.ex))
    setQueue(q)
    stopListening()
    advance(q, skip)
  }

  const done_ = (r: LessonResult) => {
    if (finished.current) return
    finished.current = true
    onFinish(r)
  }

  // Enter = check / continue (desktop keyboards; mobile "done" key in the text input).
  const keyRef = useRef<() => void>(() => {})
  keyRef.current = () => {
    if (!current) return
    if (verdict) return advance()
    if (current.ex.type === 'intro') return continueIntro()
    if (checker.current) check()
  }
  const exitOpen = useRef(false)
  exitOpen.current = confirmExit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat || exitOpen.current) return
      // Handle Enter globally (also on a focused option/tile button) so it always means check/continue.
      e.preventDefault()
      keyRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])


  // ─── Empty lesson ──────────────────────────────────────────
  if (!current) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <Panda mood="think" size={120} />
          <p className="text-xl font-extrabold">Inga övningar här ännu</p>
          <Button onClick={onExit}>Tillbaka</Button>
        </div>
      </Shell>
    )
  }

  const ex = current.ex
  const isIntro = ex.type === 'intro'
  const speaking = isSpeaking(ex)
  const showCombo = combo >= 2
  const heat = combo >= 10 ? 2 : combo >= 5 ? 1 : 0
  const barFill = heat === 2
    ? 'linear-gradient(90deg, var(--color-flame), var(--color-tone-1))'
    : heat === 1
      ? 'linear-gradient(90deg, var(--color-gold), var(--color-flame))'
      : 'linear-gradient(90deg, var(--color-brand), #22c55e)'
  const feedbackAudio = verdict ? (verdict.audio ?? audioFor(course, ex)) : ''
  const liveText = !verdict ? '' : verdict.status === 'wrong'
    ? [verdict.title ?? wrongTitle, verdict.answer ? `Rätt svar: ${verdict.answer.pinyin ?? verdict.answer.text}` : '', verdict.explain ?? '', verdict.note ?? ''].filter(Boolean).join('. ')
    : [verdict.status === 'almost' ? (verdict.title ?? 'Nästan! Kolla tonerna') : praise, milestone ?? '', verdict.explain ?? ''].filter(Boolean).join('. ')

  return (
    <Shell>
      {/* Header */}
      <header className="pt-safe px-safe">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label="Avsluta lektionen"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[transform,color,background-color] duration-100 hover:bg-surface-2 hover:text-ink active:scale-90"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
          <div
            className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-2 shadow-[inset_0_2px_3px_rgba(0,0,0,0.08)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Framsteg"
          >
            <div
              className="relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
              style={{ width: `${Math.max(progress * 100, 3)}%`, background: barFill, boxShadow: heat ? '0 0 10px rgba(249,115,22,0.55)' : undefined }}
            >
              {/* gloss + travelling shine */}
              <div className="absolute inset-x-2 top-[3px] h-[4px] rounded-full bg-white/40" />
              <div className="nh-shine absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            </div>
          </div>
          <div
            className={`flex min-w-12 items-center justify-end gap-0.5 font-extrabold transition-[color,opacity,transform] ${showCombo ? 'text-flame opacity-100' : 'text-line opacity-60'} ${heat ? 'scale-110' : ''}`}
            ref={comboRef}
            aria-label={`${combo} rätt i rad`}
          >
            <span key={combo} className={showCombo ? 'animate-pop' : ''} aria-hidden="true">🔥</span>
            <span className="tabular-nums">{combo}</span>
          </div>
        </div>
      </header>

      {/* Exercise */}
      <main className="px-safe flex-1 overflow-x-hidden overflow-y-auto">
        <Transition swapKey={current.uid} kind="slide" className="mx-auto w-full max-w-md px-4 pt-4 pb-8">
          {current.attempt > 0 && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-extrabold tracking-wide text-danger uppercase">
              ↻ Tidigare misstag
            </p>
          )}
          <div ref={bodyRef}>
            <ExerciseView ex={ex} course={course} settings={settings} verdict={verdict} setChecker={setChecker} submit={grade} />
          </div>
        </Transition>
      </main>

      {/* Screen-reader announcement of the result (region is always mounted so changes are read). */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{liveText}</div>

      {/* Footer */}
      <Footer
        verdict={verdict}
        praise={praise}
        wrongTitle={wrongTitle}
        milestone={milestone}
        audio={feedbackAudio}
        settings={settings}
        onContinue={() => advance()}
        actionRef={actionRef}
      >
        {isIntro ? (
          <Button className="w-full" onClick={continueIntro}>Fortsätt</Button>
        ) : speaking ? (
          <Button variant={ex.type === 'speak' && (support.unreliable || !support.available) ? 'secondary' : 'ghost'} className="w-full" onClick={skipSpeaking}>
            Kan inte prata nu
          </Button>
        ) : (
          <Button className="w-full" disabled={!canCheck} onClick={check}>Kontrollera</Button>
        )}
      </Footer>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} labelledBy="nh-exit-title">
        <div className="flex flex-col items-center gap-2 text-center">
          <Panda mood="sad" size={104} className="nh-panda-in" />
          <h2 id="nh-exit-title" className="text-xl font-extrabold">Vill du verkligen sluta nu?</h2>
          <p className="text-ink-muted">
            {done.size > 0 ? `Du har klarat ${done.size} av ${progressTotal} – ` : ''}Pānpan blir ledsen, och framstegen i den här lektionen sparas inte.
          </p>
          <div className="mt-3 flex w-full flex-col gap-2">
            <Button className="w-full" onClick={() => setConfirmExit(false)} autoFocus>Fortsätt lära dig</Button>
            <Button variant="ghost" className="w-full !text-danger" onClick={() => { stopSpeaking(); stopListening(); onExit() }}>Avsluta</Button>
          </div>
        </div>
      </Sheet>
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 bg-surface text-ink">
      <style>{STYLES}</style>
      <div className="mx-auto flex h-full w-full max-w-md flex-col">{children}</div>
    </div>
  )
}

function Footer({ verdict, praise, wrongTitle, milestone, audio, settings, onContinue, actionRef, children }: {
  verdict: Verdict | null
  praise: string
  wrongTitle: string
  milestone: string | null
  audio: string
  settings: Settings
  onContinue: () => void
  actionRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  if (!verdict) {
    return (
      <footer className="px-safe pb-safe border-t-2 border-line bg-surface">
        <div ref={actionRef} className="mx-auto w-full max-w-md px-4 pt-4 pb-4">{children}</div>
      </footer>
    )
  }
  const wrong = verdict.status === 'wrong'
  const almost = verdict.status === 'almost'
  const soft = wrong && verdict.soft
  const bg = soft ? 'bg-sky-soft' : wrong ? 'bg-danger-soft' : almost ? 'bg-[#fef3c7]' : 'bg-brand-soft'
  const fg = soft ? 'text-sky-dark' : wrong ? 'text-danger' : almost ? 'text-[#92400e]' : 'text-brand-dark'
  const title = wrong ? (verdict.title ?? wrongTitle) : almost ? (verdict.title ?? 'Nästan! Kolla tonerna') : (verdict.title ?? praise)
  const showAnswer = verdict.answer && (wrong || almost)
  return (
    <footer className={`px-safe pb-safe relative animate-sheet rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${bg}`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-3 pb-4">
        <div className={`flex items-center gap-2 ${fg}`}>
          <Panda mood={wrong || almost ? 'think' : 'cheer'} size={60} className="nh-panda-in -mt-10 -mb-1 shrink-0 drop-shadow-md" />
          <p className="flex min-w-0 flex-1 items-center gap-2 text-xl leading-tight font-extrabold">
            <span className="pop-in flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-base font-black" aria-hidden="true">
              {soft ? '↻' : wrong ? '✕' : almost ? '!' : '✓'}
            </span>
            <span className="min-w-0">{title}</span>
          </p>
          {audio && (
            <SpeakButton hanzi={audio} size="sm" rate={settings.speechRate} label="Lyssna på rätt svar" className="!h-11 !w-11 shrink-0" />
          )}
        </div>
        {(milestone && !wrong) || showAnswer || ((wrong || almost) && verdict.explain) || verdict.note || verdict.heard ? (
          <div className={`-mt-1 flex flex-col gap-1 ${fg}`}>
            {milestone && !wrong && (
              <p className="pop-in delay-2 self-start rounded-full bg-flame px-3 py-0.5 text-sm font-extrabold text-white">{milestone}</p>
            )}
            {showAnswer && (
              <div>
                <span className="text-sm font-bold opacity-80">Rätt svar:</span>
                {verdict.answer!.pinyin && (
                  <p className="text-2xl leading-tight font-extrabold break-words"><PinyinText pinyin={tidyPinyin(verdict.answer!.pinyin)} colored={settings.toneColors} /></p>
                )}
                {verdict.answer!.text && (
                  <p className={`${verdict.answer!.pinyin ? 'text-base' : 'text-lg'} font-bold break-words`}>{verdict.answer!.pinyin ? `”${verdict.answer!.text}”` : verdict.answer!.text}</p>
                )}
              </div>
            )}
            {verdict.explain && (wrong || almost) && (
              <p className="rounded-xl bg-white/70 px-3 py-2 text-sm font-bold text-ink"><span aria-hidden="true">💡 </span>{verdict.explain}</p>
            )}
            {verdict.note && <p className="text-sm font-bold opacity-80">{verdict.note}</p>}
            {verdict.heard && <p className="text-sm opacity-80">Du sa: {verdict.heard}</p>}
          </div>
        ) : null}
        <Button variant={wrong && !soft ? 'danger' : 'primary'} className="w-full" onClick={onContinue} autoFocus>
          Fortsätt
        </Button>
      </div>
    </footer>
  )
}
