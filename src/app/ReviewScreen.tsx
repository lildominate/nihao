// "Öva" — Tallabbet (LabHub), spaced-repetition review and targeted drills.
import type { CSSProperties, ReactNode } from 'react'
import type { Exercise } from '../types'
import { course } from '../data/course'
import { generateReviewExercises, generateToneDrill } from '../exercises'
import { useProgress } from '../progress'
import { isRecognitionAvailable } from '../speech'
import { LabHub } from '../lab'
import { multiVoiceOn, reviewGenOptions } from '../pedagogy'
import { Button } from '../ui/Button'
import { Badge, SectionHeader } from '../ui/kit'
import { Panda } from '../mascot/Panda'
import { TopBar, StreakBadge } from './chrome'
import { ChevronRightIcon, ReplayIcon, SpeakerIcon, TargetIcon, TonesIcon } from './icons'
import { shuffle } from './util'
import type { SessionSpec } from './Session'

const LISTEN_TYPES: Exercise['type'][] = ['listen-choose', 'tone-pick', 'build-sv', 'listen-build']

export function ReviewScreen({ onStart }: { onStart: (spec: SessionSpec) => void }) {
  return <PracticeHub onStart={onStart} />
}

function PracticeHub({ onStart }: { onStart: (spec: SessionSpec) => void }) {
  const progress = useProgress()
  const { dueItems, weakItems, knownWordIds, state } = progress
  const known = knownWordIds().filter((id) => course.words[id])
  const due = dueItems()
  const weak = weakItems(12)
  const speaking = state.settings.speakingExercises && isRecognitionAvailable()
  const nothingLearned = known.length === 0

  const start = (title: string, emoji: string, exercises: Exercise[]) => onStart({ kind: 'practice', title, emoji, exercises })

  return (
    <>
      <TopBar title="Öva" right={<StreakBadge />} />
      <div className="space-y-5 px-4 pt-4 pb-10">
        {/* Tallabbet (agent 5): self-contained section; its modes open full-screen. */}
        <LabHub />

        {nothingLearned && (
          <div className="flex items-center gap-3 rounded-3xl bg-surface-2 p-4">
            <Panda mood="think" size={64} className="shrink-0" />
            <p className="text-sm font-semibold text-ink-muted">Här repeterar du det du har lärt dig. Gör din första lektion under <b className="text-ink">Lär dig</b> så fylls sidan på.</p>
          </div>
        )}

        {/* Featured: SRS review */}
        <section>
          <SectionHeader title="Dagens repetition" action={due.length > 0 ? <Badge tone="lacquer" solid>{due.length} att repetera</Badge> : undefined} />
          <div className="relative overflow-hidden rounded-[28px] border border-line/80 bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sky-soft text-sky"><ReplayIcon size={34} /></div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[34px] leading-none font-semibold">{due.length}</div>
                <div className="text-sm font-bold text-ink-muted">{due.length === 1 ? 'sak behöver repeteras' : 'saker behöver repeteras'}</div>
              </div>
              {due.length === 0 && !nothingLearned && <Panda mood="proud" size={72} className="-my-2 shrink-0" />}
            </div>
            {due.length > 0 ? (
              <Button variant="sky" size="lg" className="mt-4 w-full" onClick={() => start('Repetition', '🔁', generateReviewExercises(due.slice(0, 20), course, reviewGenOptions(progress, { speaking })))}>
                Repetera nu
              </Button>
            ) : (
              <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm font-semibold text-ink-muted">
                {nothingLearned ? 'Inga ord att repetera än.' : 'Allt är repeterat – snyggt! Kom tillbaka i morgon.'}
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Riktad träning" />
          <div className="space-y-3">
            <DrillCard
              icon={<TargetIcon size={28} />} tone="lacquer" title="Svåra ord"
              subtitle={weak.length === 1 ? 'Ordet du oftast missar' : weak.length > 1 ? `De ${weak.length} ord du oftast missar` : 'Dina knepigaste ord samlas här'}
              disabled={weak.length === 0}
              onClick={() => start('Svåra ord', '🧗', generateReviewExercises(weak, course, reviewGenOptions(progress, { speaking })))}
            />
            <DrillCard
              icon={<TonesIcon size={28} />} tone="plum" title="Tonträning"
              subtitle={<>Hör skillnad på <span className="text-tone-1">mā</span> <span className="text-tone-2">má</span> <span className="text-tone-3">mǎ</span> <span className="text-tone-4">mà</span></>}
              disabled={nothingLearned}
              onClick={() => start('Tonträning', '🎵', generateToneDrill(known, course, 15, { multiVoice: multiVoiceOn(progress) }))}
            />
            <DrillCard
              icon={<SpeakerIcon size={28} />} tone="brand" title="Lyssningsövning"
              subtitle="Bara öronen: hör och förstå"
              disabled={nothingLearned}
              onClick={() => {
                const refs = shuffle(known).slice(0, 12).map((id) => ({ kind: 'word' as const, id }))
                const all = generateReviewExercises(refs, course, reviewGenOptions(progress, { speaking: false }))
                const listening = all.filter((e) => LISTEN_TYPES.includes(e.type))
                start('Lyssningsövning', '🎧', listening.length >= 4 ? listening : all)
              }}
            />
          </div>
        </section>
      </div>
    </>
  )
}

const TONE_CLS = {
  lacquer: 'bg-lacquer-soft text-lacquer',
  plum: 'bg-plum-soft text-plum',
  brand: 'bg-brand-soft text-brand',
} as const

function DrillCard({ icon, tone, title, subtitle, disabled, onClick }: {
  icon: ReactNode; tone: keyof typeof TONE_CLS; title: string; subtitle: ReactNode; disabled: boolean; onClick: () => void
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="btn-3d flex w-full items-center gap-3 rounded-3xl border border-line/80 p-3.5 text-left disabled:!opacity-60"
      style={{ '--face': 'var(--color-surface)', '--edge': 'var(--color-line-dark)', '--shine': 0 } as CSSProperties}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${disabled ? 'bg-surface-2 text-ink-faint' : TONE_CLS[tone]}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg leading-tight font-semibold">{title}</span>
        <span className="block text-sm font-bold text-ink-muted">{disabled ? 'Gör några lektioner först' : subtitle}</span>
      </span>
      <ChevronRightIcon size={20} className="shrink-0 text-ink-faint" />
    </button>
  )
}
