// "Låtlektion": learn a song from an embedded YouTube video + lyrics the LEARNER pastes.
// No lyrics are bundled in the app: the pasted text lives only in this device's localStorage,
// so nothing song-related is published with the (public) code. Pinyin is generated on-device.
import { useEffect, useMemo, useRef, useState } from 'react'
import { course } from '../data/course'
import { PinyinText, speak, stopSpeaking } from '../speech'
import { useProgress } from '../progress'
import { Button } from '../ui/Button'
import { Panda } from '../mascot/Panda'
import { useReducedMotion } from '../motion'
import { useYouTubeState, youtubeEmbedUrl } from '../videos/youtube'

export interface SongDef { id: string; title: string; youtubeId: string }

/** The version the learner asked for ("Red Sun in the Sky"). Embedded via YouTube's own player. */
export const SONGS: SongDef[] = [
  { id: 'red-sun', title: 'Red Sun in the Sky', youtubeId: 'OjNpRbNdR7E' },
  { id: 'jin-sheng-yuan', title: 'Jīn shēng yuán – 川子', youtubeId: '4v5-532xqY8' },
]

type Store = Record<string, unknown>
function load<T>(key: string, id: string, fallback: T): T {
  try { return ((JSON.parse(localStorage.getItem(key) ?? '{}') as Store)[id] as T) ?? fallback } catch { return fallback }
}
function save(key: string, id: string, value: unknown) {
  try {
    const all = JSON.parse(localStorage.getItem(key) ?? '{}') as Store
    all[id] = value
    localStorage.setItem(key, JSON.stringify(all))
  } catch { /* storage unavailable */ }
}
const LYRICS_KEY = 'nihao/songs/v1'
/** The learner's own Swedish line translations: { songId: { lineIndex: text } }. */
const SV_KEY = 'nihao/song-sv/v1'

const HAN = /\p{Script=Han}/u
/** "[主歌一]" (verse 1) and other [bracketed] lines are section headings, not lyrics. */
export const isHeading = (line: string) => /^[[【].*[\]】]$/.test(line)

/** Swedish label for common Chinese section headings; otherwise the heading as-is. */
export function sectionLabel(line: string): string {
  const inner = line.slice(1, -1)
  const rest = inner.replace(/^(主歌|副歌|间奏|桥段)/, '')
  const n = rest ? '一二三四五六七八九十'.indexOf(rest) + 1 : 0
  if (inner.startsWith('主歌')) return n ? `Vers ${n}` : 'Vers'
  if (inner.startsWith('副歌')) return n ? `Refräng ${n}` : 'Refräng'
  if (inner.startsWith('间奏')) return 'Mellanspel'
  if (inner.startsWith('桥段')) return 'Stick'
  return inner
}

/** Course words whose hanzi occur in the line (longest first, non-overlapping). */
export function knownWordsIn(line: string): { hanzi: string; pinyin: string; sv: string }[] {
  const words = Object.values(course.words).filter((w) => w.hanzi.length > 0).sort((a, b) => b.hanzi.length - a.hanzi.length)
  const used = new Array(line.length).fill(false)
  const found: { at: number; hanzi: string; pinyin: string; sv: string }[] = []
  for (const w of words) {
    let i = line.indexOf(w.hanzi)
    while (i >= 0) {
      if (!used.slice(i, i + w.hanzi.length).some(Boolean)) {
        for (let k = i; k < i + w.hanzi.length; k++) used[k] = true
        found.push({ at: i, hanzi: w.hanzi, pinyin: w.pinyin, sv: w.sv.split('/')[0] })
      }
      i = line.indexOf(w.hanzi, i + 1)
    }
  }
  return found.sort((a, b) => a.at - b.at).map(({ hanzi, pinyin, sv }) => ({ hanzi, pinyin, sv }))
}

/** Pānpan "music video": an original stage where Pānpan dances while the song plays. */
interface StageCaption { pinyin: string; sv?: string; pos: string }

function PanpanStage({ playing, caption, onPrev, onNext }: {
  playing: boolean
  caption: StageCaption | null
  onPrev: () => void
  onNext: () => void
}) {
  const reduced = useReducedMotion()
  const dance = playing && !reduced
  // "Lip-sync": alternate open/closed-mouth moods while the song plays.
  const [mouthOpen, setMouthOpen] = useState(false)
  useEffect(() => {
    if (!playing) { setMouthOpen(false); return }
    const t = setInterval(() => setMouthOpen((o) => !o), 380)
    return () => clearInterval(t)
  }, [playing])
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-line shadow-card" style={{ aspectRatio: '4 / 3', background: 'linear-gradient(180deg, #ffd9a8 0%, #ffb37a 45%, #7cc6a4 46%, #4fa884 100%)' }}>
      <style>{`
        @keyframes nh-dance { 0%,100% { transform: translateY(0) rotate(-7deg) } 25% { transform: translateY(-14px) rotate(0deg) } 50% { transform: translateY(0) rotate(7deg) } 75% { transform: translateY(-14px) rotate(0deg) } }
        @keyframes nh-note { 0% { transform: translateY(0) scale(.8); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(-120px) scale(1.2); opacity: 0 } }
        @keyframes nh-sun { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
        @keyframes nh-sway { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
      `}</style>
      {/* sun */}
      <div className="absolute top-[8%] left-1/2 h-[34%] w-[34%] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle, #ff6b4a 55%, rgba(255,107,74,0) 72%)', animation: dance ? 'nh-sun 1.2s ease-in-out infinite' : undefined }} />
      {/* bamboo + lanterns */}
      {[8, 88].map((left, k) => (
        <div key={k} className="absolute bottom-[40%] h-[45%] w-2 rounded-full bg-emerald-700/70" style={{ left: `${left}%`, transformOrigin: 'bottom', animation: dance ? `nh-sway ${1.6 + k * 0.3}s ease-in-out infinite` : undefined }} />
      ))}
      {[20, 72].map((left, k) => (
        <div key={k} className="absolute top-[6%] h-7 w-6 rounded-lg bg-red-600 shadow-[0_0_14px_rgba(255,80,60,.8)]" style={{ left: `${left}%`, transformOrigin: 'top', animation: dance ? `nh-sway ${1.4 + k * 0.4}s ease-in-out infinite` : undefined }} />
      ))}
      {/* music notes */}
      {dance && ['♪', '♫', '♪', '♬'].map((n, k) => (
        <span key={k} aria-hidden="true" className="absolute bottom-[42%] text-2xl font-black text-white drop-shadow" style={{ left: `${22 + k * 18}%`, animation: `nh-note 2.4s ease-out ${k * 0.6}s infinite` }}>{n}</span>
      ))}
      {/* Pānpan */}
      <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2">
        <div style={{ animation: dance ? 'nh-dance 0.9s ease-in-out infinite' : undefined }}>
          <Panda mood={playing ? (mouthOpen ? 'surprised' : 'cheer') : 'wave'} size={130} />
        </div>
      </div>
      <div className="absolute right-3 bottom-3 rounded-full bg-black/35 px-3 py-1 text-xs font-bold text-white">
        {playing ? 'Pānpan sjunger ♪' : 'Tryck play på videon ↓'}
      </div>
      {/* Subtitles: the learner steps lines in time with the song (YouTube gives no lyric timing). */}
      {caption && (
        <div className="absolute inset-x-2 top-2 flex items-center gap-1 rounded-2xl bg-black/55 p-2 text-white backdrop-blur-sm">
          <button type="button" onClick={onPrev} aria-label="Föregående rad" className="press shrink-0 rounded-full px-2 py-1 text-lg font-black">◀</button>
          <div className="min-w-0 flex-1 text-center" aria-live="polite">
            <div className="text-lg leading-tight font-black">{caption.pinyin}</div>
            {caption.sv && <div className="text-xs font-bold opacity-85">{caption.sv}</div>}
            <div className="text-[10px] font-bold opacity-60">{caption.pos}</div>
          </div>
          <button type="button" onClick={onNext} aria-label="Nästa rad" className="press shrink-0 rounded-full px-2 py-1 text-lg font-black">▶</button>
        </div>
      )}
    </div>
  )
}

export function SongLesson({ song, onClose }: { song: SongDef; onClose: () => void }) {
  const { state } = useProgress()
  const rate = state.settings.speechRate
  const [text, setText] = useState(() => load(LYRICS_KEY, song.id, ''))
  const [editing, setEditing] = useState(() => !load(LYRICS_KEY, song.id, ''))
  const [sv, setSv] = useState<Record<number, string>>(() => load(SV_KEY, song.id, {}))
  const [svEdit, setSvEdit] = useState<number | null>(null)
  const [toPinyin, setToPinyin] = useState<((s: string) => string) | null>(null)
  const [singing, setSinging] = useState<number | null>(null) // line index Pānpan is on
  const [current, setCurrent] = useState<number | null>(null) // line shown on the stage
  const run = useRef(0)
  const frame = useRef<HTMLIFrameElement>(null)
  const videoPlaying = useYouTubeState(frame) === 1
  const listRef = useRef<HTMLOListElement>(null)

  // pinyin-pro is large: load it only when a song is opened.
  useEffect(() => {
    let alive = true
    void import('pinyin-pro').then(({ pinyin }) => {
      if (alive) setToPinyin(() => (s: string) => pinyin(s, { toneType: 'symbol', nonZh: 'consecutive' }))
    })
    return () => { alive = false; run.current++; stopSpeaking() }
  }, [])

  const lines = useMemo(() => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean), [text])
  const hasHan = lines.some((l) => HAN.test(l) && !isHeading(l))
  const lyricIdx = useMemo(() => lines.map((l, i) => (!isHeading(l) && HAN.test(l) ? i : -1)).filter((i) => i >= 0), [lines])
  const shown = singing ?? current ?? lyricIdx[0] ?? null
  const step = (dir: 1 | -1) => {
    if (!lyricIdx.length) return
    const at = shown === null ? -1 : lyricIdx.indexOf(shown)
    setCurrent(lyricIdx[Math.min(lyricIdx.length - 1, Math.max(0, at + dir))])
  }
  const caption: StageCaption | null = editing || shown === null || !toPinyin ? null : {
    pinyin: toPinyin(lines[shown]),
    sv: sv[shown],
    pos: `Rad ${lyricIdx.indexOf(shown) + 1} av ${lyricIdx.length}`,
  }
  const setLineSv = (i: number, t: string) => { const next = { ...sv, [i]: t }; setSv(next); save(SV_KEY, song.id, next) }

  // Karaoke: Pānpan reads the lyric lines one after another, highlighting the current one.
  const sing = async (from = 0) => {
    const token = ++run.current
    for (let i = from; i < lines.length; i++) {
      if (token !== run.current) return
      if (isHeading(lines[i]) || !HAN.test(lines[i])) continue
      setSinging(i)
      listRef.current?.querySelector(`[data-line="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const t0 = Date.now()
      await speak(lines[i], { rate })
      // Without a Chinese voice speak() returns at once — keep each line up long enough to read.
      const rest = Math.max(0, lines[i].length * 280 - (Date.now() - t0))
      await new Promise((r) => setTimeout(r, 500 + rest))
    }
    if (token === run.current) { setSinging(null) }
  }
  const stop = () => { run.current++; stopSpeaking(); setSinging(null) }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { stop(); onClose() }} aria-label="Stäng" className="press rounded-full p-2 text-2xl text-ink-muted">✕</button>
          <h1 className="flex-1 text-xl font-black">🎵 {song.title}</h1>
        </div>

        <PanpanStage playing={videoPlaying} caption={caption} onPrev={() => step(-1)} onNext={() => step(1)} />

        {/* YouTube's player must stay visible (YouTube API terms); it drives the music. */}
        <div className="mx-auto w-3/4 overflow-hidden rounded-2xl border-2 border-line bg-black shadow-card" style={{ aspectRatio: '16 / 9' }}>
          <iframe
            ref={frame}
            className="h-full w-full"
            src={youtubeEmbedUrl(song.youtubeId)}
            title={song.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        {editing ? (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-4">
            <p className="font-bold">Klistra in låttexten med kinesiska tecken.</p>
            <p className="text-sm text-ink-muted">Texten sparas bara på din telefon. Rader inom [hakparenteser] blir rubriker. Appen gör om resten till pinyin och läser upp varje rad.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Klistra in texten här…"
              className="w-full rounded-xl border-2 border-line bg-surface-2 p-3 text-lg outline-none focus:border-sky"
            />
            {text && !hasHan && (
              <p className="rounded-xl bg-warn/15 p-3 text-sm font-bold">Texten saknar kinesiska tecken. Ljudskrift som "hong tong tong" går inte att göra om till rätt pinyin – klistra in texten med tecken.</p>
            )}
            <Button disabled={!hasHan} onClick={() => { save(LYRICS_KEY, song.id, text); setEditing(false) }}>Spara</Button>
          </div>
        ) : (
          <>
            {/* Karaoke bar: Pānpan "sings" (reads) the song line by line. */}
            <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3">
              <div className={`relative shrink-0 ${singing !== null ? 'bounce-soft' : 'float'}`}>
                <Panda mood={singing !== null ? 'cheer' : 'happy'} size={64} />
                {singing !== null && <span aria-hidden="true" className="absolute -top-2 -right-2 animate-bounce text-xl">🎵</span>}
              </div>
              <div className="flex-1 text-sm font-bold text-ink-muted">
                {singing !== null ? 'Pānpan läser låten rad för rad…' : 'Låt Pānpan läsa hela låten, rad för rad.'}
              </div>
              {singing !== null
                ? <Button variant="secondary" onClick={stop}>Stopp</Button>
                : <Button onClick={() => void sing(0)} disabled={!toPinyin}>▶ Sjung</Button>}
            </div>

            {!toPinyin && <p className="text-center text-ink-muted">Förbereder pinyin…</p>}
            <ol ref={listRef} className="flex flex-col gap-3">
              {lines.map((line, i) => {
                if (isHeading(line)) {
                  return <li key={i} className="px-1 pt-2 text-xs font-black tracking-wider text-ink-muted uppercase">{sectionLabel(line)}</li>
                }
                const han = HAN.test(line)
                const words = han ? knownWordsIn(line) : []
                const active = singing === i
                return (
                  <li key={i} data-line={i} className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => { stop(); setCurrent(i); if (han) void speak(line, { rate }) }}
                      className={`press w-full rounded-2xl border-2 border-b-4 p-3 text-left transition-colors ${active ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}
                    >
                      {han && toPinyin ? (
                        <PinyinText pinyin={toPinyin(line)} colored={state.settings.toneColors} className="text-lg font-bold" />
                      ) : (
                        <span className="text-lg font-bold">{line}</span>
                      )}
                      {state.settings.showHanzi && han && <div className="text-sm text-ink-muted">{line}</div>}
                      {words.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {words.map((w, k) => (
                            <span key={k} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-dark">{w.pinyin} = {w.sv}</span>
                          ))}
                        </div>
                      )}
                    </button>
                    {han && (svEdit === i ? (
                      <input
                        autoFocus
                        defaultValue={sv[i] ?? ''}
                        onBlur={(e) => { setLineSv(i, e.target.value.trim()); setSvEdit(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="Skriv vad raden betyder på svenska…"
                        aria-label={`Svensk översättning, rad ${i + 1}`}
                        className="rounded-xl border-2 border-sky bg-surface px-3 py-2 outline-none"
                      />
                    ) : (
                      <button type="button" onClick={() => setSvEdit(i)} className="px-3 text-left text-sm font-bold text-ink-muted">
                        {sv[i] ? <>🇸🇪 {sv[i]} <span className="text-sky">· ändra</span></> : <span className="text-sky">＋ Lägg till svensk översättning</span>}
                      </button>
                    ))}
                  </li>
                )
              })}
            </ol>
            <p className="text-center text-sm text-ink-muted">Tryck på en rad för att höra den. Gröna brickor = ord du känner igen från kursen.</p>
            <Button variant="secondary" onClick={() => { stop(); setEditing(true) }}>Ändra texten</Button>
          </>
        )}
      </div>
    </div>
  )
}

export function SongsCard() {
  const [open, setOpen] = useState<SongDef | null>(null)
  return (
    <>
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-b-4 border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <Panda mood="cheer" size={56} />
          <div>
            <h2 className="text-lg font-black">Låtlektioner</h2>
            <p className="text-sm text-ink-muted">Lyssna på låten och lär dig texten rad för rad.</p>
          </div>
        </div>
        {SONGS.map((s) => (
          <Button key={s.id} variant="secondary" onClick={() => setOpen(s)}>🎵 {s.title}</Button>
        ))}
      </div>
      {open && <SongLesson song={open} onClose={() => setOpen(null)} />}
    </>
  )
}
