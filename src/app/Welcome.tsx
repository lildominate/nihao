// First-run welcome (Shell): intro → pinyin & tones → daily goal → sound test.
import { useState } from 'react'
import type { Tone } from '../types'
import { useProgress } from '../progress'
import { hasChineseVoice, isIOS, speak } from '../speech'
import { Button } from '../ui/Button'
import { BackIcon, SpeakerIcon } from './icons'
import { GOALS, useVoices } from './shared'

const ORD: Record<number, string> = { 1: '1:a', 2: '2:a', 3: '3:e', 4: '4:e' }
const TONES: { tone: Tone; py: string; hanzi: string; sv: string; how: string; path: string }[] = [
  { tone: 1, py: 'mā', hanzi: '妈', sv: 'mamma', how: 'Hög och jämn, som när du sjunger en ton.', path: 'M4 7 H36' },
  { tone: 2, py: 'má', hanzi: '麻', sv: 'hampa', how: 'Stigande, som en förvånad fråga: ”Va?”', path: 'M4 30 L36 6' },
  { tone: 3, py: 'mǎ', hanzi: '马', sv: 'häst', how: 'Låg – går ner och sedan upp igen.', path: 'M4 16 Q20 42 36 10' },
  { tone: 4, py: 'mà', hanzi: '骂', sv: 'skälla', how: 'Skarpt fallande, som ett bestämt ”Nej!”', path: 'M4 6 L36 32' },
]

export function Welcome({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const steps = 4
  const next = () => (step < steps - 1 ? setStep(step + 1) : onDone())

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-safe pb-safe">
        <div className="flex h-14 items-center gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="-ml-1 p-1 text-gray-400" aria-label="Tillbaka"><BackIcon size={28} /></button>
          ) : <span className="w-8" />}
          <div className="flex flex-1 gap-1.5" aria-label={`Steg ${step + 1} av ${steps}`}>
            {Array.from({ length: steps }, (_, i) => (
              <span key={i} className={`h-3 flex-1 rounded-full transition-colors ${i <= step ? 'bg-brand' : 'bg-line'}`} />
            ))}
          </div>
          <span className="w-8" />
        </div>

        <div key={step} className="flex flex-1 animate-fade flex-col py-4">
          {step === 0 && <Intro />}
          {step === 1 && <Tones />}
          {step === 2 && <Goal />}
          {step === 3 && <SoundTest />}
        </div>

        <div className="pb-5">
          <Button className="w-full" onClick={next}>{step === 0 ? 'Kom igång' : step === steps - 1 ? 'Börja lära dig' : 'Fortsätt'}</Button>
        </div>
      </div>
    </div>
  )
}

function Intro() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <img src="icon.svg" alt="" className="mb-5 h-28 w-28 animate-pop rounded-[28px] shadow-[0_6px_0_#15803d]" />
      <h1 className="text-4xl font-black text-brand">Nǐ hǎo!</h1>
      <p className="mt-2 text-lg font-bold">Lär dig <i>prata</i> mandarin – med pinyin, utan tecken.</p>
      <ul className="mt-7 w-full space-y-2.5 text-left">
        <Li emoji="🗣️" title="Fokus på tal och hörsel">Du lyssnar, härmar och svarar – precis som i ett riktigt samtal.</Li>
        <Li emoji="🔤" title="Pinyin = kinesiska med vårt alfabet">Du behöver aldrig lära dig skrivtecken.</Li>
        <Li emoji="💚" title="Helt fritt">Ingen reklam, inga hjärtan, inga gränser.</Li>
      </ul>
    </div>
  )
}

function Li({ emoji, title, children }: { emoji: string; title: string; children: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border-2 border-line p-3">
      <span className="text-2xl">{emoji}</span>
      <span><b className="block font-black">{title}</b><span className="text-sm font-semibold text-ink-muted">{children}</span></span>
    </li>
  )
}

function Tones() {
  const toneColor = (t: Tone) => `var(--tone-${t})`
  return (
    <div>
      <h1 className="text-2xl font-black">Fyra toner</h1>
      <p className="mt-1 font-semibold text-ink-muted">
        Mandarin är ett <b className="text-ink">tonspråk</b>: samma stavelse betyder olika saker beroende på tonen. I pinyin visas tonen med ett tecken över vokalen. Tryck och lyssna!
      </p>
      <ul className="mt-4 space-y-2">
        {TONES.map((t) => (
          <li key={t.tone}>
            <button type="button" onClick={() => void speak(t.hanzi, { slow: true })}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 border-line p-3 text-left active:translate-y-0.5 active:border-b-2">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl font-black text-white" style={{ background: toneColor(t.tone) }}>{t.py}</span>
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
  return (
    <div>
      <h1 className="text-2xl font-black">Välj ett dagligt mål</h1>
      <p className="mt-1 font-semibold text-ink-muted">Några minuter varje dag slår en lång session i veckan. Du kan ändra det när som helst.</p>
      <ul className="mt-5 space-y-2">
        {GOALS.map((g) => {
          const on = state.settings.dailyGoalXp === g.xp
          return (
            <li key={g.xp}>
              <button type="button" onClick={() => updateSettings({ dailyGoalXp: g.xp })} aria-pressed={on}
                className={`flex w-full items-center justify-between rounded-2xl border-2 border-b-4 px-4 py-3.5 font-black transition-colors ${on ? 'border-sky bg-sky-soft text-sky-dark' : 'border-line'}`}>
                <span>{g.label} <span className="font-semibold text-ink-muted">· {g.note}</span></span>
                <span>{g.xp} XP</span>
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
      <h1 className="text-2xl font-black">Testa ljudet</h1>
      <p className="mt-1 font-semibold text-ink-muted">Sätt upp volymen och tryck på högtalaren.</p>
      <button type="button" onClick={() => { setPlayed(true); void speak('你好') }}
        className="mt-8 grid h-32 w-32 place-items-center rounded-full border-b-8 border-sky-dark bg-sky text-white active:translate-y-1 active:border-b-4" aria-label="Spela nǐ hǎo">
        <SpeakerIcon size={60} />
      </button>
      <div className="mt-6 text-3xl font-black"><span className="text-tone-3">nǐ</span> <span className="text-tone-3">hǎo</span></div>
      <div className="font-bold text-ink-muted">”hej”</div>
      {played && v.has && <p className="mt-4 font-bold text-brand-dark">Hörde du det? Då är du redo! 🎉</p>}
      {!v.has && !hasChineseVoice() && (
        <p className="mt-5 rounded-2xl bg-orange-50 p-3 text-left text-sm font-semibold text-orange-900">
          ⚠️ Ingen kinesisk röst hittades på enheten.{' '}
          {isIOS
            ? <>Gå till Inställningar → Hjälpmedel → Uppläst innehåll → Röster → Kinesiska (Fastlandskina) och ladda ner en ”Förbättrad” röst.</>
            : <>Installera en kinesisk (mandarin) röst i telefonens inställningar för text till tal. Mer hjälp finns under Profil.</>}
        </p>
      )}
      <p className="mt-4 text-xs font-semibold text-ink-muted">Tips: båda är 3:e tonen – men framför en annan 3:e ton uttalas den första som en 2:a: ”ní hǎo”.</p>
    </div>
  )
}
