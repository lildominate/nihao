// Full-screen session flow (Shell): optional tip card → LessonPlayer → celebration.
import { useState, type ReactNode } from 'react'
import type { Exercise, Lesson, LessonResult } from '../types'
import { LessonPlayer } from '../exercises'
import { displayStreak, localDay, useProgress } from '../progress'
import { Button } from '../ui/Button'
import { ProgressRing } from '../ui/ProgressRing'
import { BoltIcon, CloseIcon, FlameIcon } from './icons'
import { unitColor } from './util'

export type SessionSpec =
  | { kind: 'lesson'; lesson: Lesson; unitIndex: number; exercises: Exercise[] }
  | { kind: 'practice'; title: string; emoji: string; exercises: Exercise[] }

type Stage =
  | { name: 'tip' }
  | { name: 'play' }
  | { name: 'done'; xpEarned: number; streakExtended: boolean; result: LessonResult }

export function Session({ spec, onClose }: { spec: SessionSpec; onClose: () => void }) {
  const { finishSession } = useProgress()
  const [stage, setStage] = useState<Stage>(() => (spec.kind === 'lesson' && spec.lesson.tip ? { name: 'tip' } : { name: 'play' }))
  const title = spec.kind === 'lesson' ? spec.lesson.title : spec.title

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-md flex-col pt-safe pb-safe px-safe">
        {stage.name === 'tip' && spec.kind === 'lesson' && (
          <TipCard lesson={spec.lesson} unitIndex={spec.unitIndex} onContinue={() => setStage({ name: 'play' })} onClose={onClose} />
        )}
        {stage.name === 'play' && (spec.exercises.length === 0 ? (
          <NoExercises onClose={onClose} />
        ) : (
          <LessonPlayer
            exercises={spec.exercises}
            lessonId={spec.kind === 'lesson' ? spec.lesson.id : null}
            title={title}
            onExit={onClose}
            onFinish={(result) => {
              const r = finishSession(result)
              setStage({ name: 'done', ...r, result })
            }}
          />
        ))}
        {stage.name === 'done' && (
          <Celebration xpEarned={stage.xpEarned} streakExtended={stage.streakExtended} result={stage.result} isLesson={spec.kind === 'lesson'} onContinue={onClose} />
        )}
      </div>
    </div>
  )
}

function TipCard({ lesson, unitIndex, onContinue, onClose }: { lesson: Lesson; unitIndex: number; onContinue: () => void; onClose: () => void }) {
  const color = unitColor(unitIndex)
  return (
    <div className="flex flex-1 flex-col px-5 pt-3 pb-5">
      <button type="button" onClick={onClose} aria-label="Avbryt" className="-ml-1 self-start p-1 text-gray-400"><CloseIcon size={28} /></button>
      <div className="flex flex-1 flex-col justify-center py-6">
        <div className="animate-pop rounded-3xl border-2 border-b-4 p-5" style={{ borderColor: color.bg, background: color.soft }}>
          <div className="mb-2 flex items-center gap-2 text-sm font-black tracking-wider uppercase" style={{ color: color.dark }}>
            <span className="text-2xl">💡</span> Tips
          </div>
          <h2 className="mb-2 text-2xl font-black">{lesson.title}</h2>
          <p className="text-[17px] leading-relaxed font-semibold whitespace-pre-line">{lesson.tip}</p>
        </div>
      </div>
      <Button className="w-full" onClick={onContinue}>Fortsätt</Button>
    </div>
  )
}

function NoExercises({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-6xl">🧩</div>
      <h2 className="text-xl font-black">Inga övningar här än</h2>
      <p className="mt-2 mb-6 text-ink-muted">Det finns inte tillräckligt med innehåll för att skapa övningar just nu. Prova en lektion först!</p>
      <Button onClick={onClose}>Tillbaka</Button>
    </div>
  )
}

const CHEERS = ['Snyggt jobbat!', 'Grymt!', 'Hěn hǎo! Mycket bra!', 'Toppen!']
const CHEERS_LOW = ['Bra kämpat!', 'Övning ger färdighet!', 'Du blir bättre för varje gång!']

function Celebration({ xpEarned, streakExtended, result, isLesson, onContinue }: {
  xpEarned: number; streakExtended: boolean; result: LessonResult; isLesson: boolean; onContinue: () => void
}) {
  const { state, todayXp } = useProgress()
    const streak = displayStreak(state, localDay())
  const acc = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 100
  const [cheer] = useState(() => { const list = acc >= 70 ? CHEERS : CHEERS_LOW; return list[Math.floor(Math.random() * list.length)] })
  const goal = state.settings.dailyGoalXp || 30
  const xp = todayXp()
  const perfect = result.mistakes === 0 && result.total > 0
  const mins = Math.max(1, Math.round(result.durationMs / 60000))
  return (
    <div className="flex flex-1 flex-col px-5 pt-10 pb-5 text-center">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-4 animate-pop text-7xl" aria-hidden="true">{perfect ? '🏆' : isLesson ? '🎉' : '💪'}</div>
        <h1 className="text-3xl font-black text-brand">{perfect ? 'Perfekt!' : cheer}</h1>
        <p className="mt-1 font-bold text-ink-muted">{isLesson ? 'Lektionen är klar' : 'Passet är klart'}</p>

        <div className="mt-8 grid w-full grid-cols-3 gap-2.5">
          <Stat label="XP" value={`+${xpEarned}`} color="#f59e0b" icon={<BoltIcon size={22} />} />
          <Stat label="Träffsäkerhet" value={`${acc} %`} color="#16a34a" icon={<span className="text-lg">🎯</span>} />
          <Stat label="Tid" value={`${mins} min`} color="#0ea5e9" icon={<span className="text-lg">⏱️</span>} />
        </div>

        {streakExtended && streak > 0 && (
          <div className="mt-5 flex w-full animate-pop items-center gap-3 rounded-3xl border-2 border-b-4 border-orange-200 bg-orange-50 p-4 text-left">
            <FlameIcon size={44} className="animate-wiggle text-flame" />
            <div>
              <div className="text-xl font-black text-flame">{streak} {streak === 1 ? 'dag' : 'dagar'} i rad!</div>
              <div className="text-sm font-semibold text-ink-muted">{streak === 1 ? 'Din streak har börjat – kom tillbaka i morgon!' : 'Streaken lever vidare. Starkt!'}</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex w-full items-center gap-3 rounded-3xl border-2 border-line p-4 text-left">
          <ProgressRing value={xp / goal} size={48} color={xp >= goal ? 'var(--color-brand)' : 'var(--color-warn)'}>
            <span className="text-xs font-black">{Math.min(100, Math.round((xp / goal) * 100))}%</span>
          </ProgressRing>
          <div className="text-sm font-bold">
            {xp >= goal ? <span className="text-brand">Dagens mål klart! 🎯</span> : <span>Dagens mål: {xp} / {goal} XP</span>}
          </div>
        </div>
      </div>
      <Button className="mt-6 w-full" onClick={onContinue}>Fortsätt</Button>
    </div>
  )
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2" style={{ borderColor: color, background: color }}>
      <div className="py-1 text-[10px] font-black tracking-wide text-white uppercase">{label}</div>
      <div className="flex items-center justify-center gap-1 rounded-t-xl bg-white py-2.5 text-lg font-black" style={{ color }}>{icon}{value}</div>
    </div>
  )
}
