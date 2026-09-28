// Applies settings.theme ('system' | 'light' | 'dark') and settings.reduceMotion to <html>.
// index.html applies the saved theme before first paint; this keeps it live afterwards.
import { useEffect } from 'react'
import type { Settings } from '../types'

const META_LIGHT = '#fbf5ec'
const META_DARK = '#15131a'

function apply(dark: boolean) {
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? META_DARK : META_LIGHT)
}

export function useThemeSync(settings: Settings) {
  const theme = settings.theme ?? 'system'
  useEffect(() => {
    if (theme !== 'system') { apply(theme === 'dark'); return }
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    apply(!!mq?.matches)
    const on = () => apply(!!mq?.matches)
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [theme])

  const reduce = !!settings.reduceMotion
  useEffect(() => {
    const root = document.documentElement
    if (reduce) root.dataset.reduceMotion = 'true'
    else delete root.dataset.reduceMotion
  }, [reduce])
}
