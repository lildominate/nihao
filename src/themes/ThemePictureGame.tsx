// OWNER: Themes agent. "Vad är det här?" — big picture, 4 pinyin options, 10 weighted words per round.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course, LessonResult, Theme, Word } from '../types'
import { course as realCourse } from '../data/course'
import { useProgress } from '../progress'
import { hasChineseVoice, PinyinText, playSfx, speak, stopSpeaking } from '../speech'
import { celebrate, haptic } from '../motion'
import { Panda } from '../mascot/Panda'
import '../games/games.css'
import { AudioSequencer, browserAudioDeps } from '../games/logic/audioQueue'
import { AnswerTracker } from '../games/logic/session'
import { buildWeights } from '../games/logic/weighting'
import { GameFrame, practisedWords, ScorePill, useGamesReducedMotion, usePause, type GameOutcome } from '../games/ui/kit'
import { ScoreScreen } from '../games/ui/ScoreScreen'
import { WordPicture } from './WordPicture'
import { buildQuestion, buildRound, loadThemeBests, pointsFor, ROUND_SIZE, saveThemeScore, themesOf, themeWords, wordRef, type PictureQuestion } from './logic'

const TITLE = 'Vad är det här?'
const COUNT_FROM = 3

type Phase =
  | { phase: 'intro' | 'play'; run: number }
  | { phase: 'done'; run: number; outcome: GameOutcome; best: number; isNewRecord: boolean; xp: number }

function Speaker({ onClick, label = 'Lyssna' }: { onClick(): void; label?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="press inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-b-4 border-sky-dark bg-sky text-white active:translate-y-0.5 active:border-b-2">
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" /><path d="M16.2 9a4 4 0 0 1 0 6M18.6 6.6a7.4 7.4 0 0 1 0 10.8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
    </button>
  )
}

export function ThemePictureGame({ themeId, onExit, course = realCourse }: { themeId: string; onExit(): void; course?: Course }) {
  const progress = useProgress()
  const { settings } = progress.state
  const reduced = useGamesReducedMotion()
  const themes = useMemo(() => themesOf(course), [course])
  const theme = themes.find((t) => t.id === themeId)
  const [st, setSt] = useState<Phase>({ phase: 'intro', run: 0 })
  const stRef = useRef(st)
  const setState = (n: Phase) => { stRef.current = n; setSt(n) }
  const [round, setRound] = useState<Word[]>([])
  const [bests, setBests] = useState(() => loadThemeBests())

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!theme) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface p-6 text-center text-ink">
        <Panda mood="think" size={96} />
        <p className="font-bold">Temat hittades inte.</p>
        <button type="button" onClick={onExit} className="rounded-2xl border-b-4 border-brand-dark bg-brand px-6 py-3 font-black text-white">Tillbaka</button>
      </div>
    )
  }

  const start = () => {
    const words = themeWords(theme, course)
    setRound(buildRound(theme, course, buildWeights(words, progress), Math.random, ROUND_SIZE))
    setState({ phase: 'play', run: stRef.current.run + 1 })
  }
  const record = (result: LessonResult | null): number => {
    if (!result || result.items.length === 0) return 0
    try { return progress.finishSession(result).xpEarned } catch { return 0 }
  }
  const onEnd = (outcome: GameOutcome) => {
    const a = stRef.current
    if (a.phase !== 'play') return
    const xp = record(outcome.result)
    const r = saveThemeScore(theme.id, outcome.score)
    setBests(loadThemeBests())
    setState({ phase: 'done', run: a.run, outcome, best: r.best, isNewRecord: r.isNewRecord, xp })
  }
  const exit = (partial: LessonResult | null) => {
    if (stRef.current.phase === 'play') record(partial)
    onExit()
  }

  if (st.phase === 'intro') {
    return <Intro theme={theme} best={bests[theme.id]?.best ?? 0} count={themeWords(theme, course).length} reduced={reduced} onStart={start} onClose={onExit} />
  }
  if (st.phase === 'play') {
    return <Round key={st.run} theme={theme} themes={themes} course={course} words={round} reduced={reduced} toneColors={settings.toneColors} showHanzi={settings.showHanzi} onEnd={onEnd} onExit={exit} />
  }
  if (st.phase !== 'done') return null
  return (
    <ScoreScreen title={`${TITLE} · ${theme.title}`} outcome={st.outcome} best={st.best} isNewRecord={st.isNewRecord} xp={st.xp}
      toneColors={settings.toneColors} reduced={reduced} onAgain={start} onClose={onExit} />
  )
}

function Intro({ theme, best, count, reduced, onStart, onClose }: { theme: Theme; best: number; count: number; reduced: boolean; onStart(): void; onClose(): void }) {
  return (
    <div className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-surface text-ink ${reduced ? 'g-reduced' : ''}`}>
      <div className="flex min-h-full w-full max-w-md flex-col">
        <div className="bg-gradient-to-br from-sky-400 to-indigo-500 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-6 text-white">
          <button type="button" onClick={onClose} aria-label="Tillbaka" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/15 active:scale-95">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="g-pop mx-auto -mt-2 flex justify-center"><WordPicture word={{ emoji: theme.emoji }} size={96} /></div>
          <h2 className="text-center text-4xl font-black drop-shadow-sm">{TITLE}</h2>
          <p className="text-center text-lg font-bold text-white/90">{theme.title}</p>
        </div>
        <div className="flex flex-1 flex-col px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <h3 className="mb-2 font-black">Så spelar du</h3>
          <ol className="flex flex-col gap-2">
            {['Du ser en bild. Vad heter den på kinesiska?', 'Tryck på ett alternativ för att höra det. Tryck igen (eller Kontrollera) för att svara.', `${ROUND_SIZE} bilder per runda. Ord du inte kan än kommer oftast först, så det här är också ett sätt att lära sig.`].map((r, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 font-bold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-black text-surface">{i + 1}</span>
                <span className="leading-snug">{r}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-sm font-bold text-ink-muted">{count} ord i temat{best > 0 ? ` · rekord ${best}` : ''} · dina svar hamnar i repetitionen</p>
          <div className="mt-auto pt-5">
            <button type="button" onClick={onStart} className="w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-xl font-black text-white active:translate-y-0.5 active:border-b-2">Starta</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Round({ theme, themes, course, words, reduced, toneColors, showHanzi, onEnd, onExit }: {
  theme: Theme; themes: Theme[]; course: Course; words: Word[]; reduced: boolean; toneColors: boolean; showHanzi: boolean
  onEnd(o: GameOutcome): void; onExit(partial: LessonResult | null): void
}) {
  const progress = useProgress()
  const [paused, setPaused] = usePause()
  const tracker = useRef(new AnswerTracker())
  const seq = useRef<AudioSequencer>(null as unknown as AudioSequencer)
  if (!seq.current) seq.current = new AudioSequencer(browserAudioDeps((t) => speak(t), () => stopSpeaking(), () => hasChineseVoice()), { silentMs: 900 })
  const startedAt = useRef(performance.now())
  const over = useRef(false)
  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words])
  // Questions are built once per round (options fixed, so re-renders never reshuffle).
  const [questions] = useState<PictureQuestion[]>(() => words.map((w) => buildQuestion(w, theme, course, themes, progress.mastery(wordRef(w.id)), Math.random)))

  const [count, setCount] = useState(COUNT_FROM)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const stats = useRef({ score: 0, right: 0, best: 0 })
  const layer = useRef<HTMLDivElement>(null)
  const optRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    const s = seq.current
    over.current = false
    return () => { over.current = true; s.cancel() }
  }, [])

  // Countdown 3-2-1 (pauses with the game).
  useEffect(() => {
    if (paused || count <= 0) return
    const t = window.setTimeout(() => setCount((c) => c - 1), reduced ? 500 : 750)
    return () => window.clearTimeout(t)
  }, [count, paused, reduced])
  useEffect(() => { if (paused) seq.current.cancel() }, [paused])

  const q = questions[idx]
  const playing = count <= 0 && !!q

  const say = (w: Word) => { void seq.current.replay(w.hanzi) }

  const check = (pickId: string) => {
    if (!q || checked || paused || over.current) return
    const ok = pickId === q.word.id
    tracker.current.record(wordRef(q.word.id), ok)
    setChecked(true)
    if (ok) {
      const c = combo + 1
      const pts = pointsFor(c)
      stats.current.score += pts; stats.current.right += 1; stats.current.best = Math.max(stats.current.best, c)
      setCombo(c); setScore(stats.current.score)
      playSfx('correct'); haptic('success')
      celebrate('burst', { from: optRefs.current.get(pickId), intensity: Math.min(1.4, 0.6 + c * 0.1) })
    } else {
      setCombo(0)
      playSfx('wrong'); haptic('error')
      void seq.current.replay(q.word.hanzi)
    }
  }

  const tapOption = (o: Word) => {
    if (!playing || checked || paused) return
    if (picked === o.id) { check(o.id); return }
    setPicked(o.id)
    playSfx('tap'); haptic('select')
    say(o)
  }

  const finish = () => {
    if (over.current) return
    over.current = true
    seq.current.cancel()
    const result = tracker.current.result(performance.now() - startedAt.current)
    const total = tracker.current.answered
    onEnd({
      score: stats.current.score,
      result,
      practised: practisedWords(result, byId),
      headline: `${stats.current.right} av ${total} rätt!`,
      stats: [
        { label: 'Rätt', value: String(stats.current.right) },
        { label: 'Bästa kombo', value: String(stats.current.best) },
        { label: 'Träffsäkerhet', value: `${total ? Math.round((stats.current.right / total) * 100) : 0} %` },
      ],
    })
  }

  const next = () => {
    if (!checked) return
    if (idx + 1 >= questions.length) { finish(); return }
    seq.current.cancel()
    setIdx(idx + 1); setPicked(null); setChecked(false)
  }

  const hud = (
    <div className="flex items-center justify-between gap-2">
      <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-black tabular-nums text-ink-muted">{Math.min(idx + 1, questions.length)} / {questions.length}</span>
      <span key={combo} className={`rounded-full px-3 py-1 text-sm font-black ${combo >= 3 ? 'g-bump bg-flame text-white' : 'bg-surface-2 text-ink-muted'}`}>{combo >= 2 ? `Kombo ${combo}` : theme.title}</span>
      <ScorePill score={score} />
    </div>
  )

  if (!q) return null
  const wrong = checked && picked !== q.word.id

  return (
    <GameFrame title={TITLE} paused={paused} setPaused={setPaused} reduced={reduced} hud={hud}
      onExit={() => { seq.current.cancel(); onExit(tracker.current.answered ? tracker.current.result(performance.now() - startedAt.current) : null) }}>
      <div className="relative flex h-full flex-col px-4 pb-3">
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full origin-left rounded-full bg-brand transition-transform duration-300" style={{ transform: `scaleX(${(idx + (checked ? 1 : 0)) / questions.length})` }} />
        </div>

        {count > 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <span key={count} className="g-pop text-9xl font-black text-ink" data-testid="theme-count">{count}</span>
          </div>
        ) : (
          <>
            <div key={idx} className="g-in flex min-h-0 flex-1 flex-col items-center justify-center gap-2 py-2">
              <div className={checked && !wrong ? 'g-pop' : ''}><WordPicture word={q.word} size={168} /></div>
              <div className="text-center text-lg font-extrabold text-ink-muted">Vad heter det här på kinesiska?</div>
            </div>

            {checked ? (
              <div className="g-in mb-2 flex items-center gap-3 rounded-2xl border-2 border-line bg-surface-2/60 px-3 py-2.5" data-testid="theme-feedback">
                <Speaker onClick={() => say(q.word)} />
                <div className="min-w-0 flex-1">
                  <PinyinText pinyin={q.word.pinyin} colored={toneColors} className="block text-2xl leading-tight font-black" />
                  {showHanzi && <div className="text-lg font-bold">{q.word.hanzi}</div>}
                  <div className="truncate font-bold text-ink-muted">{q.word.sv}</div>
                </div>
                <span className={`text-2xl ${wrong ? '' : 'g-pop'}`} aria-hidden="true">{wrong ? '↻' : '✓'}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              {q.options.map((o) => {
                const isRight = o.id === q.word.id
                const isPicked = picked === o.id
                const style = checked
                  ? isRight ? 'border-brand-dark bg-brand text-white' : isPicked ? 'g-shake border-red-700 bg-danger text-white' : 'border-line bg-surface opacity-50'
                  : isPicked ? 'border-sky-dark bg-sky-soft' : 'border-line bg-surface active:translate-y-0.5 active:border-b-2'
                const plain = checked && (isRight || isPicked)
                return (
                  <button key={`${idx}-${o.id}`} type="button" disabled={checked} aria-pressed={isPicked}
                    ref={(el) => { if (el) optRefs.current.set(o.id, el); else optRefs.current.delete(o.id) }}
                    onClick={() => tapOption(o)}
                    className={`press flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 border-b-4 px-2 py-3 text-center text-2xl leading-tight font-black transition-colors ${style}`}>
                    <PinyinText pinyin={o.pinyin} colored={toneColors && !plain} />
                    {showHanzi && <span className="text-base font-bold opacity-80">{o.hanzi}</span>}
                  </button>
                )
              })}
            </div>

            <div className="mt-3">
              {checked ? (
                <button type="button" onClick={next}
                  className="w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
                  {idx + 1 >= questions.length ? 'Se resultat' : 'Nästa'}
                </button>
              ) : (
                <button type="button" disabled={!picked} onClick={() => picked && check(picked)}
                  className="w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-lg font-black text-white active:translate-y-0.5 active:border-b-2 disabled:border-line disabled:bg-surface-3 disabled:text-ink-faint">
                  Kontrollera
                </button>
              )}
            </div>
          </>
        )}
        <div ref={layer} className="pointer-events-none absolute inset-0" />
      </div>
    </GameFrame>
  )
}
