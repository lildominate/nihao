// Embedded YouTube player state via the IFrame postMessage protocol (no extra script).
// The embed URL needs `enablejsapi=1`. States: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export function youtubeEmbedUrl(id: string): string {
  const origin = typeof location !== 'undefined' ? `&origin=${encodeURIComponent(location.origin)}` : ''
  return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&enablejsapi=1${origin}`
}

export function useYouTubeState(frame: RefObject<HTMLIFrameElement | null>): number {
  const [state, setState] = useState(-1)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return
        if (e.source !== frame.current?.contentWindow) return
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        const s = d?.info?.playerState ?? (d?.event === 'onStateChange' ? d.info : undefined)
        if (typeof s === 'number') setState(s)
      } catch { /* not a player message */ }
    }
    window.addEventListener('message', onMessage)
    const hello = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'nihao' }), '*')
    const el = frame.current
    el?.addEventListener('load', hello)
    const t = setInterval(hello, 1500) // player may load late; the handshake is idempotent
    return () => { window.removeEventListener('message', onMessage); el?.removeEventListener('load', hello); clearInterval(t) }
  }, [frame])
  return state
}
