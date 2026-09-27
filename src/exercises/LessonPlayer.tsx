// OWNER: Lesson-engine agent. Full-screen player: progress bar, exercise, check/continue footer.
// On completion it plays the 'complete' sfx and calls onFinish immediately; the shell shows the celebration screen.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Course, Exercise, ItemResult, LessonResult } from '../types'
import { course as defaultCourse } from '../data/course'
import { useProgress } from '../progress'
import { recognitionSupport, setDefaultSpeechRate, speak, stopListening, stopSpeaking } from '../speech'
import { PinyinText } from '../speech/PinyinText'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { exerciseAudio } from './items'
import type { ExProps, Verdict } from './components/common'
import { sfx } from './components/util'
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
}

interface QItem { ex: Exercise; orig: number; attempt: number; uid: number }

const PRAISE = ['Bra jobbat!', 'Snyggt!', 'Utmärkt!', 'Helt rätt!', 'Toppen!']

// Local keyframes (CSS only) used by exercise components.
const STYLES = `@keyframes nh-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}`

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
  }
}

export function LessonPlayer({ exercises, lessonId, onFinish, onExit, course = defaultCourse }: LessonPlayerProps) {
  const { state: { settings } } = useProgress()
  const [support] = useState(recognitionSupport)

  // Speaking exercises are dropped up-front when the mic can't work or the learner turned them off.
  const initial = useMemo(() => {
    const keepSpeak = settings.speakingExercises && support.available
    return exercises.filter((e) => keepSpeak || e.type !== 'speak')
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

  const checker = useRef<(() => Verdict) | null>(null)
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
      setDone((d) => new Set(d).add(current.orig))
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
      sfx(settings, 'correct')
      const audio = exerciseAudio(course, ex)
      if (audio) {
        clearTimeout(audioTimer.current)
        audioTimer.current = window.setTimeout(() => { void speak(audio, { rate: settings.speechRate }) }, 350)
      }
    } else {
      setCombo(0)
      sfx(settings, 'wrong')
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

  /** "Kan inte prata nu": skip this and every remaining speak exercise in the lesson. */
  const skipSpeaking = () => {
    const skip = new Set(skipped)
    queue.forEach((q, i) => { if (i >= pos && q.ex.type === 'speak' && !done.has(q.orig)) skip.add(q.orig) })
    setSkipped(skip)
    const q = queue.filter((item, i) => i <= pos || item.ex.type !== 'speak')
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
    if (canCheck) check()
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
          <div className="text-6xl" aria-hidden="true">🐼</div>
          <p className="text-xl font-extrabold">Inga övningar här ännu</p>
          <Button onClick={onExit}>Tillbaka</Button>
        </div>
      </Shell>
    )
  }

  const ex = current.ex
  const isIntro = ex.type === 'intro'
  const isSpeak = ex.type === 'speak'
  const showCombo = combo >= 2

  return (
    <Shell>
      {/* Header */}
      <header className="pt-safe px-safe">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label="Avsluta lektionen"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
          <div
            className="relative h-4 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Framsteg"
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${Math.max(progress * 100, 2)}%` }}>
              <div className="mx-2 mt-1 h-1 rounded-full bg-white/30" />
            </div>
          </div>
          <div className={`flex min-w-12 items-center justify-end gap-0.5 font-extrabold transition-opacity ${showCombo ? 'text-flame opacity-100' : 'text-line opacity-60'}`} aria-label={`${combo} rätt i rad`}>
            <span key={combo} className={showCombo ? 'animate-pop' : ''} aria-hidden="true">🔥</span>
            <span className="tabular-nums">{combo}</span>
          </div>
        </div>
        {showCombo && combo % 5 === 0 && verdict && verdict.status !== 'wrong' && (
          <p className="animate-pop text-center text-sm font-extrabold text-flame">{combo} rätt i rad!</p>
        )}
      </header>

      {/* Exercise */}
      <main className="px-safe flex-1 overflow-y-auto">
        <div key={current.uid} className="mx-auto w-full max-w-md animate-fade px-4 pt-4 pb-8">
          {current.attempt > 0 && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-extrabold tracking-wide text-danger uppercase">
              ↻ Tidigare misstag
            </p>
          )}
          <ExerciseView ex={ex} course={course} settings={settings} verdict={verdict} setChecker={setChecker} submit={grade} />
        </div>
      </main>

      {/* Footer */}
      <Footer
        verdict={verdict}
        praise={praise}
        onContinue={() => advance()}
      >
        {isIntro ? (
          <Button className="w-full" onClick={continueIntro}>Fortsätt</Button>
        ) : isSpeak ? (
          <div className="flex flex-col gap-2">
            <Button variant={support.unreliable || !support.available ? 'secondary' : 'ghost'} className="w-full" onClick={skipSpeaking}>
              Kan inte prata nu
            </Button>
          </div>
        ) : (
          <Button className="w-full" disabled={!canCheck} onClick={check}>Kontrollera</Button>
        )}
      </Footer>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} labelledBy="nh-exit-title">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-5xl" aria-hidden="true">🐼</div>
          <h2 id="nh-exit-title" className="text-xl font-extrabold">Vill du verkligen avsluta?</h2>
          <p className="text-ink-muted">Dina framsteg i den här lektionen sparas inte.</p>
          <div className="mt-3 flex w-full flex-col gap-2">
            <Button className="w-full" onClick={() => setConfirmExit(false)}>Fortsätt lära dig</Button>
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

function Footer({ verdict, praise, onContinue, children }: {
  verdict: Verdict | null
  praise: string
  onContinue: () => void
  children: ReactNode
}) {
  if (!verdict) {
    return (
      <footer className="px-safe pb-safe border-t-2 border-line bg-surface">
        <div className="mx-auto w-full max-w-md px-4 pt-4 pb-4">{children}</div>
      </footer>
    )
  }
  const wrong = verdict.status === 'wrong'
  const almost = verdict.status === 'almost'
  return (
    <footer
      className={`px-safe pb-safe animate-sheet ${wrong ? 'bg-danger-soft' : 'bg-brand-soft'}`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-4 pb-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 animate-pop items-center justify-center rounded-full bg-white text-2xl font-black ${wrong ? 'text-danger' : almost ? 'text-warn' : 'text-brand'}`} aria-hidden="true">
            {wrong ? '✕' : almost ? '!' : '✓'}
          </span>
          <div className={`min-w-0 flex-1 ${wrong ? 'text-danger' : 'text-brand-dark'}`}>
            <p className="text-xl font-extrabold">
              {wrong ? 'Rätt svar:' : almost ? 'Nästan! Kolla tonerna' : praise}
            </p>
            {verdict.answer && (wrong || almost) && (
              <p className="mt-0.5 text-lg font-bold break-words">
                {almost && <span className="font-normal">Rätt: </span>}
                {verdict.answer.pinyin ? <PinyinText pinyin={verdict.answer.pinyin} colored /> : verdict.answer.text}
              </p>
            )}
            {verdict.note && <p className="mt-0.5 font-bold opacity-80">{verdict.note}</p>}
            {verdict.heard && <p className="mt-0.5 text-sm opacity-80">Du sa: {verdict.heard}</p>}
          </div>
        </div>
        <Button variant={wrong ? 'danger' : 'primary'} className="w-full" onClick={onContinue} autoFocus>
          Fortsätt
        </Button>
      </div>
    </footer>
  )
}
