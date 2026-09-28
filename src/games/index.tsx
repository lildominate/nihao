// OWNER: Games agent. "Spelhallen" — mini-games on learned words. Entry = contract.
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { LessonResult, Word } from '../types'
import { course } from '../data/course'
import { useProgress } from '../progress'
import { Panda } from '../mascot/Panda'
import { playSfx } from '../speech'
import './games.css'
import { buildWordPool } from './logic/pool'
import { loadRecords, saveScore, type GameId, type Records } from './logic/records'
import { GAME_ART } from './ui/art'
import { useGamesReducedMotion, type GameOutcome, type GameProps } from './ui/kit'
import { ScoreScreen } from './ui/ScoreScreen'
import { Ordregn } from './play/Ordregn'
import { Memory } from './play/Memory'
import { Blixtquiz } from './play/Blixtquiz'
import { Tonjakt } from './play/Tonjakt'
import { Meningsbyggaren, sentencesFor } from './play/Meningsbyggaren'

interface GameDef {
  id: GameId
  title: string
  tagline: string
  rules: string[]
  gradient: string
  shadow: string
  component: ComponentType<GameProps>
  modes?: { id: string; label: string }[]
}

const GAMES: GameDef[] = [
  {
    id: 'ordregn', title: 'Ordregn', tagline: 'Fånga orden innan de landar!',
    rules: ['Ett ord faller från himlen.', 'Tryck på rätt översättning innan det landar.', 'Det går snabbare och snabbare. Tre missar och rundan är slut.'],
    gradient: 'from-sky-400 to-indigo-500', shadow: 'shadow-[0_5px_0_#4338ca]', component: Ordregn,
    modes: [{ id: 'normal', label: 'Svenska → pinyin' }, { id: 'reverse', label: 'Pinyin → svenska' }],
  },
  {
    id: 'blixt', title: 'Blixtquiz', tagline: '60 sekunder. Hur många hinner du?',
    rules: ['Lyssna och välj betydelsen, eller välj pinyin till det svenska ordet.', 'Svar i rad ger kombo och multiplicerar poängen.', 'Var femte i rad ger +5 sekunder.'],
    gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-[0_5px_0_#c2410c]', component: Blixtquiz,
  },
  {
    id: 'tonjakt', title: 'Tonjakt', tagline: 'Hör tonen. Swipea åt rätt håll.',
    rules: ['Lyssna på stavelsen.', 'Swipea: → hög, ↗ stigande, ↘↗ dipp, ↘ fallande. Eller tryck på knapparna.', 'Från nivå 3 kommer ord med två stavelser.'],
    gradient: 'from-rose-400 to-purple-500', shadow: 'shadow-[0_5px_0_#7e22ce]', component: Tonjakt,
  },
  {
    id: 'memory', title: 'Memory', tagline: 'Para ihop ljud och betydelse.',
    rules: ['Vänd två kort åt gången.', 'Pinyinkorten säger ordet högt. Hitta det svenska kortet som hör ihop.', 'Färre drag och snabbare tid ger mer poäng.'],
    gradient: 'from-violet-500 to-fuchsia-500', shadow: 'shadow-[0_5px_0_#86198f]', component: Memory,
  },
  {
    id: 'bygg', title: 'Meningsbyggaren', tagline: 'Bygg meningar mot klockan.',
    rules: ['Du ser en mening på svenska.', 'Tryck på pinyinbitarna i rätt ordning.', 'Du har 90 sekunder. Felfria meningar ger dubbla poäng.'],
    gradient: 'from-emerald-400 to-teal-500', shadow: 'shadow-[0_5px_0_#0f766e]', component: Meningsbyggaren,
  },
]

type Active =
  | { def: GameDef; phase: 'intro' | 'play'; words: Word[]; mode: string; run: number }
  | { def: GameDef; phase: 'done'; words: Word[]; mode: string; run: number; outcome: GameOutcome; best: number; isNewRecord: boolean; xp: number }

const MODE_KEY = 'nihao/games/mode'
function loadMode(): string { try { return localStorage.getItem(MODE_KEY) ?? 'normal' } catch { return 'normal' } }
function saveMode(m: string) { try { localStorage.setItem(MODE_KEY, m) } catch { /* private mode */ } }

/** Tab screen listing the games; launches them full-screen itself. */
export function GamesHub() {
  const progress = useProgress()
  const { settings } = progress.state
  const reduced = useGamesReducedMotion()
  const knownIds = progress.knownWordIds()
  const knownKey = knownIds.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => buildWordPool(knownIds, course), [knownKey])
  const extra = useMemo(() => Object.values(course.words), [])
  const canBuild = useMemo(() => sentencesFor(pool.words.map((w) => w.id)).length > 0, [pool])
  const [records, setRecords] = useState<Records>(() => loadRecords())
  const [active, setActive] = useState<Active | null>(null)
  const [mode, setMode] = useState(loadMode)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active })

  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])

  const open = (def: GameDef) => {
    playSfx('tap')
    setActive({ def, phase: 'intro', words: pool.words, mode, run: 0 })
  }
  // Words are frozen per run so the pool doesn't shift mid-game when finishSession adds cards.
  const start = () => setActive((a) => (a ? { def: a.def, phase: 'play', words: pool.words, mode, run: a.run + 1 } : a))

  const record = (result: LessonResult | null): number => {
    if (!result || result.items.length === 0) return 0
    try { return progress.finishSession(result).xpEarned } catch { return 0 }
  }

  const onEnd = (outcome: GameOutcome) => {
    const a = activeRef.current
    if (!a || a.phase !== 'play') return
    const xp = record(outcome.result)
    const r = saveScore(a.def.id, outcome.score)
    setRecords(r.records)
    const next: Active = { ...a, phase: 'done', outcome, best: r.records[a.def.id]?.best ?? outcome.score, isNewRecord: r.isNewRecord, xp }
    activeRef.current = next
    setActive(next)
  }
  const onExit = (partial: LessonResult | null) => {
    if (activeRef.current?.phase === 'play') record(partial)
    activeRef.current = null
    setActive(null)
  }

  if (active?.phase === 'intro') {
    return <GameIntro def={active.def} mode={mode} setMode={setMode} words={pool.words.length} reduced={reduced} onStart={start} onClose={() => setActive(null)} />
  }
  if (active?.phase === 'play') {
    const G = active.def.component
    return <G key={active.run} words={active.words} extra={extra} mode={active.mode} reduced={reduced} toneColors={settings.toneColors} onEnd={onEnd} onExit={onExit} />
  }
  if (active?.phase === 'done') {
    return (
      <ScoreScreen title={active.def.title} outcome={active.outcome} best={active.best} isNewRecord={active.isNewRecord} xp={active.xp}
        toneColors={settings.toneColors} reduced={reduced} onAgain={start} onClose={() => setActive(null)} />
    )
  }

  return (
    <div className={`px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6 ${reduced ? 'g-reduced' : ''}`}>
      <header className="flex items-center gap-3">
        <div className="g-drift"><Panda mood="happy" size={64} /></div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black">Spelhallen</h1>
          <p className="font-bold text-ink-muted">Spela och lär dig samtidigt · {pool.words.length} ord</p>
        </div>
      </header>

      {pool.fallback && (
        <div className="mt-4 rounded-2xl border-2 border-sky/40 bg-sky-soft px-4 py-3 text-sm font-bold text-sky-dark">
          {pool.knownCount === 0
            ? 'Du har inte lärt dig några ord än, så vi lånar orden från första enheten. Spela loss – snart är de dina!'
            : `Du kan ${pool.knownCount} ord än så länge, så vi fyller på med ord från första enheten. Ju fler lektioner, desto fler ord i spelen!`}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {GAMES.map((g, i) => {
          const rec = records[g.id]
          const Art = GAME_ART[g.id]
          const disabled = g.id === 'bygg' && !canBuild
          return (
            <button key={g.id} type="button" disabled={disabled} onClick={() => open(g)}
              style={{ animationDelay: `${i * 50}ms` }}
              className={`press g-in relative flex min-h-32 items-stretch overflow-hidden rounded-3xl bg-gradient-to-br ${g.gradient} ${g.shadow} p-4 text-left text-white transition-transform active:translate-y-1 active:shadow-none disabled:opacity-50`}>
              <div className="pointer-events-none absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
              <div className="relative z-10 flex min-w-0 flex-1 flex-col">
                <div className="text-2xl font-black drop-shadow-sm">{g.title}</div>
                <div className="mt-0.5 text-[15px] leading-snug font-bold text-white/90">{disabled ? 'Lär dig några fler ord först!' : g.tagline}</div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  <span className="rounded-full bg-black/20 px-3 py-1 text-sm font-black">
                    {rec?.best ? `Rekord ${rec.best.toLocaleString('sv-SE')}` : 'Inget rekord än'}
                  </span>
                  {rec?.lastWasRecord && <span className="g-pop rounded-full bg-gold px-2.5 py-1 text-xs font-black text-ink shadow">Nytt rekord!</span>}
                </div>
              </div>
              <div className="relative z-10 h-24 w-24 shrink-0 self-center"><Art /></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GameIntro({ def, mode, setMode, words, reduced, onStart, onClose }: {
  def: GameDef; mode: string; setMode(m: string): void; words: number; reduced: boolean; onStart(): void; onClose(): void
}) {
  const Art = GAME_ART[def.id]
  return (
    <div className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-surface text-ink ${reduced ? 'g-reduced' : ''}`}>
      <div className="flex min-h-full w-full max-w-md flex-col">
        <div className={`relative bg-gradient-to-br ${def.gradient} px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-6 text-white`}>
          <button type="button" onClick={onClose} aria-label="Tillbaka"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/15 active:scale-95">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="g-pop mx-auto -mt-4 h-32 w-32"><Art /></div>
          <h2 className="text-center text-4xl font-black drop-shadow-sm">{def.title}</h2>
          <p className="text-center text-lg font-bold text-white/90">{def.tagline}</p>
        </div>
        <div className="flex flex-1 flex-col px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <h3 className="mb-2 font-black">Så spelar du</h3>
          <ol className="flex flex-col gap-2">
            {def.rules.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5 font-bold">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-black text-surface">{i + 1}</span>
                <span className="leading-snug">{r}</span>
              </li>
            ))}
          </ol>
          {def.modes && (
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1.5" role="radiogroup" aria-label="Läge">
              {def.modes.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={mode === m.id}
                  onClick={() => { playSfx('tap'); setMode(m.id); saveMode(m.id) }}
                  className={`min-h-11 rounded-xl py-2.5 text-sm font-black transition-colors ${mode === m.id ? 'bg-surface text-ink shadow' : 'text-ink-muted'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-sm font-bold text-ink-muted">{words} ord · dina svar hamnar i repetitionen</p>
          <div className="mt-auto pt-5">
            <button type="button" onClick={onStart}
              className="w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-4 text-xl font-black text-white active:translate-y-0.5 active:border-b-2">
              Starta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
