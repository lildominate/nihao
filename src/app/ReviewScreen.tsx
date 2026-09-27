// "Repetera" — practice hub (Shell).
import type { ReactNode } from 'react'
import type { Exercise } from '../types'
import { course } from '../data/course'
import { generateReviewExercises, generateToneDrill } from '../exercises'
import { useProgress } from '../progress'
import { isRecognitionAvailable } from '../speech'
import { Button } from '../ui/Button'
import { TopBar, StreakBadge } from './chrome'
import { shuffle } from './util'
import type { SessionSpec } from './Session'

const LISTEN_TYPES: Exercise['type'][] = ['listen-choose', 'tone-pick', 'build-sv']

export function ReviewScreen({ onStart }: { onStart: (spec: SessionSpec) => void }) {
  const { dueItems, weakItems, knownWordIds, state } = useProgress()
  const known = knownWordIds().filter((id) => course.words[id])
  const due = dueItems()
  const weak = weakItems(12)
  const speaking = state.settings.speakingExercises && isRecognitionAvailable()
  const nothingLearned = known.length === 0

  const start = (title: string, emoji: string, exercises: Exercise[]) => onStart({ kind: 'practice', title, emoji, exercises })

  return (
    <>
      <TopBar title="Repetera" right={<StreakBadge />} />
      <div className="space-y-4 px-4 py-5">
        {nothingLearned && (
          <div className="rounded-3xl border-2 border-dashed border-line p-4 text-center font-semibold text-ink-muted">
            🌱 Här repeterar du det du har lärt dig. Gör din första lektion under <b className="text-ink">Lär dig</b> så fylls den här sidan på.
          </div>
        )}

        <PracticeCard
          emoji="🔁" color="#0ea5e9" dark="#0284c7"
          title="Repetera"
          subtitle={due.length > 0 ? `${due.length} ord att repetera` : 'Allt är repeterat'}
          empty={nothingLearned ? 'Inga ord att repetera än.' : due.length === 0 ? 'Inget behöver repeteras just nu – bra jobbat! Kom tillbaka i morgon.' : null}
          cta="Repetera"
          onClick={() => start('Repetition', '🔁', generateReviewExercises(due.slice(0, 20), course, { speaking }))}
        />

        <PracticeCard
          emoji="🧗" color="#f97316" dark="#ea580c"
          title="Svåra ord"
          subtitle={weak.length === 1 ? 'Öva på ordet du oftast missar' : weak.length > 1 ? `Öva på de ${weak.length} ord du oftast missar` : 'De ord du har svårast för'}
          empty={weak.length === 0 ? (nothingLearned ? 'När du har gjort några lektioner samlas dina knepigaste ord här.' : 'Inga svåra ord just nu. Snyggt!') : null}
          cta="Öva"
          onClick={() => start('Svåra ord', '🧗', generateReviewExercises(weak, course, { speaking }))}
        />

        <PracticeCard
          emoji="🎵" color="#a855f7" dark="#9333ea"
          title="Tonträning"
          subtitle="Lyssna och välj rätt ton – ett, två, tre eller fyra"
          empty={nothingLearned ? 'Lär dig några ord först, så tränar vi tonerna på dem.' : null}
          cta="Träna toner"
          onClick={() => start('Tonträning', '🎵', generateToneDrill(known, course, 15))}
        >
          <div className="mt-2 flex gap-1.5 text-lg font-black">
            <span className="text-tone-1">mā</span><span className="text-tone-2">má</span><span className="text-tone-3">mǎ</span><span className="text-tone-4">mà</span>
          </div>
        </PracticeCard>

        <PracticeCard
          emoji="🎧" color="#22c55e" dark="#16a34a"
          title="Lyssningsövning"
          subtitle="Bara öronen: hör och förstå"
          empty={nothingLearned ? 'Lyssningsövningar blir tillgängliga när du har lärt dig dina första ord.' : null}
          cta="Lyssna"
          onClick={() => {
            const refs = shuffle(known).slice(0, 12).map((id) => ({ kind: 'word' as const, id }))
            const all = generateReviewExercises(refs, course, { speaking: false })
            const listening = all.filter((e) => LISTEN_TYPES.includes(e.type))
            start('Lyssningsövning', '🎧', listening.length >= 4 ? listening : all)
          }}
        />
      </div>
    </>
  )
}

function PracticeCard({ emoji, color, dark, title, subtitle, empty, cta, onClick, children }: {
  emoji: string; color: string; dark: string; title: string; subtitle: string; empty: string | null; cta: string; onClick: () => void; children?: ReactNode
}) {
  const disabled = empty !== null
  return (
    <div className="rounded-3xl border-2 border-b-4 border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl ${disabled ? 'grayscale' : ''}`} style={{ background: disabled ? '#f3f4f6' : color + '22' }} aria-hidden="true">{emoji}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-black">{title}</h2>
          <p className="text-sm font-semibold text-ink-muted">{subtitle}</p>
          {children}
        </div>
      </div>
      {disabled ? (
        <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm font-semibold text-ink-muted">{empty}</p>
      ) : (
        <Button className="mt-3 w-full text-white" style={{ background: color, borderColor: dark }} onClick={onClick}>{cta}</Button>
      )}
    </div>
  )
}
