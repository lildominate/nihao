// OWNER: Games agent. Restaurangrusch — you are the chef in Pānpan's kitchen: customers order in Chinese, build the tray.
// Game state that changes every frame (patience) lives in refs / direct DOM writes; React state only changes on events.
import { useProgress } from '../../progress'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { celebrate, CountUp, flyTo, haptic, replay } from '../../motion'
import type { PandaMood } from '../../mascot/Panda'
import { hasChineseVoice, PinyinText, playSfx, speak, stopSpeaking } from '../../speech'
import { AudioSequencer, browserAudioDeps } from '../logic/audioQueue'
import { NO_SPICY, NO_SPICY_ID, resolveMenu, type MenuItem } from '../logic/menu'
import {
  counterFor, CUSTOMERS, finalBonus, generateOrder, levelFor, patienceMood, patienceMs, pinyinVisible, speciesFor, STARS, tipFor, trayKey, trayMatches, type Order, type Species,
} from '../logic/restaurant'
import { AnswerTracker, wordRef } from '../logic/session'
import { floatText, GameFrame, useGameLoop, usePause, type GameProps, type Practised } from '../ui/kit'
import { Chef, Critter, DishPlate, KitchenBackdrop, LunchClock, Stamp, StormCloud, Stove, type CritterMood } from '../ui/restaurantScene'

type Phase = 'intro' | 'countdown' | 'order' | 'leaving' | 'over'
type Mood = CritterMood

const COUNTDOWN_S = 3
const MAX_TRAY = 4
const LEAVE_MS = 1100
const LEAVE_WRONG_MS = 1900
/** Exit animation delay (s): happy guests leave quickly, grumpy ones stand there a moment with the stamp. */
const EXIT_DELAY = 0.45
const EXIT_DELAY_WRONG = 1.15

interface Guest { id: number; sp: Species; mood: Mood; exit?: number; stamp?: 'ok' | 'no' }

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
  const showHanzi = useProgress().state.settings.showHanzi
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
  const [hud, setHud] = useState({ score: 0, stars: STARS, n: 0, done: 0 })
  const [order, setOrder] = useState<Order | null>(null)
  const [cards, setCards] = useState<MenuItem[]>([])
  const [tray, setTray] = useState<string[]>([])
  const [tapped, setTapped] = useState(false)
  const [crowd, setCrowd] = useState<Guest[]>([])
  const [chefMood, setChefMood] = useState<PandaMood>('happy')
  const [reveal, setReveal] = useState<{ ok: boolean; text: string; tip?: number } | null>(null)
  const [key, setKey] = useState(0)

  const stageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const custRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const steamRef = useRef<HTMLDivElement>(null)
  const cookRef = useRef<HTMLDivElement>(null)
  const serveRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused })
  const trayIdsRef = useRef(tray)
  useEffect(() => { trayIdsRef.current = tray })
  const orderRef = useRef<Order | null>(null)
  const moodRef = useRef<Mood>('happy')
  const guestId = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const s = seq.current
    const tm = timers.current
    return () => { s.cancel(); stopSpeaking(); tm.forEach((t) => clearTimeout(t)) }
  }, [])
  useEffect(() => { if (paused) seq.current.cancel() }, [paused])

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const go = (p: Phase) => { live.current.phase = p; setPhase(p) }
  const patchGuest = (id: number, patch: Partial<Guest>) => setCrowd((c) => c.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const setMoodBoth = (m: Mood) => { moodRef.current = m; patchGuest(guestId.current, { mood: m }) }

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
    const id = ++guestId.current
    moodRef.current = 'happy'
    // The previous guest keeps walking out (same element, same animation) while the new one walks in.
    setCrowd((c) => [...c, { id, sp: speciesFor(index), mood: 'happy' }])
    later(() => setCrowd((c) => c.filter((g) => g.id === guestId.current)), 1700)
    setOrder(o)
    setCards(counterFor(o, menu))
    setTray([])
    trayRef.current?.classList.remove('rs-slide')
    setTapped(false)
    setReveal(null)
    setChefMood('happy')
    setKey((k) => k + 1)
    setHud((h) => ({ ...h, n: index + 1 }))
    if (barRef.current) { barRef.current.style.transform = 'scaleX(1)'; barRef.current.dataset.mood = 'happy' }
    for (const tid of o.tray) { const m = byId.get(tid); if (m?.wordId) asked.current.set(m.wordId, m) }
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
    const gid = guestId.current
    if (!reduced) {
      if (serveRef.current) replay(serveRef.current, 'rs-serve')
      if (trayRef.current) replay(trayRef.current, 'rs-slide')
    }
    if (ok) {
      const tip = tipFor(o.level, L.patienceLeft / L.patienceTotal, L.streak)
      L.streak += 1
      L.bestStreak = Math.max(L.bestStreak, L.streak)
      L.score += tip
      L.tips += tip
      L.served += 1
      moodRef.current = 'glad'
      patchGuest(gid, { mood: 'glad', exit: EXIT_DELAY, stamp: 'ok' })
      setChefMood('cheer')
      playSfx('correct')
      haptic('success')
      setReveal({ ok: true, text: 'Tack så mycket!', tip })
      const total = L.score
      setHud((h) => ({ ...h, done: h.done + 1 }))
      if (rect) celebrate('burst', { origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 }, intensity: 0.8 })
      if (rect && layer) {
        floatText(layerRef.current, rect.left - layer.left + rect.width / 2, rect.top - layer.top + 34, `+${tip} 🪙`, '#ca8a04')
        floatText(layerRef.current, rect.left - layer.left + rect.width / 2 - 30, rect.top - layer.top + 60, '❤️', '#e11d48')
      }
      void flyTo(custRef.current, tipRef.current, '🪙', { count: 3, durationMs: 620, onArrive: (i) => { if (i === 2) setHud((h) => ({ ...h, score: total })) } })
      L.t = LEAVE_MS / 1000
    } else {
      L.streak = 0
      L.stars -= 1
      moodRef.current = 'sad'
      patchGuest(gid, { mood: 'sad', exit: EXIT_DELAY_WRONG, stamp: 'no' })
      setChefMood('sad')
      playSfx('wrong')
      haptic('error')
      setReveal({ ok: false, text: `${timeout ? 'För långsamt! ' : ''}Han ville ha: ${o.sv.replace(/^Jag vill ha |^Snälla, ge mig /, '')}` })
      setHud((h) => ({ ...h, stars: L.stars, done: h.done + 1 }))
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
      const m = patienceMood(frac)
      if (bar) {
        bar.style.transform = `scaleX(${frac})`
        if (bar.dataset.mood !== m) bar.dataset.mood = m
      }
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

  /** Arc a copy of the dish from its card into the tray (transform + opacity only). */
  const flyDish = (from: Element | null, emoji: string) => {
    const layer = layerRef.current
    const to = trayRef.current
    if (reduced || !layer || !from || !to || typeof layer.animate !== 'function') return
    const lr = layer.getBoundingClientRect()
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const ax = a.left - lr.left + a.width / 2 - 18
    const ay = a.top - lr.top + a.height / 2 - 18
    const bx = b.left - lr.left + b.width / 2 - 18
    const by = b.top - lr.top + b.height / 2 - 18
    const el = document.createElement('span')
    el.textContent = emoji
    el.style.cssText = 'position:absolute;left:0;top:0;width:36px;height:36px;font-size:32px;line-height:36px;text-align:center;will-change:transform,opacity;pointer-events:none'
    layer.appendChild(el)
    const my = Math.min(ay, by) - 70
    const mx = (ax + bx) / 2
    const anim = el.animate([
      { transform: `translate(${ax}px,${ay}px) scale(1)`, opacity: 1 },
      { transform: `translate(${mx}px,${my}px) scale(1.3) rotate(-12deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${bx}px,${by}px) scale(.7)`, opacity: 0.9 },
    ], { duration: 420, easing: 'cubic-bezier(.4,.1,.5,1)' })
    anim.onfinish = () => el.remove()
  }
  const cookFx = () => {
    if (reduced) return
    replay(cookRef.current, 'rs-cook')
    const st = steamRef.current
    if (st) { replay(st, 'rs-hot'); later(() => st.classList.remove('rs-hot'), 1100) }
  }

  const addCard = (m: MenuItem, el: Element | null) => {
    if (live.current.phase !== 'order' || pausedRef.current) return
    if (trayIdsRef.current.length >= MAX_TRAY) { haptic('warning'); return }
    playSfx('tap')
    haptic('select')
    flyDish(el, m.emoji)
    cookFx()
    setTray((t) => [...t, m.id])
  }
  const removeAt = (i: number) => {
    if (live.current.phase !== 'order' || pausedRef.current) return
    playSfx('tap')
    setTray((t) => t.filter((_, j) => j !== i))
  }
  const serve = () => {
    const o = orderRef.current
    if (!o || live.current.phase !== 'order' || pausedRef.current || trayIdsRef.current.length === 0) return
    resolve(trayMatches(o, trayIdsRef.current), false)
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
      <div className="flex items-center gap-0.5 text-xl leading-none" aria-label={`${hud.stars} stjärnor kvar`}>
        {Array.from({ length: STARS }, (_, i) => <span key={i} className={i < hud.stars ? '' : 'opacity-25 grayscale'}>⭐</span>)}
      </div>
      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-sm font-black text-ink-muted tabular-nums" data-testid="rr-count">{Math.max(1, hud.n)}/{CUSTOMERS}</span>
      <LunchClock done={hud.done} reduced={reduced} />
      <div className="flex items-center gap-1" aria-label="Dricks">
        <span ref={tipRef} className="text-lg leading-none">🪙</span>
        <CountUp value={hud.score} className="text-xl font-black tabular-nums" />
      </div>
    </div>
  )

  return (
    <GameFrame title="Restaurangrusch" paused={paused} setPaused={setPaused} reduced={reduced} hud={hudNode} bg="bg-canvas"
      onExit={() => { seq.current.cancel(); stopSpeaking(); onExit(tracker.current.answered ? tracker.current.result(live.current.playMs) : null) }}>
      <div ref={stageRef} className="relative flex h-full flex-col overflow-hidden">
        {/* Kitchen scene */}
        <div className="relative min-h-[300px] flex-1 overflow-hidden">
          <KitchenBackdrop />
          <Stove steamRef={steamRef} />
          <Chef mood={chefMood} serveRef={serveRef} cookRef={cookRef} />

          {/* Tray on the counter */}
          <div ref={trayRef} className="absolute bottom-[86px] left-[58px] z-[11] h-[58px] w-[172px]" data-testid="rr-tray" aria-label="Bricka">
            <svg viewBox="0 0 172 58" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <ellipse cx="86" cy="49" rx="84" ry="9" fill="#000" opacity=".14" />
              <path d="M6 42 Q86 56 166 42 L160 50 Q86 60 12 50 Z" fill="var(--color-ink-muted)" />
              <ellipse cx="86" cy="42" rx="80" ry="8" fill="var(--color-ink-faint)" stroke="var(--color-ink-muted)" strokeWidth="2" />
            </svg>
            <div className="absolute inset-x-0 bottom-3 flex items-end justify-center gap-0.5">
              {tray.map((id, i) => {
                const m = byId.get(id)!
                return (
                  <button key={`${id}${i}`} type="button" onClick={() => removeAt(i)} aria-label={`Ta bort ${m.sv}`}
                    className="rs-land press flex h-11 w-10 items-center justify-center text-[30px] leading-none drop-shadow">{m.emoji}</button>
                )
              })}
            </div>
          </div>

          {/* Guests */}
          {crowd.map((g) => {
            const cur = g.id === guestId.current
            return (
              <div key={g.id} ref={cur ? custRef : undefined} data-testid={cur ? 'rr-customer' : undefined}
                className={`rs-actor ${g.exit !== undefined ? 'rs-out' : 'rs-enter'}`} style={{ '--rs-d': `${g.exit ?? 0}s` } as CSSProperties}>
                <div role="progressbar" aria-label="Tålamod" className="rs-bar absolute top-0 left-1/2 h-2.5 w-14 -translate-x-1/2 overflow-hidden rounded-full border-2 border-white bg-black/30 shadow">
                  <div ref={cur ? barRef : undefined} data-mood="happy" data-testid={cur ? 'rr-patience' : undefined}
                    className="h-full w-full origin-left rounded-full bg-brand data-[mood=ok]:bg-warn data-[mood=angry]:bg-danger" />
                </div>
                <div className={`rs-body absolute inset-x-0 top-4 bottom-0 ${g.exit !== undefined ? 'rs-walkout' : 'rs-walkin'} ${g.mood === 'angry' ? 'rs-angry' : ''}`}>
                  <div className="rs-flip h-full w-full"><Critter sp={g.sp} mood={g.mood} /></div>
                  {g.stamp && <Stamp ok={g.stamp === 'ok'} />}
                  {g.stamp === 'no' && <StormCloud />}
                </div>
              </div>
            )
          })}

          {/* Speech bubble */}
          {order && (
            <div key={`b${key}`} className={`absolute top-2 right-2 z-[16] w-[262px] rounded-2xl border-2 border-line-dark bg-surface px-3 py-2 shadow-lg ${reduced ? '' : 'rs-bubble'}`} data-testid="rr-bubble">
              <span className="absolute -bottom-[9px] right-[46px] h-4 w-4 rotate-45 border-r-2 border-b-2 border-line-dark bg-surface" aria-hidden="true" />
              <div className="relative flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {/* The learner studies pinyin, not characters: pinyin is the big line; hanzi only with "Visa tecken". */}
                  {showPinyin
                    ? <PinyinText pinyin={order.pinyin} colored={toneColors} className="text-xl leading-tight font-black" />
                    : <div className="text-base font-black text-ink-muted">Tryck 🔊 och lyssna</div>}
                  {showHanzi && <div className="text-xs font-bold text-ink-muted" lang="zh-CN">{order.hanzi}</div>}
                </div>
                <button type="button" aria-label="Lyssna igen" data-testid="rr-listen" onClick={listen} disabled={!active}
                  className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-soft text-2xl active:scale-95">🔊</button>
              </div>
            </div>
          )}

          {/* Result caption on the counter front */}
          {reveal && (
            <div key={`r${key}`} className={`absolute bottom-[30px] left-2 z-[18] max-w-[240px] rounded-xl px-3 py-1.5 text-sm font-black shadow-lg ${reveal.ok ? 'bg-brand-soft text-brand-dark' : 'bg-danger-soft text-danger-dark'} ${reduced ? '' : 'g-pop'}`} data-testid="rr-reveal">
              {reveal.text}{reveal.tip ? ` +${reveal.tip} 🪙` : ''}
            </div>
          )}
        </div>

        {/* Dish shelf */}
        <div className="border-t-4 border-warn-dark bg-surface-3 px-2 pt-2">
          <div className="grid gap-1.5" data-testid="rr-grid" style={{ gridTemplateColumns: level >= 3 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))' }}>
            {cards.map((m) => (
              <button key={m.id} type="button" disabled={!active} data-testid={`rr-card-${m.id}`} data-dish={m.id}
                onClick={(e) => addCard(m, e.currentTarget.querySelector('[data-emoji]'))}
                className="press flex min-h-[84px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-b-4 border-line-dark bg-surface px-0.5 py-1 text-center active:translate-y-0.5 active:border-b-2 disabled:opacity-70">
                <DishPlate emoji={m.emoji}>
                  <span className="text-[11px] leading-tight font-extrabold">{m.id === NO_SPICY_ID ? 'Inte stark' : m.sv}</span>
                  {showPinyin && <PinyinText pinyin={m.pinyin} colored={toneColors} className="text-[10px] leading-tight font-bold text-ink-muted" />}
                </DishPlate>
              </button>
            ))}
          </div>
          <button type="button" onClick={serve} disabled={!active || tray.length === 0} data-testid="rr-serve"
            className="press my-2 w-full rounded-2xl border-b-4 border-lacquer-dark bg-lacquer py-3.5 text-xl font-black text-on-color disabled:opacity-40 active:translate-y-0.5 active:border-b-2">
            Servera!
          </button>
        </div>

        <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20" />

        {phase === 'intro' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-5" data-testid="rr-intro">
            <div className="g-pop w-full rounded-3xl bg-surface p-5 text-center shadow-2xl">
              <div className="text-5xl">👨‍🍳</div>
              <div className="mt-1 text-2xl font-black">Restaurangrusch</div>
              <ol className="mt-3 space-y-1.5 text-left text-base font-bold">
                <li>1. En kund kommer in och beställer på kinesiska. Lyssna och läs.</li>
                <li>2. Tryck på rätterna så flyger de till brickan (tryck på en rätt på brickan för att ta bort den).</li>
                <li>3. Tryck <b>Servera!</b> innan tålamodet tar slut.</li>
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
