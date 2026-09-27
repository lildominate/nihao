// Tiny hash router for the four tabs (Shell). #/learn, #/review, #/words, #/profile
import { useCallback, useEffect, useState } from 'react'

export type Tab = 'learn' | 'review' | 'words' | 'profile'
const TABS: Tab[] = ['learn', 'review', 'words', 'profile']

function readTab(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '')
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
