// OWNER: Speech/Lab agent. "Lyssna handsfree": audio-only loop for walks (Chinese → pause → Swedish).
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { course } from '../data/course'
import { useProgress } from '../progress'
import { hasSwedishVoice, PinyinText, speak, speakSwedish, stopSpeaking, unlockAudio } from '../speech'
import { Panda } from '../mascot/Panda'
import { Button } from '../ui/Button'
import { handsfreeItems, shuffle, type HandsfreeSource, type LabItem } from './items'
import { LabScreen, LabSummary, useLabSession, VoiceChip } from './shared'

type Phase = 'zh' | 'think' | 'zh2' | 'sv' | 'gap'

const PAUSES = [
  { id: 'short', label: 'Kort', ms: 1800 },
  { id: 'medium', label: 'Lagom', ms: 3000 },
  { id: 'long', label: 'Lång', ms: 4500 },
] as const

// ─── Wake Lock (keep the screen on while playing) ─────────────
interface WakeLockSentinelLike { release(): Promise<void>; released?: boolean }
function useWakeLock(active: boolean): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }
    if (!active || !nav.wakeLock) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false
    const acquire = () => {
      nav.wakeLock!.request('screen').then((s) => {
        if (cancelled) { void s.release().catch(() => {}); return }
        sentinel = s
        setHeld(true)
      }, () => setHeld(false))
    }
    acquire()
    // the lock is dropped when the page is hidden; take it again when we come back
    const onVis = () => { if (document.visibilityState === 'visible' && !cancelled) acquire() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void sentinel?.release().catch(() => {})
      setHeld(false)
    }
  }, [active])
  return held
}

export function HandsfreeMode({ onClose }: { onClose: () => void }) {
  const progress = useProgress()
  const { settings } = progress.state
  const known = progress.knownWordIds().filter((id) => course.words[id])
  const [source, setSource] = useState<HandsfreeSource>(() =>
    known.length >= 5 ? { kind: 'known-words' } : { kind: 'unit', unitId: course.units[0]?.id ?? 'u1' })
  const [rate, setRate] = useState(() => Math.min(1, settings.speechRate))
  const [pauseId, setPauseId] = useState<(typeof PAUSES)[number]['id']>('medium')
  const [swedish, setSwedish] = useState(true)
  const [repeat, setRepeat] = useState(true)
  const [items, setItems] = useState<LabItem[] | null>(null)
  const session = useLabSession()
  const [summary, setSummary] = useState<ReturnType<typeof session.finish> | null>(null)

  const start = () => {
    const list = handsfreeItems(course, known, source)
    if (!list.length) return
    unlockAudio()
    setItems(source.kind === 'unit' ? list : shuffle(list))
  }

  const stop = (heard: number) => {
    if (heard >= 3) {
      const res = session.finish({ passive: true })
      setSummary({ ...res, total: heard })
    } else onClose()
  }

  if (summary) {
    return (
      <LabScreen title="Lyssna handsfree" emoji="🎧" onClose={onClose}>
        <LabSummary title="Skön promenad!" subtitle="Öronen har fått jobba. Lyssnandet bygger grunden för att prata." stats={{ ...summary, passive: true }} onClose={onClose} />
      </LabScreen>
    )
  }

  if (items) {
    return <Player items={items} rate={rate} pauseMs={PAUSES.find((p) => p.id === pauseId)!.ms} swedish={swedish} repeat={repeat}
      showHanzi={settings.showHanzi} toneColors={settings.toneColors} onStop={stop} />
  }

  const chip = (active: boolean) => `rounded-2xl border-2 border-b-4 px-3 py-2.5 text-left font-bold transition-colors press active:translate-y-0.5 active:border-b-2
    ${active ? 'border-sky bg-sky-soft text-sky-dark' : 'border-line bg-surface text-ink'}`

  return (
    <LabScreen title="Lyssna handsfree" emoji="🎧" onClose={onClose}
      footer={<Button className="w-full" onClick={start}>▶ Starta</Button>}>
      <div className="flex items-center gap-3 py-3">
        <Panda mood="happy" size={72} className="shrink-0" />
        <p className="font-semibold text-ink-muted">Stoppa telefonen i fickan och lyssna: kinesiska, en paus att tänka – sedan svenska.</p>
      </div>

      <h2 className="mt-2 mb-2 text-sm font-black uppercase tracking-wide text-ink-muted">Vad vill du lyssna på?</h2>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={known.length === 0} className={`${chip(source.kind === 'known-words')} disabled:opacity-40`} onClick={() => setSource({ kind: 'known-words' })}>
          <div>📚 Mina ord</div><div className="text-xs font-semibold text-ink-muted">{known.length} ord</div>
        </button>
        <button type="button" className={chip(source.kind === 'known-sentences')} onClick={() => setSource({ kind: 'known-sentences' })}>
          <div>💬 Meningar</div><div className="text-xs font-semibold text-ink-muted">med ord du kan</div>
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {course.units.map((u, i) => (
          <button key={u.id} type="button" className={chip(source.kind === 'unit' && source.unitId === u.id)} onClick={() => setSource({ kind: 'unit', unitId: u.id })}>
            <div className="line-clamp-2 text-sm leading-tight">{u.emoji} {i + 1}. {u.title}</div>
          </button>
        ))}
      </div>

      <h2 className="mt-5 mb-2 text-sm font-black uppercase tracking-wide text-ink-muted">Tempo</h2>
      <div className="flex items-center gap-3">
        <span aria-hidden="true">🐢</span>
        <input type="range" className="slider flex-1" min={0.5} max={1.1} step={0.05} value={rate}
          onChange={(e) => setRate(Number(e.target.value))} aria-label="Talhastighet" />
        <span aria-hidden="true">🐇</span>
        <span className="w-12 text-right font-black tabular-nums">{rate.toFixed(2)}×</span>
      </div>

      <h2 className="mt-5 mb-2 text-sm font-black uppercase tracking-wide text-ink-muted">Tänkpaus</h2>
      <div className="grid grid-cols-3 gap-2">
        {PAUSES.map((p) => (
          <button key={p.id} type="button" className={`${chip(pauseId === p.id)} text-center`} onClick={() => setPauseId(p.id)}>{p.label}</button>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        <ToggleRow label="Svenska efter pausen" description={hasSwedishVoice() ? 'Läses upp med svensk röst' : 'Ingen svensk röst hittades – visas som text'} checked={swedish} onChange={setSwedish} />
        <ToggleRow label="Upprepa kinesiskan" description="Hör den två gånger – andra gången från en annan röst om det finns" checked={repeat} onChange={setRepeat} />
      </div>
      <div className="h-4" />
    </LabScreen>
  )
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-line px-3 py-2.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-ink-muted">{description}</span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full border-b-4 transition-colors ${checked ? 'border-brand-dark bg-brand' : 'border-gray-300 bg-line'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  )
}

// ─── Player ──────────────────────────────────────────────────

function Player({ items, rate, pauseMs, swedish, repeat, showHanzi, toneColors, onStop }: {
  items: LabItem[]; rate: number; pauseMs: number; swedish: boolean; repeat: boolean; showHanzi: boolean; toneColors: boolean
  onStop: (heard: number) => void
}) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState<Phase>('zh')
  const [svShown, setSvShown] = useState(false)
  const [voiceName, setVoiceName] = useState<string | null>(null)
  const heard = useRef(new Set<string>())
  const run = useRef(0)
  const wake = useWakeLock(playing)
  const svVoice = hasSwedishVoice()

  const sleep = (ms: number, my: number) => new Promise<boolean>((resolve) => {
    const t0 = Date.now()
    const tick = () => {
      if (run.current !== my) return resolve(false)
      if (Date.now() - t0 >= ms) return resolve(true)
      setTimeout(tick, 100)
    }
    tick()
  })

  const loop = useCallback(async (startIdx: number) => {
    const my = ++run.current
    let i = startIdx
    while (run.current === my) {
      const it = items[i % items.length]
      setIdx(i % items.length); setSvShown(false); setPhase('zh')
      await speak(it.hanzi, { voice: 'auto', rate, onVoice: setVoiceName })
      if (run.current !== my) return
      setPhase('think')
      if (!(await sleep(pauseMs, my))) return
      if (repeat) {
        setPhase('zh2')
        await speak(it.hanzi, { voice: 'auto', rate, onVoice: setVoiceName })
        if (run.current !== my || !(await sleep(500, my))) return
      }
      setPhase('sv'); setSvShown(true)
      heard.current.add(it.key)
      if (swedish) {
        const spoke = await speakSwedish(it.sv, { rate: 1 })
        if (run.current !== my) return
        if (!spoke && !(await sleep(1800, my))) return
      } else if (!(await sleep(1500, my))) return
      setPhase('gap')
      if (!(await sleep(1200, my))) return
      i++
    }
  }, [items, rate, pauseMs, swedish, repeat])

  useEffect(() => {
    if (!playing) return
    void loop(idx)
    return () => { run.current++; stopSpeaking() }
    // restart only on play/pause (idx changes inside the loop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop])

  const jump = (d: number) => {
    run.current++
    stopSpeaking()
    const n = (idx + d + items.length) % items.length
    setIdx(n)
    if (playing) void loop(n)
    else { setPhase('zh'); setSvShown(false) }
  }

  const it = items[idx]
  const phaseLabel: Record<Phase, string> = {
    zh: 'Lyssna …', think: 'Vad betyder det?', zh2: 'En gång till …', sv: 'Svenska', gap: 'Nästa kommer …',
  }

  return (
    <LabScreen title="Lyssna handsfree" emoji="🎧" onClose={() => { run.current++; stopSpeaking(); onStop(heard.current.size) }}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
        <div className="flex items-center gap-2 text-sm font-bold text-ink-muted">
          <span className="tabular-nums">{idx + 1} / {items.length}</span>
          <span aria-hidden="true">·</span>
          <span>{heard.current.size} hörda</span>
          {wake && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-dark" title="Skärmen hålls tänd">☀ skärmen på</span>}
        </div>

        <div className="relative">
          <Panda mood={playing ? (phase === 'think' ? 'think' : 'happy') : 'sleep'} size={110} />
          {playing && phase !== 'think' && phase !== 'gap' && (
            <span className="absolute -right-2 top-2 flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((k) => <span key={k} className="h-3 w-1.5 animate-bob rounded-full bg-sky" style={{ animationDelay: `${k * 120}ms` }} />)}
            </span>
          )}
        </div>

        <div className="min-h-[9rem] w-full rounded-3xl border-2 border-b-4 border-line px-4 py-5">
          <div className="text-xs font-black uppercase tracking-widest text-sky-dark">{playing ? phaseLabel[phase] : 'Pausad'}</div>
          <PinyinText pinyin={it.pinyin} colored={toneColors} className="mt-2 block text-3xl font-black leading-snug" />
          {showHanzi && <div className="text-lg text-ink-muted" lang="zh-CN">{it.hanzi}</div>}
          <div aria-hidden={!svShown} className={`mt-2 text-lg font-bold transition-opacity duration-300 ${svShown ? 'opacity-100' : 'opacity-0'}`}>{it.sv}</div>
        </div>
        <VoiceChip name={voiceName} />
        {!svVoice && swedish && <p className="text-xs font-semibold text-ink-muted">Ingen svensk röst i enheten – svenskan visas som text.</p>}

        <div className="flex items-center gap-6">
          <RoundBtn label="Föregående" onClick={() => jump(-1)}>
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path d="M7 5v14M19 6l-9 6 9 6V6Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          </RoundBtn>
          <button type="button" onClick={() => { unlockAudio(); setPlaying((p) => !p) }} aria-label={playing ? 'Pausa' : 'Spela'}
            className="inline-flex h-24 w-24 items-center justify-center rounded-full border-b-4 border-brand-dark bg-brand text-white transition-transform press active:translate-y-0.5 active:border-b-2">
            {playing
              ? <svg viewBox="0 0 24 24" className="h-11 w-11" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" className="ml-1 h-11 w-11" aria-hidden="true"><path d="M7 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L8.5 4.6A1 1 0 0 0 7 5.5Z" fill="currentColor" /></svg>}
          </button>
          <RoundBtn label="Nästa" onClick={() => jump(1)}>
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path d="M17 5v14M5 6l9 6-9 6V6Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          </RoundBtn>
        </div>
        <p className="max-w-xs text-xs font-semibold text-ink-muted">
          Tips: håll skärmen på (låst skärm stoppar talsyntesen på iPhone). Sänk ljusstyrkan och stoppa telefonen i fickan.
        </p>
        <Button variant="secondary" onClick={() => { run.current++; stopSpeaking(); onStop(heard.current.size) }}>Avsluta</Button>
      </div>
    </LabScreen>
  )
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-b-4 border-line bg-surface text-ink-muted transition-transform press active:translate-y-0.5 active:border-b-2">
      {children}
    </button>
  )
}
