// OWNER: Games agent. Restaurangrusch — you are the chef in Pānpan's kitchen: customers order in Chinese, build the tray.
// Game state that changes every frame (patience) lives in refs / direct DOM writes; React state only changes on events.
import { useEffect, useMemo, useRef, useState } from 'react'
import { celebrate, haptic, replay } from '../../motion'
import { hasChineseVoice, PinyinText, playSfx, speak, stopSpeaking } from '../../speech'
import { AudioSequencer, browserAudioDeps } from '../logic/audioQueue'
import { NO_SPICY, NO_SPICY_ID, resolveMenu, type MenuItem } from '../logic/menu'
import {
  counterFor, CUSTOMERS, finalBonus, generateOrder, levelFor, patienceMood, patienceMs, pinyinVisible, STARS, tipFor, trayKey, trayMatches, type Order,
} from '../logic/restaurant'
import { AnswerTracker, wordRef } from '../logic/session'
import { floatText, GameFrame, ScorePill, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'

type Phase = 'intro' | 'countdown' | 'order' | 'leaving' | 'over'
type Mood = 'happy' | 'ok' | 'angry' | 'sad' | 'glad'

const COUNTDOWN_S = 3
const MAX_TRAY = 4
const LEAVE_MS = 1500
const LEAVE_WRONG_MS = 2600

const SKINS = ['#f6d3b3', '#e8b98f', '#c98f66', '#8d5a3b']
const HAIRS = ['#2b2118', '#5a3a22', '#b5651d', '#1f2937', '#9ca3af']
const SHIRTS = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#6366f1']

/** Simple original customer: round head, hair, shirt; the mouth and brows follow the mood. */
function Customer({ n, mood }: { n: number; mood: Mood }) {
  const skin = SKINS[n % SKINS.length]
  const hair = HAIRS[(n * 2 + 1) % HAIRS.length]
  const shirt = SHIRTS[n % SHIRTS.length]
  const mouth =
    mood === 'glad' ? 'M22 40 Q30 50 38 40 Z' : mood === 'happy' ? 'M23 40 Q30 46 37 40' : mood === 'ok' ? 'M24 42 L36 42' : 'M23 44 Q30 38 37 44'
  const brows = mood === 'angry' || mood === 'sad'
  return (
    <svg viewBox="0 0 60 70" className="h-full w-full" aria-hidden="true">
      <path d="M8 70 Q8 50 30 50 Q52 50 52 70 Z" fill={shirt} />
      <rect x="26" y="44" width="8" height="8" fill={skin} />
      <circle cx="30" cy="28" r="18" fill={skin} />
      {n % 3 === 0
        ? <path d="M11 26 Q12 8 30 8 Q48 8 49 26 Q40 16 30 17 Q20 16 11 26 Z" fill={hair} />
        : n % 3 === 1
          ? <><path d="M11 28 Q10 8 30 8 Q50 8 49 28 Q44 15 30 15 Q16 15 11 28 Z" fill={hair} /><circle cx="30" cy="6" r="5" fill={hair} /></>
          : <path d="M12 30 Q8 8 30 8 Q52 8 48 30 L46 20 Q30 12 14 20 Z" fill={hair} />}
      <circle cx="23" cy="28" r="2.3" fill="#1f2937" />
      <circle cx="37" cy="28" r="2.3" fill="#1f2937" />
      {brows && <><path d={mood === 'angry' ? 'M19 22 L27 25' : 'M19 25 L27 22'} stroke="#1f2937" strokeWidth="2" strokeLinecap="round" /><path d={mood === 'angry' ? 'M41 22 L33 25' : 'M41 25 L33 22'} stroke="#1f2937" strokeWidth="2" strokeLinecap="round" /></>}
      <path d={mouth} stroke="#7f1d1d" strokeWidth="2.2" fill={mood === 'glad' ? '#fff' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
      {mood === 'sad' && <path d="M45 30 Q47 34 45 36 Q43 34 45 30 Z" fill="#60a5fa" />}
    </svg>
  )
}

interface Live {
  phase: Phase
  t: number
  index: number
  stars: number
  score: number
  streak: number
  bestStreak: number
  served: number
  tips: number
  patienceTotal: number
  patienceLeft: number
  playMs: number
  countShown: number
  lastKey: string | undefined
}

export function Restaurangrusch({ words, extra, weights, reduced, toneColors, onEnd, onExit }: GameProps) {
  const [paused, setPaused] = usePause()
  const [finished, setFinished] = useState(false)
  const menu = useMemo<MenuItem[]>(() => resolveMenu(new Map([...extra, ...words].map((w) => [w.id, w]))), [extra, words])
  const byId = useMemo(() => new Map([...menu, NO_SPICY].map((m) => [m.id, m])), [menu])

  const tracker = useRef(new AnswerTracker())
  const asked = useRef(new Map<string, MenuItem>())
  const seq = useRef<AudioSequencer>(null as unknown as AudioSequencer)
  if (!seq.current) seq.current = new AudioSequencer(browserAudioDeps((t) => speak(t), () => stopSpeaking(), () => hasChineseVoice()), { silentMs: 1200 })
  const done = useRef(false)
  const live = useRef<Live>({
    phase: 'intro', t: COUNTDOWN_S, index: 0, stars: STARS, score: 0, streak: 0, bestStreak: 0, served: 0, tips: 0,
    patienceTotal: 1, patienceLeft: 1, playMs: 0, countShown: 0, lastKey: undefined,
  })

  const [phase, setPhase] = useState<Phase>('intro')
  const [count, setCount] = useState<number | null>(null)
  const [hud, setHud] = useState({ score: 0, stars: STARS, n: 0 })
  const [order, setOrder] = useState<Order | null>(null)
  const [cards, setCards] = useState<MenuItem[]>([])
  const [tray, setTray] = useState<string[]>([])
  const [tapped, setTapped] = useState(false)
  const [mood, setMood] = useState<Mood>('happy')
  const [reveal, setReveal] = useState<{ ok: boolean; text: string; tip?: number } | null>(null)
  const [key, setKey] = useState(0)

  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const custRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused })
  const trayRef = useRef(tray)
  useEffect(() => { trayRef.current = tray })
  const orderRef = useRef<Order | null>(null)
  const moodRef = useRef<Mood>('happy')

  useEffect(() => {
    const s = seq.current
    return () => { s.cancel(); stopSpeaking() }
  }, [])
  useEffect(() => { if (paused) seq.current.cancel() }, [paused])

  const go = (p: Phase) => { live.current.phase = p; setPhase(p) }
  const setMoodBoth = (m: Mood) => { moodRef.current = m; setMood(m) }

  const finish = (completed: boolean) => {
    if (done.current) return
    done.current = true
    go('over')
    setFinished(true)
    seq.current.cancel()
    const L = live.current
    const bonus = finalBonus(L.stars, completed)
    const practised: Practised[] = [...asked.current.values()].flatMap((m) => {
      const r = tracker.current.firstResult(wordRef(m.wordId!))
      return r === undefined ? [] : [{ key: m.wordId!, hanzi: m.hanzi, pinyin: m.pinyin, sv: m.sv, correct: r }]
    })
    onEnd({
      score: L.score + bonus,
      result: tracker.current.result(L.playMs),
      practised,
      practisedLabel: 'Övade rätter och drycker',
      headline: completed ? `Skiftet är slut!${bonus ? ` +${bonus} stjärnbonus` : ''}` : `Kunderna gick hem hungriga (${L.served}/${CUSTOMERS})`,
      stats: [
        { label: 'Serverade', value: `${L.served}/${CUSTOMERS}` },
        { label: 'Dricks', value: String(L.tips) },
        { label: 'Bästa svit', value: String(L.bestStreak) },
      ],
    })
  }

  const nextCustomer = (index: number) => {
    const L = live.current
    const o = generateOrder(menu, index, Math.random, weights, L.lastKey)
    L.lastKey = trayKey(o.tray)
    L.index = index
    L.patienceTotal = patienceMs(o.level, o.tray.length)
    L.patienceLeft = L.patienceTotal
    orderRef.current = o
    setOrder(o)
    setCards(counterFor(o, menu))
    setTray([])
    setTapped(false)
    setReveal(null)
    setMoodBoth('happy')
    setKey((k) => k + 1)
    setHud((h) => ({ ...h, n: index + 1 }))
    if (barRef.current) { barRef.current.style.transform = 'scaleX(1)'; barRef.current.dataset.mood = 'happy' }
    for (const id of o.tray) { const m = byId.get(id); if (m?.wordId) asked.current.set(m.wordId, m) }
    go('order')
    void seq.current.replay(o.hanzi)
  }

  const resolve = (ok: boolean, timeout: boolean) => {
    const L = live.current
    const o = orderRef.current
    if (!o || L.phase !== 'order') return
    for (const id of new Set(o.tray)) { const m = byId.get(id); if (m?.wordId) tracker.current.record(wordRef(m.wordId), ok) }
    const rect = custRef.current?.getBoundingClientRect()
    const layer = layerRef.current?.getBoundingClientRect()
    if (ok) {
      const tip = tipFor(o.level, L.patienceLeft / L.patienceTotal, L.streak)
      L.streak += 1
      L.bestStreak = Math.max(L.bestStreak, L.streak)
      L.score += tip
      L.tips += tip
      L.served += 1
      playSfx('correct')
      haptic('success')
      setMoodBoth('glad')
      setReveal({ ok: true, text: 'Tack så mycket!', tip })
      setHud((h) => ({ ...h, score: L.score }))
      if (rect) celebrate('burst', { origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 }, intensity: 0.8 })
      if (rect && layer) floatText(layerRef.current, rect.left - layer.left + rect.width / 2, rect.top - layer.top + 20, `+${tip} 🪙`, '#ca8a04')
      L.t = LEAVE_MS / 1000
    } else {
      L.streak = 0
      L.stars -= 1
      playSfx('wrong')
      haptic('error')
      setMoodBoth('sad')
      setReveal({ ok: false, text: `${timeout ? 'För långsamt! ' : ''}Han ville ha: ${o.sv.replace(/^Jag vill ha |^Snälla, ge mig /, '')}` })
      setHud((h) => ({ ...h, stars: L.stars }))
      if (stageRef.current && !reduced) replay(stageRef.current, 'shake')
      L.t = LEAVE_WRONG_MS / 1000
      void seq.current.replay(o.hanzi)
    }
    go('leaving')
  }

  useGameLoop(paused || finished || phase === 'intro', (dt) => {
    const L = live.current
    const s = dt / 1000
    L.playMs += dt
    if (L.phase === 'countdown') {
      L.t -= s
      const n = Math.max(0, Math.ceil(L.t))
      if (n !== L.countShown) { L.countShown = n; setCount(n > 0 ? n : null) }
      if (L.t <= 0) nextCustomer(0)
    } else if (L.phase === 'order') {
      L.patienceLeft = Math.max(0, L.patienceLeft - dt)
      const frac = L.patienceLeft / L.patienceTotal
      const bar = barRef.current
      if (bar) {
        bar.style.transform = `scaleX(${frac})`
        const m = patienceMood(frac)
        if (bar.dataset.mood !== m) bar.dataset.mood = m
      }
      const m = patienceMood(frac)
      if (m !== moodRef.current && moodRef.current !== 'glad') setMoodBoth(m)
      if (L.patienceLeft <= 0) resolve(false, true)
    } else if (L.phase === 'leaving') {
      L.t -= s
      if (L.t <= 0) {
        if (L.stars <= 0) finish(false)
        else if (L.index + 1 >= CUSTOMERS) finish(true)
        else nextCustomer(L.index + 1)
      }
    }
  })

  const addCard = (m: MenuItem) => {
    if (live.current.phase !== 'order' || pausedRef.current) return
    if (trayRef.current.length >= MAX_TRAY) { haptic('warning'); return }
    playSfx('tap')
    haptic('select')
    setTray((t) => [...t, m.id])
  }
  const removeAt = (i: number) => {
    if (live.current.phase !== 'order' || pausedRef.current) return
    playSfx('tap')
    setTray((t) => t.filter((_, j) => j !== i))
  }
  const serve = () => {
    const o = orderRef.current
    if (!o || live.current.phase !== 'order' || pausedRef.current || trayRef.current.length === 0) return
    resolve(trayMatches(o, trayRef.current), false)
  }
  const listen = () => {
    if (live.current.phase !== 'order' || !orderRef.current) return
    setTapped(true)
    haptic('light')
    void seq.current.replay(orderRef.current.hanzi)
  }
  const start = () => {
    playSfx('tap')
    live.current.t = COUNTDOWN_S
    live.current.countShown = COUNTDOWN_S
    setCount(COUNTDOWN_S)
    go('countdown')
  }

  const showPinyin = order ? pinyinVisible(order.level, tapped) : false
  const level = order?.level ?? levelFor(0)
  const active = phase === 'order'

  const hudNode = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-0.5 text-2xl leading-none" aria-label={`${hud.stars} stjärnor kvar`}>
        {Array.from({ length: STARS }, (_, i) => <span key={i} className={i < hud.stars ? '' : 'opacity-25 grayscale'}>⭐</span>)}
      </div>
      <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-black text-ink-muted tabular-nums" data-testid="rr-count">{Math.max(1, hud.n)}/{CUSTOMERS}</span>
      <ScorePill score={hud.score} label="Dricks" />
    </div>
  )

  return (
    <GameFrame title="Restaurangrusch" paused={paused} setPaused={setPaused} reduced={reduced} hud={hudNode}
      onExit={() => { seq.current.cancel(); stopSpeaking(); onExit(tracker.current.answered ? tracker.current.result(live.current.playMs) : null) }}>
      <div ref={stageRef} className="relative flex h-full flex-col overflow-hidden bg-amber-50">
        {/* Customer + patience */}
        <div className="px-3 pt-1">
          <div className="h-3 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label="Tålamod">
            <div ref={barRef} data-mood="happy" data-testid="rr-patience"
              className="h-full origin-left rounded-full bg-emerald-500 data-[mood=ok]:bg-amber-400 data-[mood=angry]:bg-rose-500" style={{ transform: 'scaleX(1)' }} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-end gap-2 px-3 pt-2">
          <div ref={custRef} key={`c${key}`} className={`h-28 w-24 shrink-0 ${reduced ? '' : 'g-in'}`} data-testid="rr-customer">
            {order && <Customer n={key} mood={mood} />}
          </div>
          <div key={`b${key}`} className={`relative mb-6 min-w-0 flex-1 rounded-2xl rounded-bl-sm border-2 border-line bg-white px-3 py-2 shadow ${reduced ? '' : 'g-pop'}`} data-testid="rr-bubble">
            {order ? (
              <>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-2xl leading-tight font-black" lang="zh-CN">{order.hanzi}</div>
                    {showPinyin
                      ? <PinyinText pinyin={order.pinyin} colored={toneColors} className="text-base font-bold text-ink-muted" />
                      : <div className="text-sm font-bold text-ink-muted">Lyssna och tryck 🔊 för pinyin</div>}
                  </div>
                  <button type="button" aria-label="Lyssna igen" data-testid="rr-listen" onClick={listen} disabled={!active}
                    className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-2xl active:scale-95">🔊</button>
                </div>
                {reveal && (
                  <div className={`mt-2 rounded-xl px-2 py-1 text-sm font-black ${reveal.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`} data-testid="rr-reveal">
                    {reveal.text}{reveal.tip ? ` +${reveal.tip} 🪙` : ''}
                  </div>
                )}
              </>
            ) : <div className="text-ink-muted">…</div>}
          </div>
        </div>

        {/* Counter */}
        <div className="rounded-t-3xl border-t-4 border-amber-700 bg-amber-200 px-3 pt-3 pb-3">
          <div className="mb-2 flex min-h-[3.25rem] items-center gap-2 rounded-2xl bg-white/70 px-2 py-1" data-testid="rr-tray" aria-label="Bricka">
            <span className="text-xl" aria-hidden="true">🍽️</span>
            {tray.length === 0 && <span className="text-sm font-bold text-ink-muted">Tryck på rätterna du vill servera</span>}
            {tray.map((id, i) => {
              const m = byId.get(id)!
              return (
                <button key={`${id}${i}`} type="button" onClick={() => removeAt(i)} aria-label={`Ta bort ${m.sv}`}
                  className={`press rounded-xl bg-white px-2 py-1 text-2xl shadow ${reduced ? '' : 'g-pop'}`}>{m.emoji}</button>
              )
            })}
            <button type="button" onClick={serve} disabled={!active || tray.length === 0} data-testid="rr-serve"
              className="press ml-auto rounded-2xl border-b-4 border-brand-dark bg-brand px-4 py-2 font-black text-white disabled:opacity-40 active:translate-y-0.5 active:border-b-2">
              Servera
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="rr-grid" style={{ gridTemplateColumns: level >= 3 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))' }}>
            {cards.map((m) => (
              <button key={m.id} type="button" onClick={() => addCard(m)} disabled={!active} data-testid={`rr-card-${m.id}`}
                className="press flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 border-b-4 border-amber-300 bg-white px-1 py-1 text-center active:translate-y-0.5 active:border-b-2">
                <span className="text-3xl leading-none">{m.emoji}</span>
                <span className="mt-0.5 text-[11px] leading-tight font-extrabold">{m.id === NO_SPICY_ID ? 'Inte stark' : m.sv}</span>
                {showPinyin && <PinyinText pinyin={m.pinyin} colored={toneColors} className="text-[10px] leading-tight font-bold text-ink-muted" />}
              </button>
            ))}
          </div>
        </div>

        <div ref={layerRef} className="pointer-events-none absolute inset-0" />

        {phase === 'intro' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-5" data-testid="rr-intro">
            <div className="g-pop w-full rounded-3xl bg-surface p-5 text-center shadow-2xl">
              <div className="text-5xl">👨‍🍳</div>
              <div className="mt-1 text-2xl font-black">Restaurangrusch</div>
              <ol className="mt-3 space-y-1.5 text-left text-base font-bold">
                <li>1. En kund beställer på kinesiska. Lyssna och läs.</li>
                <li>2. Tryck på rätterna för att bygga brickan (tryck på en rätt på brickan för att ta bort den).</li>
                <li>3. Tryck <b>Servera</b> innan tålamodet tar slut.</li>
                <li>4. Fel eller för långsam = en ⭐ mindre. Klara {CUSTOMERS} kunder!</li>
              </ol>
              <button type="button" onClick={start} data-testid="rr-start"
                className="press mt-4 w-full rounded-2xl border-b-4 border-brand-dark bg-brand py-3.5 text-lg font-black text-white active:translate-y-0.5 active:border-b-2">
                Öppna köket
              </button>
            </div>
          </div>
        )}
        {count !== null && phase === 'countdown' && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span key={count} className="g-pop text-8xl font-black text-ink drop-shadow-[0_4px_0_rgba(255,255,255,.7)]" data-testid="rr-countdown">{count}</span>
          </div>
        )}
      </div>
    </GameFrame>
  )
}
