// Home-screen card for "Dagens pass": pick energy + craving, then the App runs the plan.
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Panda } from '../mascot/Panda'
import { CRAVINGS, ENERGY, STEP_INFO } from './plan'
import type { Craving, DayRecord, Energy } from './plan'

export function DailyCard({ today, onStart }: { today: DayRecord | null; onStart: (energy: Energy, craving: Craving) => void }) {
  const [step, setStep] = useState<'idle' | 'energy' | 'craving'>('idle')
  const [energy, setEnergy] = useState<Energy>('normal')
  const finished = today && today.done >= today.steps.length

  return (
    <div className="rounded-3xl border-2 border-b-4 border-brand bg-brand-soft p-4">
      {step === 'idle' && (
        <div className="flex items-center gap-3">
          <Panda mood={finished ? 'proud' : 'wave'} size={60} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-brand-dark">{finished ? 'Dagens pass klart! 🎉' : 'Dagens pass'}</h2>
            <p className="text-sm font-bold text-ink-muted">
              {today
                ? today.steps.map((s, i) => <span key={i} className={i < today.done ? 'line-through opacity-60' : ''}>{STEP_INFO[s].emoji} </span>)
                : 'Ett tryck – så planerar Pānpan dagen åt dig.'}
            </p>
          </div>
          <Button size="sm" onClick={() => setStep('energy')}>{finished ? 'Kör igen' : today ? 'Fortsätt' : '▶ Starta'}</Button>
        </div>
      )}

      {step === 'energy' && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-brand-dark">Hur mycket ork har du idag?</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(ENERGY) as Energy[]).map((e) => (
              <button key={e} type="button" onClick={() => { setEnergy(e); setStep('craving') }}
                className="press flex flex-col items-center gap-1 rounded-2xl border-2 border-b-4 border-line bg-surface p-3 font-black">
                <span className="text-3xl">{ENERGY[e].emoji}</span>
                <span>{ENERGY[e].label}</span>
                <span className="text-xs text-ink-muted">≈ {ENERGY[e].minutes} min</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('idle')} className="text-sm font-bold text-ink-muted">Avbryt</button>
        </div>
      )}

      {step === 'craving' && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-black text-brand-dark">Är du sugen på något extra?</h2>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CRAVINGS) as Craving[]).map((c) => (
              <button key={c} type="button" onClick={() => { setStep('idle'); onStart(energy, c) }}
                className={`press flex items-center gap-2 rounded-2xl border-2 border-b-4 border-line bg-surface p-3 text-left font-black ${c === 'surprise' ? 'col-span-2 justify-center' : ''}`}>
                <span className="text-2xl">{CRAVINGS[c].emoji}</span>{CRAVINGS[c].label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStep('energy')} className="text-sm font-bold text-ink-muted">← Tillbaka</button>
        </div>
      )}
    </div>
  )
}

/** Between steps: what's next, continue or stop for today. */
export function DayBetween({ day, onNext, onStop }: { day: DayRecord; onNext: () => void; onStop: () => void }) {
  const done = day.done >= day.steps.length
  const next = day.steps[day.done]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas/95 p-6 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Panda mood={done ? 'proud' : 'cheer'} size={120} className="bounce-soft" />
        <h2 className="text-2xl font-black">{done ? 'Dagens pass är klart!' : 'Bra jobbat!'}</h2>
        <div className="flex gap-2 text-2xl" aria-label={`Steg ${Math.min(day.done, day.steps.length)} av ${day.steps.length} klara`}>
          {day.steps.map((s, i) => (
            <span key={i} className={`rounded-xl px-2 py-1 ${i < day.done ? 'bg-brand-soft' : i === day.done ? 'bg-sky-soft ring-2 ring-sky' : 'bg-surface-2 opacity-60'}`}>{STEP_INFO[s].emoji}</span>
          ))}
        </div>
        {done ? (
          <>
            <p className="font-bold text-ink-muted">Snyggt – vi ses imorgon! 🔥</p>
            <Button className="w-full" onClick={onStop}>Tillbaka hem</Button>
          </>
        ) : (
          <>
            <p className="font-bold text-ink-muted">Nästa: {STEP_INFO[next].emoji} {STEP_INFO[next].label} · steg {day.done + 1} av {day.steps.length}</p>
            <Button className="w-full" onClick={onNext}>Fortsätt</Button>
            <Button variant="ghost" className="w-full" onClick={onStop}>Räcker för idag</Button>
          </>
        )}
      </div>
    </div>
  )
}
