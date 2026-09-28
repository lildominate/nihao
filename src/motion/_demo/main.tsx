// OWNER: Motion agent. Demo/playground for src/motion (dev only): /src/motion/_demo/index.html
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { Panda } from '../../mascot/Panda'
import {
  celebrate, haptic, CountUp, Transition, Splash, CelebrationOverlay, Skeleton, Pressable, flyTo, replay,
  setAppReducedMotion, useReducedMotion, type CelebrateKind,
} from '..'

const btn = 'rounded-2xl border-2 border-b-4 border-line bg-surface px-3 py-2 text-sm font-extrabold'
const primary = 'rounded-2xl border-2 border-b-4 border-brand-dark bg-brand px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-line p-4">
      <h2 className="mb-3 text-xs font-black tracking-wider text-ink-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Demo() {
  const reduced = useReducedMotion()
  const [appReduce, setAppReduce] = useState(false)
  const [splash, setSplash] = useState<null | { message?: string }>(null)
  const [overlay, setOverlay] = useState(false)
  const [xp, setXp] = useState(120)
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<'slide' | 'fade' | 'pop' | 'up'>('slide')
  const [staggerKey, setStaggerKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState('')
  const xpRef = useRef<HTMLSpanElement>(null)
  const wrongRef = useRef<HTMLButtonElement>(null)
  const rightRef = useRef<HTMLButtonElement>(null)

  const fire = (k: CelebrateKind, e?: React.MouseEvent<HTMLElement>) => celebrate(k, e ? { from: e.currentTarget } : undefined)

  return (
    <div className="mx-auto min-h-dvh max-w-md space-y-4 bg-surface px-4 pt-safe pb-16">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b-2 border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <h1 className="flex-1 text-xl font-black">Motion-demo</h1>
        <span className="flex items-center gap-1 font-black text-gold-dark">
          <span ref={xpRef} className="inline-block">⚡</span><CountUp value={xp} /> XP
        </span>
      </header>

      <Section title="Reducerad rörelse">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={appReduce} onChange={(e) => { setAppReduce(e.target.checked); setAppReducedMotion(e.target.checked) }} />
          settings.reduceMotion (app) — useReducedMotion() = <b>{String(reduced)}</b>
        </label>
      </Section>

      <Section title="celebrate()">
        <div className="grid grid-cols-2 gap-2">
          {(['confetti', 'burst', 'fireworks', 'stars'] as const).map((k) => (
            <button key={k} className={`${btn} press`} onClick={(e) => fire(k, k === 'burst' || k === 'stars' ? e : undefined)}>{k}</button>
          ))}
        </div>
      </Section>

      <Section title="Rätt / fel (pop-in + burst, shake + haptic)">
        <div className="flex gap-2">
          <button ref={rightRef} className={`${primary} press flex-1`} onClick={() => {
            haptic('success'); celebrate('burst', { from: rightRef.current })
            flyTo(rightRef.current, xpRef.current, '+10', { count: 5, onArrive: () => setXp((v) => v + 2) })
            setLog('Rätt! +10 XP'); setStaggerKey((k) => k + 1)
          }}>Rätt svar</button>
          <button ref={wrongRef} className={`${btn} press flex-1 text-danger`} onClick={() => { haptic('error'); replay(wrongRef.current, 'shake'); setLog('Fel – försök igen') }}>Fel svar</button>
        </div>
        {log && <p key={staggerKey + log} className="pop-in mt-3 text-center font-black text-brand">{log}</p>}
      </Section>

      <Section title="<CountUp>">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-black text-brand"><CountUp value={xp} /></span>
          <button className={`${btn} press`} onClick={() => setXp((v) => v + 50)}>+50</button>
          <button className={`${btn} press`} onClick={() => setXp((v) => Math.max(0, v - 30))}>−30</button>
        </div>
      </Section>

      <Section title="<Transition>">
        <div className="mb-3 flex gap-1">
          {(['slide', 'fade', 'pop', 'up'] as const).map((k) => (
            <button key={k} className={`${btn} press ${k === kind ? 'border-brand text-brand' : ''}`} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
        <Transition swapKey={step} kind={kind}>
          <div className="rounded-2xl bg-brand-soft p-4 text-center">
            <p className="text-3xl font-black">{['nǐ hǎo', 'xièxie', 'zàijiàn', 'duìbuqǐ'][step % 4]}</p>
            <p className="text-sm font-bold text-ink-muted">Övning {step + 1}</p>
          </div>
        </Transition>
        <Pressable className={`${primary} mt-3 w-full`} onClick={() => setStep((s) => s + 1)}>Nästa (Pressable)</Pressable>
      </Section>

      <Section title="Utility-klasser">
        <div className="grid grid-cols-3 gap-4 text-center text-xs font-bold">
          <div><div className="float mx-auto w-fit"><Panda mood="happy" size={56} /></div>.float</div>
          <div><div className="bounce-soft mx-auto w-fit rounded-xl bg-brand px-2 py-1 text-white">START</div><div className="mt-2">.bounce-soft</div></div>
          <div><div className="pulse-ring mx-auto h-12 w-12 rounded-full bg-brand" /><div className="mt-2">.pulse-ring</div></div>
          <div><div className="glow mx-auto w-fit text-4xl">🔥</div>.glow</div>
          <div><div className="wiggle mx-auto w-fit text-4xl">🎁</div>.wiggle</div>
          <div><button className={`${btn} press`}>.press</button></div>
        </div>
        <button className={`${btn} press mt-4 w-full`} onClick={() => setStaggerKey((k) => k + 1)}>Spela upp .stagger-children</button>
        <ul key={staggerKey} className="stagger-children mt-3 space-y-2">
          {['Hälsningar', 'Siffror', 'Familj', 'Mat'].map((t) => <li key={t} className="rounded-xl border-2 border-line p-3 font-bold">{t}</li>)}
        </ul>
      </Section>

      <Section title="<Skeleton> / .shimmer">
        {loading ? (
          <div className="flex items-center gap-3">
            <Skeleton width={48} height={48} rounded={999} />
            <Skeleton lines={3} className="flex-1" height={12} />
          </div>
        ) : <p className="fade-in font-bold">Innehållet har laddats.</p>}
        <button className={`${btn} press mt-3`} onClick={() => setLoading((l) => !l)}>Växla</button>
      </Section>

      <Section title="<Splash> / <CelebrationOverlay>">
        <div className="grid grid-cols-2 gap-2">
          <button className={`${btn} press`} onClick={() => setSplash({})}>Splash</button>
          <button className={`${btn} press`} onClick={() => setSplash({ message: 'Laddar dina lektioner…' })}>Splash + text</button>
          <button className={`${primary} press col-span-2`} onClick={() => setOverlay(true)}>Lektion klar!</button>
        </div>
      </Section>

      {splash && <Splash message={splash.message} onDone={() => setSplash(null)} />}
      <CelebrationOverlay open={overlay} title="Lektion klar!" subtitle="Du lärde dig 6 nya fraser" mood="cheer" onClose={() => setOverlay(false)}>
        <div className="rounded-2xl border-2 border-b-4 border-gold bg-surface p-3 font-black text-gold-dark">⚡ +<CountUp value={overlay ? 30 : 0} from={0} /> XP</div>
        <div className="mt-2 rounded-2xl border-2 border-b-4 border-orange-200 bg-orange-50 p-3 font-black text-flame">🔥 5 dagar i rad</div>
      </CelebrationOverlay>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>)
