// First-run welcome: meet Pānpan → tones → daily goal → sound test → level (beginner or placement test).
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Tone } from '../types'
import { useProgress } from '../progress'
import { hasChineseVoice, isIOS, speak } from '../speech'
import { Transition } from '../motion'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressRing'
import { BackIcon, ChatIcon, SparkleIcon, SpeakerIcon, TargetIcon, WaveIcon } from './icons'
import { GOALS, useVoices } from './shared'

const ORD: Record<number, string> = { 1: '1:a', 2: '2:a', 3: '3:e', 4: '4:e' }
const TONES: { tone: Tone; py: string; hanzi: string; sv: string; how: string; path: string }[] = [
  { tone: 1, py: 'mā', hanzi: '妈', sv: 'mamma', how: 'Hög och jämn, som när du sjunger en ton.', path: 'M4 7 H36' },
  { tone: 2, py: 'má', hanzi: '麻', sv: 'hampa', how: 'Stigande, som en förvånad fråga: ”Va?”', path: 'M4 30 L36 6' },
  { tone: 3, py: 'mǎ', hanzi: '马', sv: 'häst', how: 'Låg – går ner och sedan upp igen.', path: 'M4 16 Q20 42 36 10' },
  { tone: 4, py: 'mà', hanzi: '骂', sv: 'skälla', how: 'Skarpt fallande, som ett bestämt ”Nej!”', path: 'M4 6 L36 32' },
]
const GOAL_MOOD = ['sleep', 'happy', 'cheer', 'proud'] as const

export function Welcome({ onDone, onPlacement }: { onDone: () => void; onPlacement?: () => void }) {
  const [step, setStep] = useState(0)
  const steps = 5
  const last = step === steps - 1
  const next = () => (last ? onDone() : setStep(step + 1))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas canvas-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-safe pb-safe">
        <div className="flex h-14 items-center gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="-ml-2 grid h-10 w-10 place-items-center rounded-xl text-ink-faint active:bg-surface-2" aria-label="Tillbaka"><BackIcon size={26} /></button>
          ) : <span className="w-8" />}
          <ProgressBar value={(step + 1) / steps} className="flex-1" label={`Steg ${step + 1} av ${steps}`} />
          <span className="w-8" />
        </div>

        <Transition swapKey={step} kind="slide" className="flex flex-1 flex-col py-4">
          {step === 0 && <Intro />}
          {step === 1 && <Tones />}
          {step === 2 && <Goal />}
          {step === 3 && <SoundTest />}
          {step === 4 && <Level onPlacement={onPlacement} />}
        </Transition>

        <div className="pb-5">
          <Button className="w-full" size="lg" onClick={next}>
            {step === 0 ? 'Kom igång' : last ? 'Jag är nybörjare – börja!' : 'Fortsätt'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Intro() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative">
        <div className="absolute inset-6 rounded-full bg-brand/25 blur-2xl" aria-hidden="true" />
        <div className="absolute -top-2 -left-10 float rounded-2xl rounded-br-sm border border-line bg-surface px-3 py-1.5 font-display text-lg font-semibold shadow-soft">
          <span className="text-tone-3">nǐ</span> <span className="text-tone-3">hǎo</span>!
        </div>
        <Panda mood="wave" size={160} className="relative animate-pop" />
      </div>
      <h1 className="mt-2 font-display text-[32px] leading-tight font-semibold text-brand">Hej! Jag heter Pānpan</h1>
      <p className="mt-1 text-[17px] font-bold">Jag lär dig <i>prata</i> mandarin – med pinyin, utan tecken.</p>
      <ul className="stagger-children mt-5 w-full space-y-2 text-left">
        <Li icon={<ChatIcon size={24} />} tone="bg-sky-soft text-sky" title="Tal och hörsel först">Du lyssnar, härmar och svarar – som i ett riktigt samtal.</Li>
        <Li icon={<WaveIcon size={24} />} tone="bg-plum-soft text-plum" title="Pinyin = kinesiska med vårt alfabet">Du behöver aldrig lära dig skrivtecken.</Li>
        <Li icon={<SparkleIcon size={24} />} tone="bg-lacquer-soft text-lacquer" title="Helt fritt">Ingen reklam, inga hjärtan, inga gränser.</Li>
      </ul>
    </div>
  )
}

function Li({ icon, tone, title, children }: { icon: ReactNode; tone: string; title: string; children: string }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line/80 bg-surface p-3 shadow-card">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <span><b className="block font-extrabold">{title}</b><span className="text-sm font-semibold text-ink-muted">{children}</span></span>
    </li>
  )
}

function Tones() {
  const toneColor = (t: Tone) => `var(--tone-${t})`
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">Fyra toner</h1>
          <p className="mt-1 font-semibold text-ink-muted">
            Samma stavelse betyder olika saker beroende på <b className="text-ink">tonen</b>. Tryck och lyssna!
          </p>
        </div>
        <Panda mood="think" size={84} className="float -mb-1 shrink-0" />
      </div>
      <ul className="stagger-children mt-4 space-y-2.5">
        {TONES.map((t) => (
          <li key={t.tone}>
            <button type="button" onClick={() => void speak(t.hanzi, { slow: true })}
              className="btn-3d flex w-full items-center gap-3 rounded-2xl border border-line/80 p-3 text-left"
              style={{ '--face': 'var(--color-surface)', '--edge': 'var(--color-line-dark)', '--shine': 0 } as CSSProperties}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display text-2xl font-semibold text-white" style={{ background: toneColor(t.tone) }}>{t.py}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-black" style={{ color: toneColor(t.tone) }}>{ORD[t.tone]} tonen · <span className="text-ink">”{t.sv}”</span></span>
                <span className="block text-sm leading-snug font-semibold text-ink-muted">{t.how}</span>
              </span>
              <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0" aria-hidden="true">
                <path d={t.path} fill="none" stroke={toneColor(t.tone)} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm font-semibold text-ink-muted">
        Det finns också en <b className="text-ink">neutral ton</b> – kort och lätt, utan tecken: <b className="text-tone-5">ma</b> (frågeord).
      </p>
    </div>
  )
}

function Goal() {
  const { state, updateSettings } = useProgress()
  const idx = Math.max(0, GOALS.findIndex((g) => g.xp === state.settings.dailyGoalXp))
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">Välj ett dagligt mål</h1>
          <p className="mt-1 font-semibold text-ink-muted">Lite varje dag slår en lång session i veckan. Du kan ändra det när som helst.</p>
        </div>
        <Panda mood={GOAL_MOOD[idx] ?? 'happy'} size={84} className="-mb-1 shrink-0" />
      </div>
      <ul className="stagger-children mt-5 space-y-2.5">
        {GOALS.map((g) => {
          const on = state.settings.dailyGoalXp === g.xp
          return (
            <li key={g.xp}>
              <button type="button" onClick={() => updateSettings({ dailyGoalXp: g.xp })} aria-pressed={on}
                className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3.5 font-extrabold transition-colors ${on ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}>
                <span className="flex items-center gap-3">
                  <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${on ? 'border-brand bg-brand' : 'border-line-dark'}`}>{on && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                  <span>{g.label} <span className="font-semibold text-ink-muted">· {g.note}</span></span>
                </span>
                <span className={`font-display text-lg font-semibold ${on ? 'text-brand-dark dark:text-brand' : ''}`}>{g.xp} XP</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SoundTest() {
  const v = useVoices()
  const [played, setPlayed] = useState(false)
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h1 className="font-display text-[28px] font-semibold">Testa ljudet</h1>
      <p className="mt-1 font-semibold text-ink-muted">Sätt upp volymen och tryck på högtalaren.</p>
      <div className="relative mt-8">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border-4 border-sky" aria-hidden="true" />
        <button type="button" onClick={() => { setPlayed(true); void speak('你好') }}
          className="btn-3d grid h-32 w-32 place-items-center rounded-full text-white"
          style={{ '--face': 'radial-gradient(circle at 35% 30%, #7cc8ff, var(--color-sky) 65%)', '--edge': 'var(--color-sky-dark)', '--depth': '8px' } as CSSProperties}
          aria-label="Spela nǐ hǎo">
          <SpeakerIcon size={60} />
        </button>
      </div>
      <div className="mt-7 font-display text-4xl font-semibold"><span className="text-tone-3">nǐ</span> <span className="text-tone-3">hǎo</span></div>
      <div className="font-bold text-ink-muted">”hej”</div>
      {played && v.has && <p className="mt-4 flex items-center gap-2 font-bold text-brand-dark dark:text-brand"><Panda mood="cheer" size={40} /> Hörde du det? Då är du redo!</p>}
      {!v.has && !hasChineseVoice() && (
        <p className="mt-5 rounded-2xl bg-warn-soft p-3 text-left text-sm font-semibold">
          <b>Ingen kinesisk röst hittades på enheten.</b>{' '}
          {isIOS
            ? <>Gå till Inställningar → Hjälpmedel → Uppläst innehåll → Röster → Kinesiska (Fastlandskina) och ladda ner en ”Förbättrad” röst.</>
            : <>Installera en kinesisk (mandarin) röst i telefonens inställningar för text till tal. Mer hjälp finns under Profil.</>}
        </p>
      )}
      <p className="mt-4 text-xs font-semibold text-ink-muted">Tips: båda är 3:e tonen – men framför en annan 3:e ton uttalas den första som en 2:a: ”ní hǎo”.</p>
    </div>
  )
}

function Level({ onPlacement }: { onPlacement?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Panda mood="surprised" size={150} className="float" />
      <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold">Kan du redan lite kinesiska?</h1>
      <p className="mt-1 font-semibold text-ink-muted">Gör ett kort nivåtest så hoppar du över det du redan kan. Annars börjar vi från början – helt lugnt.</p>
      {onPlacement && (
        <button type="button" onClick={onPlacement}
          className="btn-3d mt-6 flex w-full items-center gap-3 rounded-3xl border border-line/80 p-4 text-left"
          style={{ '--face': 'var(--color-surface)', '--edge': 'var(--color-line-dark)', '--shine': 0 } as CSSProperties}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold-dark"><TargetIcon size={26} /></span>
          <span className="min-w-0 flex-1">
            <b className="block font-display text-lg font-semibold">Gör ett nivåtest</b>
            <span className="text-sm font-semibold text-ink-muted">Ca 3 minuter · hoppa till rätt lektion</span>
          </span>
        </button>
      )}
    </div>
  )
}
