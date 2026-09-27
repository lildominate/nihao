// "Profil" — stats, settings, voice status, backup, reset (Shell).
import { useRef, useState, type ReactNode } from 'react'
import { course } from '../data/course'
import { displayStreak, exportProgress, importProgress, localDay, useProgress, xpHistory } from '../progress'
import { isIOS, PinyinText, recognitionSupport, speak } from '../speech'
import { GOALS, useVoices } from './shared'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Sheet } from '../ui/Sheet'
import { Toggle } from '../ui/Toggle'
import { TopBar } from './chrome'
import { BoltIcon, FlameIcon, SpeakerIcon } from './icons'


const WEEKDAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']


export function ProfileScreen({ onReplayIntro }: { onReplayIntro: () => void }) {
  const p = useProgress()
  const { state, updateSettings } = p
  const s = state.settings
  const today = localDay()
  const streak = displayStreak(state, today)
  const lessonsDone = Object.keys(state.completedLessons).length
  const totalLessons = course.units.reduce((n, u) => n + u.lessons.length, 0)
  const words = p.knownWordIds().length
  const rec = recognitionSupport()

  return (
    <>
      <TopBar title="Profil" />
      <div className="space-y-5 px-4 py-5 pb-10">
        {/* Stats */}
        <section>
          <SectionTitle>Statistik</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile icon={<FlameIcon size={26} className={streak ? 'text-flame' : 'text-gray-300'} />} value={streak} label="Dagar i rad" />
            <StatTile icon={<span className="text-2xl">🏅</span>} value={state.streak.best} label="Bästa streak" />
            <StatTile icon={<BoltIcon size={26} className="text-warn" />} value={state.xpTotal} label="Totalt XP" />
            <StatTile icon={<span className="text-2xl">📘</span>} value={totalLessons ? `${lessonsDone}/${totalLessons}` : lessonsDone} label="Lektioner klara" />
            <StatTile icon={<span className="text-2xl">🗣️</span>} value={words} label="Ord inlärda" wide />
          </div>
        </section>

        <WeekChart history={xpHistory(state, today, 7)} goal={s.dailyGoalXp} today={today} />

        {/* Settings */}
        <section>
          <SectionTitle>Inställningar</SectionTitle>
          <Card className="divide-y-2 divide-line py-1">
            <div className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">Talhastighet</span>
                <span className="rounded-lg bg-surface-2 px-2 py-0.5 text-sm font-black">{s.speechRate.toFixed(2).replace('.', ',')}×</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-lg" aria-hidden="true">🐢</span>
                <input
                  type="range" className="slider min-w-0 flex-1" min={0.5} max={1.2} step={0.05}
                  value={s.speechRate} aria-label="Talhastighet"
                  onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })}
                />
                <span className="text-lg" aria-hidden="true">🐇</span>
                <button type="button" onClick={() => speak('你好，很高兴认识你。', { rate: s.speechRate })}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-b-4 border-sky-dark bg-sky text-white active:translate-y-0.5 active:border-b-2" aria-label="Testa talhastigheten">
                  <SpeakerIcon size={20} />
                </button>
              </div>
            </div>
            <Toggle checked={s.toneColors} onChange={(v) => updateSettings({ toneColors: v })} label="Tonfärger"
              description={<>Färglägg pinyin efter ton: <PinyinText pinyin="mā má mǎ mà ma" colored className="font-black" /></>} />
            <Toggle checked={s.showHanzi} onChange={(v) => updateSettings({ showHanzi: v })} label="Visa kinesiska tecken" description="Visas som extra stöd – du behöver aldrig lära dig dem." />
            <Toggle checked={s.soundEffects} onChange={(v) => updateSettings({ soundEffects: v })} label="Ljudeffekter" description="Pling vid rätt svar, med mera." />
            <div>
              <Toggle checked={s.speakingExercises} onChange={(v) => updateSettings({ speakingExercises: v })} label="Talövningar (mikrofon)" description="Säg fraser högt och få dem bedömda." />
              {rec.hint && <p className={`-mt-1 mb-3 rounded-xl p-2.5 text-xs font-semibold ${rec.available ? 'bg-sky-soft text-sky-dark' : 'bg-orange-50 text-orange-800'}`}>{rec.hint}</p>}
            </div>
            <div className="py-3">
              <div className="mb-2 font-bold">Dagligt mål</div>
              <div className="grid grid-cols-4 gap-2">
                {GOALS.map((g) => {
                  const on = s.dailyGoalXp === g.xp
                  return (
                    <button key={g.xp} type="button" onClick={() => updateSettings({ dailyGoalXp: g.xp })} aria-pressed={on}
                      className={`rounded-2xl border-2 border-b-4 px-1 py-2 text-center transition-colors ${on ? 'border-sky bg-sky-soft text-sky-dark' : 'border-line'}`}>
                      <div className="text-lg leading-none font-black">{g.xp}</div>
                      <div className="mt-1 text-[11px] font-extrabold">{g.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        </section>

        <VoiceStatus />
        <Backup />

        <section className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={onReplayIntro}>Visa introduktionen igen</Button>
          <ResetButton />
        </section>

        <p className="pt-2 text-center text-xs font-semibold text-ink-muted">Nǐ hǎo · ingen reklam, inga hjärtan, inga gränser 💚</p>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 px-1 text-sm font-black tracking-wide text-ink-muted uppercase">{children}</h2>
}

function StatTile({ icon, value, label, wide }: { icon: ReactNode; value: ReactNode; label: string; wide?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border-2 border-b-4 border-line p-3 ${wide ? 'col-span-2' : ''}`}>
      <span className="grid w-8 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xl leading-tight font-black">{value}</span>
        <span className="block truncate text-xs font-bold text-ink-muted">{label}</span>
      </span>
    </div>
  )
}

function WeekChart({ history, goal, today }: { history: { day: string; xp: number }[]; goal: number; today: string }) {
  const max = Math.max(goal, ...history.map((h) => h.xp), 1)
  const total = history.reduce((n, h) => n + h.xp, 0)
  const H = 120
  return (
    <section>
      <SectionTitle>Senaste 7 dagarna</SectionTitle>
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-2xl font-black">{total} <span className="text-sm font-bold text-ink-muted">XP</span></span>
          <span className="text-xs font-bold text-ink-muted">mål {goal} XP/dag</span>
        </div>
        <div className="relative" style={{ height: H }}>
          <div className="absolute inset-x-0 border-t-2 border-dashed border-warn/60" style={{ bottom: (goal / max) * H }} aria-hidden="true" />
          <div className="absolute inset-0 grid grid-cols-7 items-end gap-2">
            {history.map((h) => {
              const reached = h.xp >= goal
              const isToday = h.day === today
              return (
                <div key={h.day} className="relative flex h-full flex-col items-center justify-end" title={`${h.day}: ${h.xp} XP`}>
                  {h.xp > 0 && <span className="mb-0.5 text-[10px] font-black text-ink-muted">{h.xp}</span>}
                  <div
                    className={`w-full rounded-t-lg rounded-b-sm ${reached ? 'bg-brand' : h.xp > 0 ? 'bg-warn' : 'bg-surface-2'}`}
                    style={{ height: Math.max(6, (h.xp / max) * (H - 16)), opacity: isToday ? 1 : 0.85 }}
                  />
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-2 text-center text-[11px] font-extrabold">
          {history.map((h) => {
            const [y, m, d] = h.day.split('-').map(Number)
            const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
            return <span key={h.day} className={h.day === today ? 'text-sky-dark' : 'text-ink-muted'}>{h.day === today ? 'idag' : wd}</span>
          })}
        </div>
      </Card>
    </section>
  )
}

function VoiceStatus() {
  const v = useVoices()
  const good = v.name ? /premium|förbättrad|enhanced|natural|neural|online/i.test(v.name) : false
  return (
    <section>
      <SectionTitle>Röst</SectionTitle>
      <Card className="space-y-3">
        {v.has ? (
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div className="min-w-0">
              <div className="font-black text-brand-dark">Kinesisk röst hittad</div>
              <div className="truncate text-sm font-semibold text-ink-muted">{v.name}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-2xl bg-orange-50 p-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-black text-orange-800">{v.synth ? 'Ingen kinesisk röst hittades' : 'Talsyntes stöds inte i den här webbläsaren'}</div>
              <div className="text-sm font-semibold text-orange-900/80">Utan en kinesisk (mandarin) röst kan appen inte läsa upp orden. Installera en röst enligt nedan och starta om appen.</div>
            </div>
          </div>
        )}
        <Button variant="secondary" className="w-full" onClick={() => speak('你好')}>🔊 Testa: nǐ hǎo</Button>

        {(!v.has || !good) && (isIOS ? <IphoneVoiceHelp open /> : null)}
        {!v.has && !isIOS && <AndroidVoiceHelp />}
        {v.has && good && isIOS && <IphoneVoiceHelp />}
      </Card>
    </section>
  )
}

function IphoneVoiceHelp({ open }: { open?: boolean }) {
  return (
    <details className="rounded-2xl bg-sky-soft p-3 text-sm" open={open}>
      <summary className="cursor-pointer font-black text-sky-dark">📱 Få en bättre röst på iPhone</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 font-semibold">
        <li>Öppna <b>Inställningar</b> → <b>Hjälpmedel</b> → <b>Uppläst innehåll</b> → <b>Röster</b>.</li>
        <li>Välj <b>Kinesiska (Fastlandskina)</b>.</li>
        <li>Ladda ner en <b>”Förbättrad”</b>- eller <b>”Premium”</b>-röst (t.ex. Tingting eller Lilian).</li>
        <li>Stäng appen helt och öppna den igen.</li>
      </ol>
    </details>
  )
}

function AndroidVoiceHelp() {
  return (
    <details className="rounded-2xl bg-sky-soft p-3 text-sm" open>
      <summary className="cursor-pointer font-black text-sky-dark">🤖 Android / dator</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 font-semibold">
        <li><b>Android:</b> Inställningar → System → Språk och inmatning → <b>Text till tal</b> → Googles talmotor → Installera röstdata → <b>Kinesiska (Mandarin)</b>.</li>
        <li><b>Windows:</b> Inställningar → Tid och språk → Tal → Lägg till röster → <b>Kinesiska (förenklad, Kina)</b>.</li>
        <li><b>Mac:</b> Systeminställningar → Hjälpmedel → Uppläst innehåll → Systemröst → Hantera röster → Kinesiska.</li>
        <li>Chrome på dator har oftast redan en Google-röst för kinesiska.</li>
      </ol>
    </details>
  )
}

function Backup() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = () => {
    const json = exportProgress()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nihao-backup-${localDay()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    setMsg({ ok: true, text: 'Säkerhetskopian har sparats.' })
  }

  const doImport = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    const ok = importProgress(text)
    setMsg(ok ? { ok: true, text: 'Framstegen har återställts från filen. 🎉' } : { ok: false, text: 'Filen kunde inte läsas. Är det en säkerhetskopia från Nǐ hǎo?' })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section>
      <SectionTitle>Säkerhetskopia</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink-muted">Dina framsteg sparas bara på den här enheten. Exportera en fil för att flytta dem till en annan telefon eller spara dem säkert.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={doExport}>Exportera</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importera</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void doImport(e.target.files?.[0])} />
        {msg && <p className={`rounded-xl p-2.5 text-sm font-bold ${msg.ok ? 'bg-brand-soft text-brand-dark' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
      </Card>
    </section>
  )
}

function ResetButton() {
  const { resetAll } = useProgress()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" className="w-full text-danger" onClick={() => setOpen(true)}>Återställ framsteg</Button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="reset-title">
        <div className="text-center">
          <div className="mb-2 text-5xl">😱</div>
          <h2 id="reset-title" className="text-xl font-black">Återställa allt?</h2>
          <p className="mt-1 mb-5 font-semibold text-ink-muted">All XP, din streak, lektioner och repetitioner raderas. Det går inte att ångra. Tips: exportera en säkerhetskopia först.</p>
          <div className="grid gap-2">
            <Button variant="danger" onClick={() => { resetAll(); setOpen(false) }}>Ja, återställ</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Avbryt</Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
