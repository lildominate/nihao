// OWNER: Speech/Lab agent. "Uttalsguide": pinyin chart with tap-to-hear, tricky sounds, tones and sandhi.
import { useState } from 'react'
import type { Tone } from '../types'
import { useProgress } from '../progress'
import { idealContour, PinyinText, speak } from '../speech'
import { toneTextClass } from '../speech/pinyin'
import { Panda } from '../mascot/Panda'
import { finalGroups, initialGroups, SANDHI_RULES, TONES_GUIDE, trickyNotes, type GuideGroup, type GuideSound } from './guideData'
import { LabScreen, VoiceChip } from './shared'

type Tab = 'tones' | 'initials' | 'finals' | 'tricky'
const TABS: { id: Tab; label: string }[] = [
  { id: 'tones', label: 'Toner' },
  { id: 'initials', label: 'Initialer' },
  { id: 'finals', label: 'Finaler' },
  { id: 'tricky', label: 'Knepiga' },
]

/** Mini SVG of a tone's contour on the 5-level scale. */
export function ToneShapeIcon({ tone, className = 'h-10 w-14' }: { tone: Tone; className?: string }) {
  const pts = idealContour(tone)
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${6 + (44 * i) / Math.max(1, pts.length - 1)} ${34 - v * 28}`).join(' ')
  return (
    <svg viewBox="0 0 56 40" className={className} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((k) => <line key={k} x1="4" x2="52" y1={6 + k * 7} y2={6 + k * 7} stroke="var(--color-line)" strokeWidth="1" />)}
      {tone === 5
        ? <circle cx="28" cy={34 - pts[0] * 28} r="4" fill={`var(--color-tone-5)`} />
        : <path d={d} fill="none" stroke={`var(--color-tone-${tone})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

export function GuideMode({ onClose }: { onClose: () => void }) {
  const { settings } = useProgress().state
  const [tab, setTab] = useState<Tab>('tones')
  const [selected, setSelected] = useState<GuideSound | null>(null)
  const [voice, setVoice] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  const say = (key: string, hanzi: string, slow = false) => {
    setPlaying(key)
    void speak(hanzi, { voice: 'auto', slow, rate: settings.speechRate, onVoice: setVoice }).then(() => setPlaying((p) => (p === key ? null : p)))
  }

  const pick = (s: GuideSound) => { setSelected(s); say(`s:${s.symbol}`, s.hanzi) }

  return (
    <LabScreen title="Uttalsguide" emoji="🔤" onClose={onClose}>
      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-[5] -mx-4 bg-surface/95 px-4 pb-2 backdrop-blur">
        <div className="flex gap-1 rounded-2xl bg-surface-2 p-1" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSelected(null) }}
              className={`flex-1 rounded-xl px-1 py-2 text-[13px] font-black transition-colors ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex h-6 items-center justify-between">
          <span className="text-xs font-semibold text-ink-muted">Tryck för att lyssna</span>
          <VoiceChip name={voice} />
        </div>
      </div>

      {tab === 'tones' && (
        <div className="space-y-3 pt-1 pb-6">
          {TONES_GUIDE.map((t) => (
            <button key={t.tone} type="button" onClick={() => say(`t:${t.tone}`, t.hanzi)}
              className={`flex w-full items-center gap-3 rounded-3xl border-2 border-b-4 border-line p-3 text-left transition-transform press active:translate-y-0.5 ${playing === `t:${t.tone}` ? 'bg-sky-soft' : 'bg-surface'}`}>
              <ToneShapeIcon tone={t.tone} className="h-12 w-16 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${toneTextClass(t.tone)}`}>{t.example}</span>
                  <span className="font-bold">{t.name}</span>
                </span>
                <span className="block text-sm font-semibold text-ink-muted">{t.sv}</span>
              </span>
            </button>
          ))}

          <h2 className="pt-3 text-lg font-black">Tonerna ändras ibland</h2>
          <p className="-mt-2 text-sm font-semibold text-ink-muted">Skrivs inte ut i pinyin, men så låter det (tonsandhi):</p>
          {SANDHI_RULES.map((r) => (
            <button key={r.title} type="button" onClick={() => say(`r:${r.title}`, r.hanzi)}
              className={`w-full rounded-3xl border-2 border-b-4 border-line p-3 text-left transition-transform press active:translate-y-0.5 ${playing === `r:${r.title}` ? 'bg-sky-soft' : 'bg-surface'}`}>
              <div className="font-black">{r.title}</div>
              <div className="text-sm font-semibold text-ink-muted">{r.text}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-black">
                <PinyinText pinyin={r.example} colored={settings.toneColors} />
                <span className="text-ink-muted" aria-hidden="true">→</span>
                <span className="text-ink">"{r.said}"</span>
                <span className="ml-auto text-sky-dark" aria-hidden="true">🔊</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {(tab === 'initials' || tab === 'finals') && (
        <div className="pb-40">
          <p className="py-1 text-sm font-semibold text-ink-muted">
            {tab === 'initials' ? 'Initialen är stavelsens första konsonant.' : 'Finalen är resten av stavelsen – vokalerna och ev. n/ng.'}
            {' '}<span className="font-black text-flame">●</span> = knepig för svenskar.
          </p>
          {(tab === 'initials' ? initialGroups : finalGroups).map((g) => (
            <SoundGroup key={g.title} group={g} selected={selected} playing={playing} onPick={pick} />
          ))}
        </div>
      )}

      {tab === 'tricky' && (
        <div className="space-y-3 pt-1 pb-6">
          <div className="flex items-center gap-3">
            <Panda mood="think" size={56} className="shrink-0" />
            <p className="text-sm font-semibold text-ink-muted">De här ljuden finns inte riktigt på svenska – men du har nästan alla redan!</p>
          </div>
          {trickyNotes.map((n) => (
            <div key={n.title} className="rounded-3xl border-2 border-b-4 border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black">{n.title}</h3>
                <button type="button" onClick={() => say(`n:${n.title}`, [...n.hanzi].join('，'), true)} aria-label={`Lyssna: ${n.example}`}
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-b-4 border-sky-dark bg-sky text-white press active:translate-y-0.5 active:border-b-2 ${playing === `n:${n.title}` ? 'scale-105' : ''}`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" fill="currentColor" /></svg>
                </button>
              </div>
              <PinyinText pinyin={n.example} colored={settings.toneColors} className="mt-1 block text-xl font-black" />
              <p className="mt-1 text-sm font-semibold text-ink-muted">{n.text}</p>
            </div>
          ))}
        </div>
      )}

      {selected && (tab === 'initials' || tab === 'finals') && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-sheet">
          <div className="rounded-3xl border-2 border-b-4 border-sky/50 bg-surface p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-14 min-w-14 items-center justify-center rounded-2xl bg-sky-soft px-2 text-2xl font-black text-sky-dark">{selected.symbol}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <PinyinText pinyin={selected.example} colored={settings.toneColors} className="text-xl font-black" />
                  <span className="text-sm font-semibold text-ink-muted">{selected.meaning}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold">{selected.sv}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Stäng" className="-mt-1 -mr-1 p-1 text-ink-muted">✕</button>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => say(`s:${selected.symbol}`, selected.hanzi)} className="flex-1 rounded-2xl border-b-4 border-sky-dark bg-sky py-2.5 font-black text-white press active:translate-y-0.5 active:border-b-2">🔊 Lyssna</button>
              <button type="button" onClick={() => say(`s:${selected.symbol}`, selected.hanzi, true)} className="flex-1 rounded-2xl border-2 border-b-4 border-sky/40 bg-sky-soft py-2.5 font-black text-sky-dark press active:translate-y-0.5 active:border-b-2">🐢 Långsamt</button>
            </div>
          </div>
        </div>
      )}
    </LabScreen>
  )
}

function SoundGroup({ group, selected, playing, onPick }: { group: GuideGroup; selected: GuideSound | null; playing: string | null; onPick: (s: GuideSound) => void }) {
  return (
    <section className="mt-3">
      <h3 className="mb-1.5 text-xs font-black uppercase tracking-wide text-ink-muted">{group.title}</h3>
      <div className="grid grid-cols-4 gap-2">
        {group.items.map((s) => {
          const active = selected?.symbol === s.symbol
          return (
            <button key={s.symbol} type="button" onClick={() => onPick(s)} aria-label={`${s.symbol}, exempel ${s.example}`}
              className={`relative flex flex-col items-center rounded-2xl border-2 border-b-4 py-2 transition-transform press active:translate-y-0.5 active:border-b-2
                ${active ? 'border-sky bg-sky-soft' : 'border-line bg-surface'} ${playing === `s:${s.symbol}` ? 'scale-105' : ''}`}>
              {s.tricky && <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-flame" aria-hidden="true" />}
              <span className="text-xl font-black">{s.symbol}</span>
              <span className="text-xs font-bold text-ink-muted">{s.example}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
