// OWNER: Themes agent. Spelhallen entry for "Vad är det här?": pick a theme, then play.
import { useMemo, useState } from 'react'
import type { Course } from '../types'
import { course as realCourse } from '../data/course'
import { playSfx } from '../speech'
import { ThemePictureGame } from './ThemePictureGame'
import { EmojiBox } from './WordPicture'
import { loadThemeBests, themesOf, themeWords } from './logic'

/** Full-screen theme picker → game. `onExit` fires when the player leaves the picker. */
export function ThemeGameEntry({ onExit, course = realCourse }: { onExit(): void; course?: Course }) {
  const themes = useMemo(() => themesOf(course), [course])
  const [themeId, setThemeId] = useState<string | null>(null)
  const [bests, setBests] = useState(() => loadThemeBests())
  if (themeId) return <ThemePictureGame themeId={themeId} course={course} onExit={() => { setBests(loadThemeBests()); setThemeId(null) }} />
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-surface text-ink">
      <div className="flex min-h-full w-full max-w-md flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onExit} aria-label="Tillbaka" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-ink-muted active:scale-95">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <h2 className="mt-3 text-3xl font-black">Vad är det här?</h2>
        <p className="mb-4 font-bold text-ink-muted">Välj ett tema</p>
        {themes.length === 0 && <p className="font-bold text-ink-muted">Inga teman ännu.</p>}
        <div className="grid grid-cols-2 gap-3">
          {themes.map((t) => (
            <button key={t.id} type="button" onClick={() => { playSfx('tap'); setThemeId(t.id) }}
              className="press flex flex-col items-start gap-1 rounded-3xl border-2 border-b-4 border-line bg-surface p-3.5 text-left active:translate-y-0.5 active:border-b-2">
              <EmojiBox emoji={t.emoji} size={48} />
              <span className="text-lg leading-tight font-black">{t.title}</span>
              <span className="text-sm font-bold text-ink-muted">{themeWords(t, course).length} ord{bests[t.id]?.best ? ` · rekord ${bests[t.id].best}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Spelhallen card definition (same look as the other GamesHub cards). The hub renders `Component`
 * full-screen when the card is tapped, and calls `onExit` to close it.
 */
export const THEME_GAME_ENTRY = {
  id: 'themes',
  title: 'Vad är det här?',
  tagline: 'Se bilden – välj rätt ord!',
  emoji: '🖼️',
  gradient: 'from-sky-400 to-indigo-500',
  shadow: 'shadow-[0_5px_0_#4338ca]',
  Component: ThemeGameEntry,
} as const
