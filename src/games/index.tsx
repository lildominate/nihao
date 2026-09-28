// OWNER: Games agent. "Spelhallen" — mini-games on learned words. Entry = contract.
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import type { LessonResult, Word } from '../types'
import { course } from '../data/course'
import { useProgress } from '../progress'
import { Panda } from '../mascot/Panda'
import { playSfx } from '../speech'
import './games.css'
import { buildWordPool, MIN_POOL } from './logic/pool'
import { buildWeights, type Weights } from './logic/weighting'
import { loadRecords, saveScore, type GameId, type Records } from './logic/records'
import { GAME_ART } from './ui/art'
import { useGamesReducedMotion, type GameOutcome, type GameProps } from './ui/kit'
import { ScoreScreen } from './ui/ScoreScreen'
import { Ordregn } from './play/Ordregn'
import { PanpanRunner } from './play/PanpanRunner'
import { Blixtquiz } from './play/Blixtquiz'
import { Tonjakt } from './play/Tonjakt'
import { Meningsbyggaren, sentencesFor } from './play/Meningsbyggaren'
import { PanpanSnake } from './play/PanpanSnake'
import { PanpansBro } from './play/PanpansBro'

interface GameDef {
  id: GameId
  title: string
  tagline: string
  rules: string[]
  gradient: string
  shadow: string
  component: ComponentType<GameProps>
  modes?: { id: string; label: string }[]
  /** Playable only when there are sentences made of known words. */
  needsSentences?: boolean
  /** Kept for compatibility (PlayGame, records) but not shown as a card in the hub. */
  hidden?: boolean
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
    id: 'runner', title: 'Pānpan-språnget', tagline: 'Spring genom rätt port!',
    rules: ['Svep eller tryck vänster/höger för att springa genom rätt port.', 'Läs det svenska ordet högst upp och välj porten med rätt pinyin. Fel port eller blockerad väg kostar ett ❤️ (du har tre).', 'Det går snabbare, fler portar dyker upp och senare kommer hela fraser. Ca 20 portar per bana.'],
    gradient: 'from-teal-400 to-emerald-600', shadow: 'shadow-[0_5px_0_#047857]', component: PanpanRunner,
  },
  {
    id: 'snake', title: 'Pānpan Snake', tagline: 'Ät rätt pinyin och väx!',
    rules: ['Läs det svenska ordet högst upp och styr Pānpan till rätt pinyin-bit. Svep, använd pilarna eller piltangenterna.', 'Rätt bit gör ormen längre. Fel bit kostar ett ❤️ (du har tre) och ormen blir en bit kortare. Vägg eller svans kostar också ett ❤️, men du börjar om på en säker plats.', 'Det går allt snabbare, fler bitar dyker upp och senare kommer korta fraser. Ca 15 frågor per bana.'],
    gradient: 'from-lime-400 to-green-600', shadow: 'shadow-[0_5px_0_#15803d]', component: PanpanSnake,
  },
  {
    id: 'bridge', title: 'Pānpans bro', tagline: 'Bygg bron och hoppa över!',
    rules: ['Läs meningen på svenska (tryck på högtalaren för att lyssna).', 'Tryck på pinyin-bitarna i rätt ordning. Varje rätt bit blir en planka och Pānpan hoppar fram. Fel bit spricker och faller: du förlorar ett ❤️ (du har tre).', 'Bygg klart meningen så springer Pānpan över. Varje bro blir längre. Sex broar per bana.'],
    gradient: 'from-orange-400 to-rose-500', shadow: 'shadow-[0_5px_0_#be123c]', component: PanpansBro, needsSentences: true, hidden: true, // not in the hub until it has been played through on device
  },
  {
    id: 'bygg', title: 'Meningsbyggaren', tagline: 'Bygg meningar mot klockan.',
    rules: ['Du ser en mening på svenska.', 'Tryck på pinyinbitarna i rätt ordning.', 'Du har 90 sekunder. Felfria meningar ger dubbla poäng.'],
    gradient: 'from-emerald-400 to-teal-500', shadow: 'shadow-[0_5px_0_#0f766e]', component: Meningsbyggaren, needsSentences: true,
  },
]

type Phase =
  | { phase: 'intro' | 'play'; run: number; weights?: Weights }
  | { phase: 'done'; run: number; weights?: Weights; outcome: GameOutcome; best: number; isNewRecord: boolean; xp: number }

const MODE_KEY = 'nihao/games/mode'
function loadMode(): string { try { return localStorage.getItem(MODE_KEY) ?? 'normal' } catch { return 'normal' } }
function saveMode(m: string) { try { localStorage.setItem(MODE_KEY, m) } catch { /* private mode */ } }

/** Games shown in the hub (Meningsbyggaren is replaced by Pānpans bro but still playable through PlayGame). */
const HUB_GAMES = GAMES.filter((g) => !g.hidden)
export const GAME_IDS: GameId[] = HUB_GAMES.map((g) => g.id)
export const GAME_TITLES: Record<GameId, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.title])) as Record<GameId, string>

/** Pure-ish pick for 'auto': the runner once ≥8 words are known, else Ordregn. */
export function autoGameId(knownCount: number): GameId { return knownCount >= MIN_POOL ? 'runner' : 'ordregn' }

/**
 * One game, full-screen: intro → play → score. Words are frozen at mount so the pool
 * doesn't shift mid-game when finishSession adds cards; weights are recomputed per run.
 */
function GameSession({ def, words, onClose, onRecords }: {
  def: GameDef; words: Word[]; onClose(played: boolean): void; onRecords?(r: Records): void
}) {
  const progress = useProgress()
  const { settings } = progress.state
  const reduced = useGamesReducedMotion()
  const extra = useMemo(() => Object.values(course.words), [])
  const [mode, setMode] = useState(loadMode)
  const [st, setSt] = useState<Phase>({ phase: 'intro', run: 0 })
  const stRef = useRef(st)
  const played = useRef(false)
  const setState = (n: Phase) => { stRef.current = n; setSt(n) }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const start = () => {
    const weights = buildWeights(words, progress)
    setState({ phase: 'play', run: stRef.current.run + 1, weights })
  }

  const record = (result: LessonResult | null): number => {
    if (!result || result.items.length === 0) return 0
    played.current = true
    try { return progress.finishSession(result).xpEarned } catch { return 0 }
  }

  const onEnd = (outcome: GameOutcome) => {
    const a = stRef.current
    if (a.phase !== 'play') return
    const xp = record(outcome.result)
    played.current = true
    const r = saveScore(def.id, outcome.score)
    onRecords?.(r.records)
    setState({ phase: 'done', run: a.run, weights: a.weights, outcome, best: r.records[def.id]?.best ?? outcome.score, isNewRecord: r.isNewRecord, xp })
  }
  const onExit = (partial: LessonResult | null) => {
    if (stRef.current.phase === 'play') record(partial)
    onClose(played.current)
  }

  if (st.phase === 'intro') {
    return <GameIntro def={def} mode={mode} setMode={setMode} words={words.length} reduced={reduced} onStart={start} onClose={() => onClose(played.current)} />
  }
  if (st.phase === 'play') {
    const G = def.component
    return <G key={st.run} words={words} extra={extra} weights={st.weights} mode={mode} reduced={reduced} toneColors={settings.toneColors} onEnd={onEnd} onExit={onExit} />
  }
  if (st.phase !== 'done') return null
  return (
    <ScoreScreen title={def.title} outcome={st.outcome} best={st.best} isNewRecord={st.isNewRecord} xp={st.xp}
      toneColors={settings.toneColors} reduced={reduced} onAgain={start} onClose={() => onClose(played.current)} />
  )
}

/**
 * Opens a game full-screen at its intro screen (like tapping its card in the hub).
 * `onDone` fires when the player leaves (Tillbaka on intro/score, or exit mid-game).
 * 'auto' = runner if ≥8 words known, else Ordregn.
 */
export function PlayGame({ gameId, onDone }: { gameId: GameId | 'auto'; onDone: (result: { played: boolean }) => void }) {
  const progress = useProgress()
  const [init] = useState(() => {
    const knownIds = progress.knownWordIds()
    const pool = buildWordPool(knownIds, course)
    let id: GameId = gameId === 'auto' ? autoGameId(pool.knownCount) : gameId
    // Sentence games need playable sentences; otherwise fall back to Ordregn.
    if (GAMES.find((g) => g.id === id)?.needsSentences && sentencesFor(pool.words.map((w) => w.id)).length === 0) id = 'ordregn'
    return { pool, def: GAMES.find((g) => g.id === id) ?? GAMES[0] }
  })
  return <GameSession def={init.def} words={init.pool.words} onClose={(played) => onDone({ played })} />
}

/** Tab screen listing the games; launches them full-screen itself. */
export function GamesHub() {
  const progress = useProgress()
  const reduced = useGamesReducedMotion()
  const knownIds = progress.knownWordIds()
  const knownKey = knownIds.join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => buildWordPool(knownIds, course), [knownKey])
  const canBuild = useMemo(() => sentencesFor(pool.words.map((w) => w.id)).length > 0, [pool])
  const [records, setRecords] = useState<Records>(() => loadRecords())
  const [active, setActive] = useState<{ def: GameDef; words: Word[] } | null>(null)

  const open = (def: GameDef) => {
    playSfx('tap')
    setActive({ def, words: pool.words })
  }

  if (active) {
    return <GameSession def={active.def} words={active.words} onRecords={setRecords} onClose={() => setActive(null)} />
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
        {HUB_GAMES.map((g, i) => {
          const rec = records[g.id]
          const Art = GAME_ART[g.id]
          const disabled = !!g.needsSentences && !canBuild
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
