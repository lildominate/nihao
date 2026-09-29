// "Lär dig" — home: continue card, daily quests and the winding lesson path with dialogue/story stops.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { Dialogue, Lesson, Unit } from '../types'
import { course } from '../data/course'
import { useProgress, type LessonStatus } from '../progress'
import { PinyinText } from '../speech/PinyinText'
import { Button } from '../ui/Button'
import { Sheet } from '../ui/Sheet'
import { ProgressBar } from '../ui/ProgressRing'
import { Badge, EmptyState } from '../ui/kit'
import { UnitArt } from '../ui/art/UnitArt'
import { Panda } from '../mascot/Panda'
import { DailyQuestsCard, LevelBadge } from '../motivation'
import { haptic, replay } from '../motion'
import { DailyGoalRing, InstallHint, StreakBadge, TopBar } from './chrome'
import { BookIcon, ChatIcon, CheckIcon, ChevronDownIcon, LockIcon, SparkleIcon, StarIcon, TonesIcon, TrophyIcon } from './icons'
import { dialoguesAfter, seenDialogues, unitColor } from './util'

type UnitColor = ReturnType<typeof unitColor>
const KIND_LABEL: Record<Lesson['kind'], string> = { standard: 'Lektion', tones: 'Tonträning', checkpoint: 'Kontrollpunkt' }

type Node =
  | { type: 'lesson'; lesson: Lesson; lessonIndex: number }
  | { type: 'dialogue'; dialogue: Dialogue }

type Selected =
  | { type: 'lesson'; lesson: Lesson; unit: Unit; unitIndex: number; lessonIndex: number; status: LessonStatus }
  | { type: 'dialogue'; dialogue: Dialogue; unitIndex: number; locked: boolean }

export function LearnScreen({ onStartLesson, onStartDialogue, top, below }: {
  onStartLesson: (lesson: Lesson, unitIndex: number) => void
  onStartDialogue: (dialogue: Dialogue) => void
  /** Extra card at the top of the home screen (Dagens pass). */
  top?: React.ReactNode
  /** Extra section under the daily quests (Teman). */
  below?: React.ReactNode
}) {
  const { lessonStatus } = useProgress()
  const [selected, setSelected] = useState<Selected | null>(null)
  const seen = useMemo(() => seenDialogues(), [])
  const currentRef = useRef<HTMLDivElement>(null)
  const [currentVisible, setCurrentVisible] = useState(true)

  // First not-completed, available lesson in course order = "current".
  const current = useMemo(() => {
    for (const [ui, u] of course.units.entries()) {
      const li = u.lessons.findIndex((l) => lessonStatus(l.id) === 'available')
      if (li >= 0) return { unit: u, unitIndex: ui, lesson: u.lessons[li], lessonIndex: li }
    }
    return null
  }, [lessonStatus])

  useEffect(() => {
    const el = currentRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCurrentVisible(e.isIntersecting), { rootMargin: '-60px 0px -90px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [current?.lesson.id])

  return (
    <>
      <TopBar left={<LevelBadge />} right={<div className="flex items-center gap-2.5"><StreakBadge /><DailyGoalRing /></div>} />
      <InstallHint />

      {course.units.length === 0 ? (
        <EmptyState mood="think" title="Kursen byggs just nu">Lektionerna dyker upp här snart.</EmptyState>
      ) : (
        <div className="pb-10">
          <div className="space-y-3 px-4 pt-4">
            {top}
            <ContinueCard current={current} onStart={() => current && onStartLesson(current.lesson, current.unitIndex)} />
            <DailyQuestsCard />
            {below}
          </div>

          {course.units.map((unit, ui) => (
            <UnitSection
              key={unit.id}
              unit={unit}
              unitIndex={ui}
              currentId={current?.lesson.id ?? null}
              currentRef={currentRef}
              seen={seen}
              onSelectLesson={(lesson, lessonIndex, status) => setSelected({ type: 'lesson', lesson, unit, unitIndex: ui, lessonIndex, status })}
              onSelectDialogue={(dialogue, locked) => setSelected({ type: 'dialogue', dialogue, unitIndex: ui, locked })}
            />
          ))}
          <div className="flex flex-col items-center px-6 pt-8 text-center">
            <Panda mood="sleep" size={96} />
            <p className="mt-1 font-display text-lg font-semibold">Fler enheter är på väg</p>
            <p className="text-sm font-semibold text-ink-muted">Pānpan tar en tupplur så länge.</p>
          </div>
        </div>
      )}

      {current && !currentVisible && (
        <button type="button" onClick={() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 animate-rise items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-extrabold text-brand-dark shadow-float dark:text-brand">
          <ChevronDownIcon size={16} /> Till din lektion
        </button>
      )}

      <LessonSheet
        selected={selected?.type === 'lesson' ? selected : null}
        onClose={() => setSelected(null)}
        onStart={(s) => { setSelected(null); onStartLesson(s.lesson, s.unitIndex) }}
      />
      <DialogueSheet
        selected={selected?.type === 'dialogue' ? selected : null}
        onClose={() => setSelected(null)}
        onStart={(d) => { setSelected(null); onStartDialogue(d) }}
      />
    </>
  )
}

// ─── Continue card ───────────────────────────────────────────

function ContinueCard({ current, onStart }: { current: { unit: Unit; unitIndex: number; lesson: Lesson; lessonIndex: number } | null; onStart: () => void }) {
  if (!current) {
    return (
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-gold to-flame p-5 text-white shadow-card">
        <div className="pattern-clouds absolute inset-0" />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold tracking-wider uppercase opacity-90">Hela kursen</div>
            <h2 className="font-display text-2xl font-semibold">Allt klart! 太棒了</h2>
            <p className="text-sm font-semibold opacity-95">Fortsätt repetera under Öva så sitter allt kvar.</p>
          </div>
          <Panda mood="proud" size={96} />
        </div>
      </div>
    )
  }
  const c = unitColor(current.unitIndex)
  const { lesson, unit, unitIndex, lessonIndex } = current
  const first = unitIndex === 0 && lessonIndex === 0
  return (
    <div className="relative overflow-hidden rounded-[28px] p-5 pr-3 text-white shadow-card"
      style={{ background: `linear-gradient(135deg, ${c.light}, ${c.bg} 55%, ${c.dark})` }}>
      <div className="pattern-clouds absolute inset-0" />
      <div className="relative flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold tracking-wider uppercase opacity-90">
            {first ? 'Din första lektion' : `Enhet ${unitIndex + 1} · ${KIND_LABEL[lesson.kind]}`}
          </div>
          <h2 className="mt-0.5 font-display text-[26px] leading-[1.1] font-semibold drop-shadow-[0_1px_0_rgb(0_0_0/0.12)]">{lesson.title}</h2>
          <p className="mt-1 truncate text-sm font-bold opacity-90">{unit.title}</p>
          <Button size="md" className="mt-4 px-7" colors={{ face: '#ffffff', edge: 'rgb(0 0 0 / 0.18)', text: c.dark }} onClick={onStart}>
            {first ? 'Börja' : 'Fortsätt'}
          </Button>
        </div>
        <Panda mood="wave" size={112} className="float -mr-1 -mb-3 shrink-0" />
      </div>
    </div>
  )
}

// ─── Unit + path ─────────────────────────────────────────────

const STEP = 96             // vertical distance between nodes
const AMP = 78              // horizontal swing (px)
const xOf = (i: number) => Math.round(Math.sin(i * 0.95) * AMP)

function UnitSection({ unit, unitIndex, currentId, currentRef, seen, onSelectLesson, onSelectDialogue }: {
  unit: Unit; unitIndex: number; currentId: string | null; currentRef: RefObject<HTMLDivElement | null>; seen: Set<string>
  onSelectLesson: (l: Lesson, li: number, s: LessonStatus) => void
  onSelectDialogue: (d: Dialogue, locked: boolean) => void
}) {
  const { lessonStatus, state } = useProgress()
  const c = unitColor(unitIndex)
  const done = unit.lessons.filter((l) => lessonStatus(l.id) === 'completed').length
  const unitLocked = lessonStatus(unit.lessons[0]?.id ?? '') === 'locked'

  const nodes: Node[] = []
  unit.lessons.forEach((lesson, lessonIndex) => {
    nodes.push({ type: 'lesson', lesson, lessonIndex })
    for (const d of dialoguesAfter(course, lesson.id)) nodes.push({ type: 'dialogue', dialogue: d })
  })

  // Progress along the path: up to the last reached node.
  const reached = nodes.map((n) => n.type === 'lesson' ? lessonStatus(n.lesson.id) !== 'locked' : lessonStatus(n.dialogue.afterLessonId) === 'completed')
  const lastReached = reached.lastIndexOf(true)
  const W = 340
  const top = 88
  const pts = nodes.map((_, i) => ({ x: W / 2 + xOf(i), y: top + i * STEP }))
  const height = top + (nodes.length - 1) * STEP + 70
  const pathD = (upto: number) => pts.slice(0, upto + 1).reduce((d, p, i) => {
    if (i === 0) return `M${p.x} ${p.y}`
    const q = pts[i - 1]; const my = (q.y + p.y) / 2
    return `${d} C${q.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`
  }, '')
  const currentIdx = nodes.findIndex((n) => n.type === 'lesson' && n.lesson.id === currentId)

  return (
    <section className="pt-7" aria-label={`Enhet ${unitIndex + 1}: ${unit.title}`}>
      {/* banner */}
      <div className="px-4">
        <div className="relative overflow-hidden rounded-[28px] p-4 pr-2 text-white shadow-card"
          style={{ background: unitLocked ? 'linear-gradient(135deg, #a8a0b0, #857d8f)' : `linear-gradient(135deg, ${c.light}, ${c.bg} 50%, ${c.dark})` }}>
          <div className="pattern-clouds absolute inset-0" />
          <div className="relative flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase">
                <span className="rounded-full bg-white/22 px-2 py-0.5">Enhet {unitIndex + 1}</span>
                {done === unit.lessons.length && unit.lessons.length > 0 && <span className="flex items-center gap-1"><CheckIcon size={14} /> Klar</span>}
              </div>
              <h2 className="mt-1.5 font-display text-[22px] leading-tight font-semibold">{unit.title}</h2>
              <p className="mt-0.5 text-[13px] leading-snug font-semibold opacity-90">{unit.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <ProgressBar value={unit.lessons.length ? done / unit.lessons.length : 0} height={9} color="#ffffff" track="rgb(255 255 255 / 0.25)" className="flex-1" />
                <span className="text-xs font-extrabold opacity-95">{done}/{unit.lessons.length}</span>
              </div>
            </div>
            <div className="relative grid h-[92px] w-[92px] shrink-0 place-items-center">
              <div className="absolute inset-1 rounded-full bg-white/18" />
              <UnitArt unitId={unit.id} size={84} className={`relative ${unitLocked ? 'opacity-70 grayscale-[.5]' : ''}`} />
            </div>
          </div>
        </div>
      </div>

      {/* path */}
      <div className="stagger-children relative mx-auto" style={{ width: W, height, '--stagger': '45ms' } as CSSProperties}>
        <svg className="absolute inset-0" width={W} height={height} aria-hidden="true">
          <path d={pathD(nodes.length - 1)} fill="none" stroke="var(--color-surface-3)" strokeWidth="16" strokeLinecap="round" />
          <path d={pathD(nodes.length - 1)} fill="none" stroke="var(--color-line-dark)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 14" opacity="0.8" />
          {lastReached > 0 && (
            <>
              <path d={pathD(lastReached)} fill="none" stroke={c.bg} strokeWidth="16" strokeLinecap="round" opacity="0.9" />
              <path d={pathD(lastReached)} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 14" opacity="0.6" />
            </>
          )}
        </svg>
        {nodes.map((n, i) => {
          const p = pts[i]
          const style: CSSProperties = { position: 'absolute', left: p.x, top: p.y }
          if (n.type === 'lesson') {
            const status = lessonStatus(n.lesson.id)
            const isCurrent = n.lesson.id === currentId
            return (
              <div key={n.lesson.id} style={style} ref={isCurrent ? currentRef : undefined} className="z-10 -translate-x-1/2 -translate-y-1/2">
                <LessonNode lesson={n.lesson} status={status} current={isCurrent} color={c}
                  best={state.completedLessons[n.lesson.id]?.bestAccuracy}
                  onClick={() => onSelectLesson(n.lesson, n.lessonIndex, status)} />
              </div>
            )
          }
          const locked = lessonStatus(n.dialogue.afterLessonId) !== 'completed'
          return (
            <div key={n.dialogue.id} style={style} className="z-10 -translate-x-1/2 -translate-y-1/2">
              <DialogueNode dialogue={n.dialogue} locked={locked} done={seen.has(n.dialogue.id)} labelSide={xOf(i) > 0 ? 'left' : 'right'} onClick={() => onSelectDialogue(n.dialogue, locked)} />
            </div>
          )
        })}
        {currentIdx >= 0 && (
          <div className="pointer-events-none absolute z-0" style={{
            left: W / 2 + xOf(currentIdx) + (xOf(currentIdx) > 0 ? -150 : 58),
            top: pts[currentIdx].y - 58,
          }}>
            <Panda mood={currentIdx === 0 && unitIndex === 0 ? 'wave' : 'happy'} size={92} className={xOf(currentIdx) > 0 ? '' : '-scale-x-100'} />
          </div>
        )}
      </div>
    </section>
  )
}

function LessonNode({ lesson, status, current, color, best, onClick }: {
  lesson: Lesson; status: LessonStatus; current: boolean; color: UnitColor; best?: number; onClick: () => void
}) {
  const big = lesson.kind === 'checkpoint'
  const size = big ? 80 : 70
  const locked = status === 'locked'
  const completed = status === 'completed'
  const face = locked
    ? 'radial-gradient(circle at 35% 28%, var(--color-surface), var(--color-surface-3) 70%)'
    : completed
      ? 'radial-gradient(circle at 35% 28%, #ffe27a, #fbbf24 60%, #f0a90e)'
      : `radial-gradient(circle at 35% 28%, ${color.light}, ${color.bg} 65%)`
  const edge = locked ? 'var(--color-line-dark)' : completed ? '#c98309' : color.dark
  const Icon = lesson.kind === 'checkpoint' ? TrophyIcon
    : lesson.kind === 'tones' ? TonesIcon
    : completed ? CheckIcon : locked ? LockIcon : StarIcon
  const stars = best === undefined ? 0 : best >= 0.95 ? 3 : best >= 0.8 ? 2 : 1
  return (
    <div className="relative flex flex-col items-center">
      {current && (
        <>
          <span className="pulse-ring absolute top-[calc(50%-10px)] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: size + 8, height: size * 0.9 + 8, '--ring': `color-mix(in oklab, ${color.bg} 55%, transparent)` } as CSSProperties} aria-hidden="true" />
          <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2">
           <div className="bounce-soft">
            <div className="relative rounded-xl border border-line bg-surface px-3 py-1.5 font-display text-[15px] font-semibold whitespace-nowrap shadow-soft" style={{ color: color.dark }}>
              Börja
              <span className="absolute -bottom-[6px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-surface" />
            </div>
           </div>
          </div>
        </>
      )}
      <button type="button" onClick={(e) => { if (locked) { replay(e.currentTarget, 'shake'); haptic('warning') } else haptic('light'); onClick() }}
        aria-label={`${lesson.title} (${locked ? 'låst' : completed ? 'klar' : 'tillgänglig'})`}
        className="btn-3d gloss press grid place-items-center rounded-full"
        style={{ width: size, height: size * 0.9, '--face': face, '--edge': edge, '--depth': '7px', '--glow': locked ? 'transparent' : edge } as CSSProperties}>
        <Icon size={big ? 38 : 32} className={locked ? 'text-ink-faint' : completed ? 'text-[#7a4a00]' : 'text-white drop-shadow-[0_2px_0_rgb(0_0_0/0.18)]'} />
      </button>
      {completed && (
        <div className="absolute -bottom-6 flex gap-0.5" aria-label={`${stars} av 3 stjärnor`}>
          {[0, 1, 2].map((k) => <StarIcon key={k} size={14} className={k < stars ? 'text-gold drop-shadow-[0_1px_0_#c98309]' : 'text-surface-3'} />)}
        </div>
      )}
    </div>
  )
}

function DialogueNode({ dialogue, locked, done, labelSide, onClick }: { dialogue: Dialogue; locked: boolean; done: boolean; labelSide: 'left' | 'right'; onClick: () => void }) {
  const story = dialogue.kind === 'story'
  const base = story ? 'var(--color-plum)' : 'var(--color-sky)'
  const edge = story ? 'var(--color-plum-dark)' : 'var(--color-sky-dark)'
  const Icon = story ? BookIcon : ChatIcon
  return (
    <div className="relative flex flex-col items-center">
      <button type="button" onClick={(e) => { if (locked) { replay(e.currentTarget, 'shake'); haptic('warning') } else haptic('light'); onClick() }}
        aria-label={`${story ? 'Berättelse' : 'Dialog'}: ${dialogue.title}${locked ? ' (låst)' : ''}`}
        className="btn-3d gloss grid h-[58px] w-[64px] place-items-center rounded-[22px]"
        style={{
          '--face': locked ? 'linear-gradient(180deg, var(--color-surface), var(--color-surface-3))' : `linear-gradient(180deg, color-mix(in oklab, ${base} 75%, white), ${base} 70%)`,
          '--edge': locked ? 'var(--color-line-dark)' : edge, '--depth': '6px',
        } as CSSProperties}>
        <Icon size={28} className={locked ? 'text-ink-faint' : 'text-white'} />
        {done && <span className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-brand text-white"><CheckIcon size={13} /></span>}
      </button>
      <span className={`absolute top-1/2 max-w-32 -translate-y-1/2 truncate rounded-full px-2.5 py-1 text-xs font-extrabold whitespace-nowrap ${labelSide === 'left' ? 'right-full mr-3' : 'left-full ml-3'} ${locked ? 'bg-surface-2 text-ink-faint' : story ? 'bg-plum-soft text-plum' : 'bg-sky-soft text-sky-dark dark:text-sky'}`}>
        {dialogue.title}
      </span>
    </div>
  )
}

// ─── Sheets ──────────────────────────────────────────────────

function LessonSheet({ selected, onClose, onStart }: {
  selected: Extract<Selected, { type: 'lesson' }> | null; onClose: () => void; onStart: (s: Extract<Selected, { type: 'lesson' }>) => void
}) {
  const { state } = useProgress()
  const s = selected
  const c = unitColor(s?.unitIndex ?? 0)
  const best = s ? state.completedLessons[s.lesson.id] : undefined
  const words = s ? s.lesson.newWords.map((id) => course.words[id]).filter(Boolean).slice(0, 8) : []
  const tip = s?.lesson.tip ? (s.lesson.tip.length > 170 ? s.lesson.tip.slice(0, 167).trimEnd() + '…' : s.lesson.tip) : null
  return (
    <Sheet open={!!s} onClose={onClose} labelledBy="lesson-sheet-title">
      {s && (
        <div>
          <div className="flex items-start gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: c.soft }}>
              <UnitArt unitId={s.unit.id} size={52} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold tracking-wider uppercase" style={{ color: c.bg }}>
                Enhet {s.unitIndex + 1} · {KIND_LABEL[s.lesson.kind]} {s.lesson.kind === 'standard' ? s.lessonIndex + 1 : ''}
              </div>
              <h2 id="lesson-sheet-title" className="font-display text-2xl leading-tight font-semibold">{s.lesson.title}</h2>
              {best && (
                <div className="mt-1"><Badge tone="gold" icon={<StarIcon size={12} />}>Klar {best.completions}× · bästa {Math.round(best.bestAccuracy * 100)} %</Badge></div>
              )}
            </div>
          </div>
          {words.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-extrabold tracking-wide text-ink-muted uppercase">Nya ord</div>
              <div className="flex flex-wrap gap-1.5">
                {words.map((w) => (
                  <span key={w.id} className="rounded-xl bg-surface-2 px-2.5 py-1 text-sm font-bold">
                    <PinyinText pinyin={w.pinyin} colored={state.settings.toneColors} /> <span className="font-semibold text-ink-muted">· {w.sv}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {tip && (
            <div className="mt-3 flex gap-2 rounded-2xl p-3 text-sm font-semibold" style={{ background: c.soft }}>
              <SparkleIcon size={18} className="mt-0.5 shrink-0" style={{ color: c.bg }} />
              <span>{tip}</span>
            </div>
          )}
          <div className="mt-5">
            {s.status === 'locked' ? (
              <>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-muted"><LockIcon size={18} /> Slutför lektionerna före den här för att låsa upp den.</p>
                <Button variant="secondary" className="w-full" disabled>Låst</Button>
              </>
            ) : (
              <Button className="w-full" size="lg" colors={{ face: `linear-gradient(180deg, ${c.light}, ${c.bg} 60%)`, edge: c.dark }} onClick={() => onStart(s)}>
                {s.status === 'completed' ? 'Öva igen' : 'Börja lektion'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function DialogueSheet({ selected, onClose, onStart }: {
  selected: Extract<Selected, { type: 'dialogue' }> | null; onClose: () => void; onStart: (d: Dialogue) => void
}) {
  const s = selected
  const story = s?.dialogue.kind === 'story'
  const after = s ? course.units.flatMap((u) => u.lessons).find((l) => l.id === s.dialogue.afterLessonId) : undefined
  return (
    <Sheet open={!!s} onClose={onClose} labelledBy="dialogue-sheet-title">
      {s && (
        <div>
          <div className="flex items-start gap-3">
            <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${story ? 'bg-plum-soft text-plum' : 'bg-sky-soft text-sky'}`}>
              {story ? <BookIcon size={34} /> : <ChatIcon size={34} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-extrabold tracking-wider uppercase ${story ? 'text-plum' : 'text-sky'}`}>{story ? 'Berättelse' : 'Dialog'} · {s.dialogue.lines.length} repliker</div>
              <h2 id="dialogue-sheet-title" className="font-display text-2xl leading-tight font-semibold">{s.dialogue.title}</h2>
            </div>
          </div>
          <p className="mt-3 rounded-2xl bg-surface-2 p-3 font-semibold">{s.dialogue.context}</p>
          {!story && (
            <div className="mt-2 flex gap-2 text-sm font-bold text-ink-muted">
              <Badge tone="brand">{s.dialogue.speakers.A}</Badge><span>och</span><Badge tone="sky">{s.dialogue.speakers.B}</Badge>
            </div>
          )}
          <div className="mt-5">
            {s.locked ? (
              <>
                <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-muted"><LockIcon size={18} /> Låses upp efter {after ? `”${after.title}”` : 'lektionen före'}.</p>
                <Button variant="secondary" className="w-full" disabled>Låst</Button>
              </>
            ) : (
              <Button className="w-full" size="lg" variant={story ? 'plum' : 'sky'} onClick={() => onStart(s.dialogue)}>
                {story ? 'Lyssna på berättelsen' : 'Spela dialogen'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
