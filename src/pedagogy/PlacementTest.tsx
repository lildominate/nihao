// Placement test UI: 10–15 adaptive questions (listen → meaning, Swedish → pinyin).
// Neutral feedback on purpose: it's a check-in, not an exam.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course } from '../types'
import { course as defaultCourse } from '../data/course'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { PinyinText, SpeakButton } from '../speech'
import { haptic, useReducedMotion } from '../motion'
import { useProgress } from '../progress'
import { itemInfo } from '../exercises/items'
import {
  answerQuestion, describeLesson, isFinished, MAX_QUESTIONS, nextQuestion, placementResult, startPlacement,
  type PlacementQuestion, type PlacementState,
} from './placement'

export interface PlacementTestProps {
  /** Called with the lesson to start at (null = from the beginning). The shell then calls `skipToLesson(id)`. */
  onDone: (skippedToLessonId: string | null) => void
  onCancel: () => void
  /** Tests / previews. */
  course?: Course
  seed?: number
}

type Phase = 'intro' | 'quiz' | 'result'

export function PlacementTest({ onDone, onCancel, course = defaultCourse, seed }: PlacementTestProps) {
  const { state: progress } = useProgress()
  const { speechRate, toneColors } = progress.settings
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('intro')
  const [st, setSt] = useState<PlacementState>(() => startPlacement(course, seed))
  const [q, setQ] = useState<PlacementQuestion | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const begin = () => {
    const first = nextQuestion(st, course)
    if (!first) { setPhase('result'); return }
    setQ(first)
    setPhase('quiz')
  }

  const answer = (option: string | null) => {
    if (!q || picked !== null) return
    const ex = q.exercise
    const correct = option !== null && 'answer' in ex && option === ex.answer
    haptic('select')
    setPicked(option ?? '∅')
    const next = answerQuestion(st, q, correct)
    timer.current = window.setTimeout(() => {
      setSt(next)
      setPicked(null)
      const nq = isFinished(next) ? null : nextQuestion(next, course)
      if (!nq) { setPhase('result'); haptic('success') } else setQ(nq)
    }, reduced ? 120 : 380)
  }

  const resultId = useMemo(() => (phase === 'result' ? placementResult(st, course) : null), [phase, st, course])
  const where = describeLesson(course, resultId)
  const n = st.asked.length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas pt-safe pb-safe px-safe" role="dialog" aria-modal="true" aria-label="Nivåtest">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-6">
        {/* top bar */}
        <div className="flex items-center gap-3 py-3">
          <button type="button" onClick={onCancel} aria-label="Stäng nivåtestet"
            className="grid h-11 w-11 place-items-center rounded-full text-2xl text-ink-muted active:bg-surface-2">×</button>
          {phase === 'quiz' && (
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_QUESTIONS} aria-valuenow={n}>
              <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(6, (n / MAX_QUESTIONS) * 100)}%` }} />
            </div>
          )}
        </div>

        {phase === 'intro' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-rise">
            <Panda mood="wave" size={132} className={reduced ? '' : 'animate-float'} />
            <h1 className="font-display text-3xl font-semibold text-ink">Hitta din nivå</h1>
            <p className="max-w-xs text-lg text-ink-muted">
              Kan du redan lite kinesiska? Svara på 10–15 snabba frågor så hoppar vi över det du redan kan.
            </p>
            <p className="max-w-xs rounded-2xl bg-sky-soft px-4 py-3 text-[15px] text-sky-dark">
              Gissa inte – tryck <b>Vet inte</b> om du är osäker. Då blir resultatet rätt.
            </p>
            <div className="mt-2 flex w-full flex-col gap-3">
              <Button size="lg" onClick={begin}>Starta testet</Button>
              <Button variant="secondary" onClick={() => onDone(null)}>Jag är nybörjare</Button>
            </div>
          </div>
        )}

        {phase === 'quiz' && q && (
          <QuestionView key={n} q={q} course={course} picked={picked} onAnswer={answer} rate={speechRate} toneColors={toneColors} />
        )}

        {phase === 'result' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-rise">
            <Panda mood={where ? 'proud' : 'happy'} size={132} />
            {where ? (
              <>
                <h1 className="font-display text-3xl font-semibold text-ink">Snyggt jobbat!</h1>
                <p className="text-lg text-ink-muted">Vi föreslår att du börjar här:</p>
                <div className="w-full rounded-3xl border-2 border-b-4 border-line bg-surface px-5 py-4 shadow-card">
                  <p className="text-sm font-extrabold tracking-wide text-ink-muted uppercase">Enhet {where.unitIndex + 1} · {where.unitTitle}</p>
                  <p className="font-display text-2xl font-semibold text-ink">{where.lessonTitle}</p>
                </div>
                <p className="max-w-xs text-[15px] text-ink-muted">Orden från tidigare lektioner läggs in i din repetition, så du fräschar upp dem under de närmaste dagarna.</p>
              </>
            ) : (
              <>
                <h1 className="font-display text-3xl font-semibold text-ink">Vi börjar från början</h1>
                <p className="max-w-xs text-lg text-ink-muted">Perfekt – då bygger vi en stadig grund tillsammans, steg för steg.</p>
              </>
            )}
            <div className="mt-2 flex w-full flex-col gap-3">
              <Button size="lg" onClick={() => onDone(resultId)}>{where ? 'Börja här' : 'Sätt igång'}</Button>
              {where && <Button variant="secondary" onClick={() => onDone(null)}>Börja från början ändå</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function QuestionView({ q, course, picked, onAnswer, rate, toneColors }: {
  q: PlacementQuestion
  course: Course
  picked: string | null
  onAnswer: (o: string | null) => void
  rate: number
  toneColors: boolean
}) {
  const ex = q.exercise
  if (ex.type !== 'listen-choose' && ex.type !== 'sv-to-pinyin') return null
  const info = itemInfo(course, ex.item)
  const listen = ex.type === 'listen-choose'
  return (
    <div className="flex flex-1 flex-col gap-6 animate-fade">
      <div className="flex items-end gap-3">
        <Panda mood="think" size={64} />
        <div className="relative flex-1 rounded-3xl rounded-bl-md border-2 border-line bg-surface px-4 py-3 shadow-soft">
          <p className="font-display text-xl font-semibold text-ink">
            {listen ? 'Vad betyder det du hör?' : <>Hur säger man <span className="text-brand-dark">”{info.sv}”</span>?</>}
          </p>
        </div>
      </div>
      {listen && (
        <div className="flex justify-center py-2">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={rate} label="Lyssna igen" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        {ex.options.map((o) => {
          const sel = picked === o
          return (
            <button key={o} type="button" disabled={picked !== null} onClick={() => onAnswer(o)}
              className={`min-h-14 rounded-2xl border-2 border-b-4 px-4 py-3 text-left text-lg font-bold transition-colors ${sel ? 'border-sky bg-sky-soft text-sky-dark' : 'border-line bg-surface text-ink active:bg-surface-2'}`}>
              {listen ? o : <PinyinText pinyin={o} colored={toneColors} />}
            </button>
          )
        })}
      </div>
      <Button variant="ghost" className="mt-auto" disabled={picked !== null} onClick={() => onAnswer(null)}>Vet inte</Button>
    </div>
  )
}
