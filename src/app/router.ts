// Tiny hash router for the five tabs. #/learn, #/practice, #/games, #/words, #/profile
// (#/review from v1 maps to practice).
import { useCallback, useEffect, useState } from 'react'

export type Tab = 'learn' | 'practice' | 'games' | 'words' | 'profile'
export const TABS: Tab[] = ['learn', 'practice', 'games', 'words', 'profile']
const ALIASES: Record<string, Tab> = { review: 'practice' }

function readTab(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0]
  if (ALIASES[h]) return ALIASES[h]
  return (TABS as string[]).includes(h) ? (h as Tab) : 'learn'
}

export function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(readTab)
  useEffect(() => {
    const on = () => setTab(readTab())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((t: Tab) => {
    if (readTab() !== t) window.location.hash = `/${t}`
    setTab(t)
    window.scrollTo({ top: 0 })
  }, [])
  return [tab, go]
}
