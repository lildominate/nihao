// OWNER: Themes agent. Home-screen section "Teman": one card per theme, sheet with "Lär dig orden" / "Vad är det här?".
import { useMemo, useState } from 'react'
import type { Course, Theme } from '../types'
import { course as realCourse } from '../data/course'
import { useProgress } from '../progress'
import { playSfx } from '../speech'
import { generateLessonExercises, generateReviewExercises } from '../exercises'
import { lessonGenOptions, reviewGenOptions } from '../pedagogy/options'
import type { SessionSpec } from '../app/Session'
import { Sheet } from '../ui/Sheet'
import { EmojiBox, WordPicture } from './WordPicture'
import { ThemePictureGame } from './ThemePictureGame'
import { loadThemeBests, planThemeLesson, themeMastery, themeProgress, themesOf, themeWords } from './logic'

export function ThemesSection({ onStartLesson, course = realCourse }: { onStartLesson(spec: SessionSpec): void; course?: Course }) {
  const progress = useProgress()
  const themes = useMemo(() => themesOf(course), [course])
  const [open, setOpen] = useState<Theme | null>(null)
  const [game, setGame] = useState<string | null>(null)
  const known = new Set(progress.knownWordIds())
  if (themes.length === 0) return null

  const startLesson = (theme: Theme) => {
    const plan = planThemeLesson(theme, course, known, progress.mastery)
    const speaking = false
    const spec: SessionSpec = plan.mode === 'learn'
      ? {
          kind: 'practice', title: plan.lesson.title, emoji: theme.emoji,
          exercises: generateLessonExercises(plan.lesson, course, { ...lessonGenOptions(progress, { speaking }), maxScored: 14 }),
        }
      : {
          kind: 'practice', title: plan.title, emoji: theme.emoji,
          exercises: generateReviewExercises(plan.items, course, reviewGenOptions(progress, { speaking })),
        }
    setOpen(null)
    onStartLesson(spec)
  }

  if (game) return <ThemePictureGame themeId={game} course={course} onExit={() => setGame(null)} />

  return (
    <section aria-labelledby="themes-h" className="mt-6">
      <h2 id="themes-h" className="mb-2 px-1 font-display text-xl font-semibold">Teman</h2>
      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => {
          const p = themeProgress(t, course, known)
          const m = themeMastery(t, course, progress.mastery)
          return (
            <button key={t.id} type="button" onClick={() => { playSfx('tap'); setOpen(t) }}
              className="press flex flex-col items-start gap-1 rounded-3xl border border-line/80 bg-surface p-3.5 text-left shadow-card active:translate-y-0.5">
              <EmojiBox emoji={t.emoji} size={44} />
              <span className="font-display text-lg leading-tight font-semibold">{t.title}</span>
              <span className="text-sm font-bold text-ink-muted">{p.known}/{p.total} ord kan du</span>
              <span className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(m * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Behärskning ${t.title}`}>
                <span className="block h-full origin-left rounded-full bg-brand transition-transform" style={{ transform: `scaleX(${Math.max(0.03, m)})` }} />
              </span>
            </button>
          )
        })}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} labelledBy="theme-sheet-h">
        {open && (() => {
          const p = themeProgress(open, course, known)
          const best = loadThemeBests()[open.id]?.best ?? 0
          const plan = planThemeLesson(open, course, known, progress.mastery)
          return (
            <div>
              <div className="flex items-center gap-3">
                <EmojiBox emoji={open.emoji} size={56} />
                <div className="min-w-0">
                  <h3 id="theme-sheet-h" className="font-display text-2xl leading-tight font-semibold">{open.title}</h3>
                  <p className="text-sm font-bold text-ink-muted">{p.known}/{p.total} ord kan du{best > 0 ? ` · rekord ${best}` : ''}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
                {themeWords(open, course).slice(0, 14).map((w) => <WordPicture key={w.id} word={w} size={28} />)}
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                <button type="button" onClick={() => { playSfx('tap'); startLesson(open) }}
                  className="press w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
                  📘 Lär dig orden
                  <span className="block text-xs font-bold text-white/85">
                    {plan.mode === 'learn' ? `${plan.lesson.newWords.length} nya ord · Del ${plan.n}` : 'Du kan alla – repetera'}
                  </span>
                </button>
                <button type="button" onClick={() => { playSfx('tap'); setOpen(null); setGame(open.id) }}
                  className="press w-full rounded-2xl border-b-4 border-sky-dark bg-sky py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
                  🖼️ Vad är det här?
                </button>
              </div>
            </div>
          )
        })()}
      </Sheet>
    </section>
  )
}
