// "Lär dig" — the winding lesson path (Shell).
import { useEffect, useRef, useState } from 'react'
import type { Lesson, Unit } from '../types'
import { course } from '../data/course'
import { useProgress, type LessonStatus } from '../progress'
import { PinyinText } from '../speech/PinyinText'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { DailyGoalRing, EmptyState, InstallHint, StreakBadge, TopBar } from './chrome'
import { CheckIcon, LockIcon, StarIcon, TonesIcon, TrophyIcon } from './icons'
import { unitColor } from './util'

/** Zigzag offsets (px) for successive nodes: a gentle S-curve. */
const OFFSETS = [0, 44, 68, 44, 0, -44, -68, -44]

const KIND_LABEL: Record<Lesson['kind'], string> = { standard: 'Lektion', tones: 'Tonträning', checkpoint: 'Kontrollpunkt' }

interface Selected { lesson: Lesson; unit: Unit; unitIndex: number; lessonIndex: number; status: LessonStatus }

export function LearnScreen({ onStartLesson }: { onStartLesson: (lesson: Lesson, unitIndex: number) => void }) {
  const { lessonStatus } = useProgress()
  const [selected, setSelected] = useState<Selected | null>(null)
  const currentRef = useRef<HTMLDivElement>(null)

  // First not-completed, available lesson in course order = "current".
  const currentId = course.units.flatMap((u) => u.lessons).find((l) => lessonStatus(l.id) === 'available')?.id ?? null

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <>
      <TopBar
        title={<span className="text-brand">Nǐ hǎo</span>}
        right={<div className="flex items-center gap-4"><StreakBadge /><DailyGoalRing /></div>}
      />
      <InstallHint />

      {course.units.length === 0 ? (
        <EmptyState emoji="🏗️" title="Kursen byggs just nu">Lektionerna dyker upp här snart. Titta gärna in under Profil så länge och testa rösten.</EmptyState>
      ) : (
        <div className="pb-8">
          {course.units.map((unit, ui) => {
            const color = unitColor(ui)
            const done = unit.lessons.filter((l) => lessonStatus(l.id) === 'completed').length
            return (
              <section key={unit.id} className="px-4 pt-5" aria-label={`Enhet ${ui + 1}: ${unit.title}`}>
                <div className="flex items-center gap-3 rounded-3xl p-4 text-white" style={{ background: color.bg, boxShadow: `0 5px 0 ${color.dark}` }}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-extrabold tracking-wider uppercase opacity-85">Enhet {ui + 1} · {done}/{unit.lessons.length}</div>
                    <h2 className="text-xl leading-tight font-black">{unit.title}</h2>
                    <p className="mt-0.5 text-sm leading-snug font-semibold opacity-90">{unit.description}</p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/20 text-3xl" aria-hidden="true">{unit.emoji}</div>
                </div>

                <ol className="relative flex flex-col items-center gap-5 pt-12 pb-4">
                  {unit.lessons.map((lesson, li) => {
                    const status = lessonStatus(lesson.id)
                    const isCurrent = lesson.id === currentId
                    return (
                      <li key={lesson.id} className={isCurrent && li > 0 ? "mt-8" : undefined} style={{ transform: `translateX(${OFFSETS[li % OFFSETS.length]}px)` }}>
                        <div ref={isCurrent ? currentRef : undefined} className="relative">
                          {isCurrent && (
                            <div className="absolute -top-11 left-1/2 z-10 -translate-x-1/2 animate-bob">
                              <div className="relative rounded-xl border-2 border-line bg-white px-3 py-1.5 text-sm font-black tracking-wide whitespace-nowrap uppercase" style={{ color: color.dark }}>
                                Börja
                                <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-line bg-white" />
                              </div>
                            </div>
                          )}
                          <LessonNode
                            lesson={lesson}
                            status={status}
                            current={isCurrent}
                            color={color}
                            onClick={() => setSelected({ lesson, unit, unitIndex: ui, lessonIndex: li, status })}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )
          })}
          <div className="px-6 pt-6 text-center text-sm font-bold text-ink-muted">Fler enheter kommer 🚀</div>
        </div>
      )}

      <LessonSheet selected={selected} onClose={() => setSelected(null)} onStart={(s) => { setSelected(null); onStartLesson(s.lesson, s.unitIndex) }} />
    </>
  )
}

function LessonNode({ lesson, status, current, color, onClick }: {
  lesson: Lesson; status: LessonStatus; current: boolean; color: { bg: string; dark: string; soft: string }; onClick: () => void
}) {
  const big = lesson.kind === 'checkpoint'
  const size = big ? 84 : 72
  const locked = status === 'locked'
  const completed = status === 'completed'
  const bg = locked ? '#e5e7eb' : completed ? '#facc15' : color.bg
  const dark = locked ? '#c4c9d1' : completed ? '#ca8a04' : color.dark
  const iconCls = locked ? 'text-gray-400' : 'text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.15)]'
  const iconSize = big ? 40 : 34
  const Icon = completed && lesson.kind === 'standard' ? CheckIcon
    : lesson.kind === 'checkpoint' ? TrophyIcon
    : lesson.kind === 'tones' ? TonesIcon
    : locked ? LockIcon : StarIcon
  return (
    <div className="relative">
      {current && <span className="absolute -inset-2 rounded-full border-[6px]" style={{ borderColor: color.soft }} aria-hidden="true" />}
      <button
        type="button"
        onClick={onClick}
        aria-label={`${lesson.title} (${status === 'locked' ? 'låst' : status === 'completed' ? 'klar' : 'tillgänglig'})`}
        className="relative grid place-items-center rounded-full transition-transform active:translate-y-1"
        style={{ width: size, height: size * 0.92, background: bg, boxShadow: `0 7px 0 ${dark}` }}
      >
        <Icon size={iconSize} className={iconCls} />
        {completed && lesson.kind !== 'standard' && (
          <span className="absolute -right-1 -bottom-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-brand text-white"><CheckIcon size={14} /></span>
        )}
      </button>
    </div>
  )
}

function LessonSheet({ selected, onClose, onStart }: { selected: Selected | null; onClose: () => void; onStart: (s: Selected) => void }) {
  const { state } = useProgress()
  const s = selected
  const color = s ? unitColor(s.unitIndex) : unitColor(0)
  const best = s ? state.completedLessons[s.lesson.id] : undefined
  const words = s ? s.lesson.newWords.map((id) => course.words[id]).filter(Boolean).slice(0, 8) : []
  const tip = s?.lesson.tip ? (s.lesson.tip.length > 160 ? s.lesson.tip.slice(0, 157).trimEnd() + '…' : s.lesson.tip) : null
  return (
    <Sheet open={!!s} onClose={onClose} labelledBy="lesson-sheet-title">
      {s && (
        <div>
          <div className="text-xs font-extrabold tracking-wider uppercase" style={{ color: color.dark }}>
            Enhet {s.unitIndex + 1} · {KIND_LABEL[s.lesson.kind]} {s.lesson.kind === 'standard' ? s.lessonIndex + 1 : ''}
          </div>
          <h2 id="lesson-sheet-title" className="mt-0.5 text-2xl font-black">{s.lesson.title}</h2>
          {best && (
            <p className="mt-1 text-sm font-bold text-gold-dark">Klar {best.completions} {best.completions === 1 ? 'gång' : 'gånger'} · bästa {Math.round(best.bestAccuracy * 100)} %</p>
          )}
          {words.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-extrabold tracking-wide text-ink-muted uppercase">Nya ord</div>
              <div className="flex flex-wrap gap-1.5">
                {words.map((w) => (
                  <span key={w.id} className="rounded-xl border-2 border-line px-2.5 py-1 text-sm font-bold">
                    <PinyinText pinyin={w.pinyin} colored={state.settings.toneColors} /> <span className="font-semibold text-ink-muted">· {w.sv}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {tip && (
            <div className="mt-3 rounded-2xl p-3 text-sm font-semibold" style={{ background: color.soft }}>
              <span className="font-black">💡 Tips: </span>{tip}
            </div>
          )}
          <div className="mt-5">
            {s.status === 'locked' ? (
              <>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-muted"><LockIcon size={18} /> Slutför lektionerna före den här för att låsa upp den.</p>
                <Button variant="secondary" className="w-full" disabled>Låst</Button>
              </>
            ) : (
              <Button className="w-full" onClick={() => onStart(s)}>{s.status === 'completed' ? 'Öva igen' : 'Börja lektion'}</Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
