// "Videokurs": the ChineseFor.Us channel's playlists, watched inside the app via YouTube's
// embedded player, with ✓ per video, progress per playlist and XP the first time a video is done.
// The video list (ids + titles) is fetched at build time by scripts/fetch-videos.mjs.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProgress } from '../progress'
import { celebrate, haptic } from '../motion'
import { playSfx } from '../speech'
import { Button } from '../ui/Button'
import { Panda } from '../mascot/Panda'
import { useYouTubeState, youtubeEmbedUrl } from './youtube'

export interface Video { id: string; title: string }
export interface Playlist { id: string; title: string; videos: Video[] }
interface VideoData { channel: { id: string; title: string }; fetchedAt: string; playlists: Playlist[]; uploads: Video[] }

/** Beginner-first order. Playlists matching HIDE are left out (the learner doesn't study characters). */
const ORDER = [/complete beginners/i, /chinese alphabet/i, /new hsk 1 level|hsk 3\.0/i, /upper beginner chinese course/i, /upper beginner/i,
  /basic beginner/i, /how to say/i, /speak.*native/i, /vocabulary/i, /lower intermediate/i, /intermediate/i, /listening and reading/i, /tones/i]
const HIDE = /write chinese characters|student spotlight|miniproject/i

export function orderPlaylists(lists: Playlist[]): Playlist[] {
  const rank = (p: Playlist) => { const i = ORDER.findIndex((r) => r.test(p.title)); return i < 0 ? ORDER.length : i }
  return lists.filter((p) => !HIDE.test(p.title)).sort((a, b) => rank(a) - rank(b))
}

const KEY = 'nihao/videos/v1'
type Done = Record<string, string> // videoId → "YYYY-MM-DD"
function loadDone(): Done {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { done?: Done }).done ?? {} } catch { return {} }
}
function saveDone(done: Done) {
  try { localStorage.setItem(KEY, JSON.stringify({ done })) } catch { /* storage unavailable */ }
}

function useVideoData(): VideoData | null {
  const [data, setData] = useState<VideoData | null>(null)
  useEffect(() => { void import('./videos.generated.json').then((m) => setData(m.default as VideoData)) }, [])
  return data
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function Player({ video, done, onDone, onNext, onBack }: { video: Video; done: boolean; onDone: () => void; onNext?: () => void; onBack: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const state = useYouTubeState(frame)
  // Auto-complete when the video plays to the end.
  useEffect(() => { if (state === 0 && !done) onDone() }, [state, done, onDone])
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="press self-start rounded-full px-2 py-1 font-bold text-ink-muted">← Tillbaka</button>
      <div className="overflow-hidden rounded-2xl border-2 border-line bg-black shadow-card" style={{ aspectRatio: '16 / 9' }}>
        <iframe ref={frame} key={video.id} className="h-full w-full" src={youtubeEmbedUrl(video.id)} title={video.title}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
      <h2 className="text-lg leading-snug font-black">{video.title}</h2>
      {done
        ? <p className="rounded-2xl bg-brand-soft p-3 text-center font-black text-brand-dark">✓ Klar – bra jobbat!</p>
        : <Button onClick={onDone}>✓ Markera som klar</Button>}
      {onNext && <Button variant="secondary" onClick={onNext}>Nästa video →</Button>}
      <p className="text-center text-xs text-ink-muted">Videon markeras som klar automatiskt när den har spelats till slut. Första gången ger den XP.</p>
    </div>
  )
}

export function VideoCourse({ onClose }: { onClose: () => void }) {
  const data = useVideoData()
  const { finishSession } = useProgress()
  const [done, setDone] = useState<Done>(loadDone)
  const [list, setList] = useState<Playlist | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)
  const started = useRef(Date.now())
  const playlists = useMemo(() => (data ? orderPlaylists(data.playlists) : []), [data])

  const markDone = (v: Video) => {
    if (done[v.id]) return
    const next = { ...done, [v.id]: new Date().toLocaleDateString('sv-SE') }
    setDone(next)
    saveDone(next)
    playSfx('correct')
    haptic('success')
    celebrate('burst')
    finishSession({ lessonId: null, source: 'video', total: 0, correct: 0, mistakes: 0, durationMs: Date.now() - started.current, items: [] })
    started.current = Date.now()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onClose} aria-label="Stäng" className="press rounded-full p-2 text-2xl text-ink-muted">✕</button>
          <h1 className="flex-1 text-xl font-black">📺 {list ? list.title : 'Videokurs'}</h1>
        </div>

        {!data && <p className="text-center text-ink-muted">Laddar videor…</p>}

        {data && list && playing !== null && (
          <Player
            video={list.videos[playing]}
            done={!!done[list.videos[playing].id]}
            onDone={() => markDone(list.videos[playing])}
            onNext={playing + 1 < list.videos.length ? () => { setPlaying(playing + 1); started.current = Date.now() } : undefined}
            onBack={() => setPlaying(null)}
          />
        )}

        {data && list && playing === null && (
          <>
            <button type="button" onClick={() => setList(null)} className="press self-start rounded-full px-2 py-1 font-bold text-ink-muted">← Alla serier</button>
            <ol className="flex flex-col gap-2">
              {list.videos.map((v, i) => (
                <li key={v.id}>
                  <button type="button" onClick={() => { setPlaying(i); started.current = Date.now() }}
                    className="press flex w-full items-center gap-3 rounded-2xl border-2 border-b-4 border-line bg-surface p-2 text-left">
                    <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 text-sm leading-snug font-bold">{i + 1}. {v.title}</span>
                    <span aria-label={done[v.id] ? 'Klar' : 'Inte klar'} className={`shrink-0 text-xl ${done[v.id] ? 'text-brand' : 'text-ink-faint'}`}>{done[v.id] ? '✓' : '○'}</span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}

        {data && !list && (
          <>
            <div className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3">
              <Panda mood="happy" size={56} />
              <p className="text-sm font-bold text-ink-muted">Videor från {data.channel.title}. Börja uppifrån – serierna är sorterade från nybörjare och uppåt.</p>
            </div>
            <ul className="flex flex-col gap-3">
              {playlists.map((p) => {
                const n = p.videos.filter((v) => done[v.id]).length
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => setList(p)} className="press flex w-full flex-col gap-2 rounded-2xl border-2 border-b-4 border-line bg-surface p-3 text-left">
                      <span className="leading-snug font-black">{p.title}</span>
                      <Bar value={n / p.videos.length} />
                      <span className="text-xs font-bold text-ink-muted">{n} av {p.videos.length} klara</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

export function VideoCourseCard() {
  const [open, setOpen] = useState(false)
  const doneCount = Object.keys(loadDone()).length
  return (
    <>
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-b-4 border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">📺</span>
          <div>
            <h2 className="text-lg font-black">Videokurs</h2>
            <p className="text-sm text-ink-muted">Lektioner från ChineseFor.Us · {doneCount} klara · XP för varje ny video</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>Öppna Videokurs</Button>
      </div>
      {open && <VideoCourse onClose={() => setOpen(false)} />}
    </>
  )
}
