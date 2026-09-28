// Full-screen session flow: optional tip card → LessonPlayer → celebration.
import { useState, type ReactNode } from 'react'
import type { Exercise, Lesson, LessonResult } from '../types'
import { LessonPlayer } from '../exercises'
import type { LessonSummary } from '../exercises/LessonPlayer'
import { PinyinText, SpeakButton } from '../speech'
import { useProgress } from '../progress'
import { useEffectiveStreak } from '../motivation'
import { CelebrationOverlay, CountUp } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { ProgressRing } from '../ui/ProgressRing'
import { EmptyState } from '../ui/kit'
import { UnitArt } from '../ui/art/UnitArt'
import { course } from '../data/course'
import { BoltIcon, ClockIcon, CloseIcon, FlameIcon, SparkleIcon, TargetIcon } from './icons'
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
  const [summary, setSummary] = useState<LessonSummary | null>(null)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-md flex-col pt-safe pb-safe px-safe">
        {stage.name === 'tip' && spec.kind === 'lesson' && (
          <TipCard lesson={spec.lesson} unitIndex={spec.unitIndex} onContinue={() => setStage({ name: 'play' })} onClose={onClose} />
        )}
        {stage.name === 'play' && (spec.exercises.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center">
            <EmptyState mood="think" title="Inga övningar här än" action={<Button onClick={onClose}>Tillbaka</Button>}>
              Det finns inte tillräckligt med innehåll för att skapa övningar just nu. Prova en lektion först!
            </EmptyState>
          </div>
        ) : (
          <LessonPlayer
            exercises={spec.exercises}
            lessonId={spec.kind === 'lesson' ? spec.lesson.id : null}
            title={title}
            onExit={onClose}
            onSummary={setSummary}
            onFinish={(result) => {
              const full: LessonResult = { ...result, source: result.source ?? (spec.kind === 'lesson' ? 'lesson' : 'review') }
              const r = finishSession(full)
              setStage({ name: 'done', ...r, result: full })
            }}
          />
        ))}
        {stage.name === 'done' && (
          <Celebration xpEarned={stage.xpEarned} streakExtended={stage.streakExtended} result={stage.result} isLesson={spec.kind === 'lesson'} summary={summary} onContinue={onClose} />
        )}
      </div>
    </div>
  )
}

function TipCard({ lesson, unitIndex, onContinue, onClose }: { lesson: Lesson; unitIndex: number; onContinue: () => void; onClose: () => void }) {
  const c = unitColor(unitIndex)
  const unit = course.units[unitIndex]
  return (
    <div className="flex flex-1 flex-col px-5 pt-2 pb-5">
      <button type="button" onClick={onClose} aria-label="Avbryt" className="-ml-2 grid h-10 w-10 place-items-center self-start rounded-xl text-ink-faint active:bg-surface-2"><CloseIcon size={26} /></button>
      <div className="flex flex-1 flex-col justify-center py-4">
        <div className="relative animate-pop">
          <Panda mood="think" size={110} className="absolute -top-[88px] right-2 z-10" />
          <div className="overflow-hidden rounded-[28px] border border-line/80 bg-surface shadow-float">
            <div className="relative flex items-center gap-3 overflow-hidden px-5 py-4 text-white" style={{ background: `linear-gradient(135deg, ${c.light}, ${c.bg} 60%, ${c.dark})` }}>
              <div className="pattern-clouds absolute inset-0" />
              {unit && <UnitArt unitId={unit.id} size={48} className="relative shrink-0" />}
              <div className="relative min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase opacity-95"><SparkleIcon size={14} /> Pānpans tips</div>
                <h2 className="font-display text-2xl leading-tight font-semibold">{lesson.title}</h2>
              </div>
            </div>
            <p className="px-5 py-5 text-[17px] leading-relaxed font-semibold whitespace-pre-line">{lesson.tip}</p>
          </div>
        </div>
      </div>
      <Button className="w-full" size="lg" onClick={onContinue}>Jag fattar!</Button>
    </div>
  )
}

const CHEERS = ['Snyggt jobbat!', 'Grymt!', 'Hěn hǎo! Mycket bra!', 'Toppen!', 'Tài bàng le!']
const CHEERS_LOW = ['Bra kämpat!', 'Övning ger färdighet!', 'Du blir bättre för varje gång!']

function Celebration({ xpEarned, streakExtended, result, isLesson, summary, onContinue }: {
  xpEarned: number; streakExtended: boolean; result: LessonResult; isLesson: boolean; summary: LessonSummary | null; onContinue: () => void
}) {
  const { state, todayXp } = useProgress()
  const streak = useEffectiveStreak().current
  const acc = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 100
  const [cheer] = useState(() => { const list = acc >= 70 ? CHEERS : CHEERS_LOW; return list[Math.floor(Math.random() * list.length)] })
  const goal = state.settings.dailyGoalXp || 30
  const xp = todayXp()
  const perfect = result.mistakes === 0 && result.total > 0
  const mins = Math.max(1, Math.round(result.durationMs / 60000))

  return (
    <>
      <div className="flex-1" />
      <CelebrationOverlay
        open
        title={perfect ? 'Perfekt!' : cheer}
        subtitle={isLesson ? 'Lektionen är klar' : 'Passet är klart'}
        mood={!isLesson || perfect ? 'proud' : 'cheer'}
        confetti={perfect ? 'fireworks' : 'confetti'}
        onClose={onContinue}
      >
        <div className="w-full max-w-sm">
          <div className="grid w-full grid-cols-3 gap-2.5">
            <ResultTile label="XP" color="var(--color-gold)" edge="var(--color-gold-dark)" icon={<BoltIcon size={20} />}>
              +<CountUp value={xpEarned} from={0} />
            </ResultTile>
            <ResultTile label="Träffsäkerhet" color="var(--color-brand)" edge="var(--color-brand-dark)" icon={<TargetIcon size={20} />}>
              <CountUp value={acc} from={0} /> %
            </ResultTile>
            <ResultTile label="Tid" color="var(--color-sky)" edge="var(--color-sky-dark)" icon={<ClockIcon size={20} />}>
              {mins} min
            </ResultTile>
          </div>

          {streakExtended && streak > 0 && (
            <div className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-flame-soft p-3.5 text-left">
              <span className="glow grid place-items-center"><FlameIcon size={40} className="text-flame" /></span>
              <div>
                <div className="font-display text-xl font-semibold text-flame">{streak} {streak === 1 ? 'dag' : 'dagar'} i rad!</div>
                <div className="text-sm font-semibold text-ink-muted">{streak === 1 ? 'Din streak har börjat – kom tillbaka i morgon!' : 'Streaken lever vidare. Starkt!'}</div>
              </div>
            </div>
          )}

          <div className="mt-3 flex w-full items-center gap-3 rounded-3xl border border-line/80 bg-surface p-3.5 text-left shadow-card">
            <ProgressRing value={xp / goal} size={48} stroke={6} gradient={xp >= goal ? ['#34c79a', '#12a179'] : ['#ffd35c', '#f59e0b']}>
              <span className="text-[11px] font-black">{Math.min(100, Math.round((xp / goal) * 100))}%</span>
            </ProgressRing>
            <div className="font-bold">
              {xp >= goal ? <span className="text-brand">Dagens mål är klart!</span> : <span>Dagens mål: {xp} / {goal} XP</span>}
              <div className="text-sm font-semibold text-ink-muted">{xp >= goal ? 'Allt du gör nu är bonus.' : `${goal - xp} XP kvar idag`}</div>
            </div>
          </div>

          {!!summary?.practised.length && <PractisedList items={summary.practised} />}
        </div>
      </CelebrationOverlay>
    </>
  )
}

function ResultTile({ label, color, edge, icon, children }: { label: string; color: string; edge: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl p-[3px]" style={{ background: color, boxShadow: `0 4px 0 ${edge}` }}>
      <div className="py-1 text-[10px] font-black tracking-wide text-white uppercase">{label}</div>
      <div className="flex items-center justify-center gap-1 rounded-[13px] bg-surface py-2.5 font-display text-lg font-semibold" style={{ color: edge }}>{icon}{children}</div>
    </div>
  )
}

function PractisedList({ items }: { items: LessonSummary['practised'] }) {
  const { state } = useProgress()
  return (
    <div className="mt-3 rounded-3xl border border-line/80 bg-surface p-3.5 text-left shadow-card" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-display text-lg font-semibold">Ord du övade</span>
        <span className="text-xs font-extrabold text-ink-muted">{items.length} st</span>
      </div>
      <ul className="max-h-52 divide-y divide-line overflow-y-auto">
        {items.map((it) => (
          <li key={`${it.item.kind}:${it.item.id}`} className="flex items-center gap-2.5 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <PinyinText pinyin={it.pinyin} colored={state.settings.toneColors} className="truncate font-black" />
                {it.isNew && <span className="rounded-full bg-brand-soft px-1.5 text-[10px] font-extrabold text-brand-dark dark:text-brand">NY</span>}
              </div>
              <div className="truncate text-sm font-semibold text-ink-muted">{it.sv}</div>
            </div>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${it.firstTry ? 'bg-brand' : 'bg-warn'}`} title={it.firstTry ? 'Rätt direkt' : `${it.attempts} försök`} />
            <SpeakButton hanzi={it.hanzi} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}
