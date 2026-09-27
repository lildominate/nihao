// "Ord" — searchable word list grouped by unit (Shell).
import { useMemo, useState } from 'react'
import type { Word } from '../types'
import { course } from '../data/course'
import { useProgress } from '../progress'
import { PinyinText, SpeakButton } from '../speech'
import { Button } from '../ui/Button'
import { EmptyState, TopBar } from './chrome'
import { SearchIcon, CloseIcon } from './icons'
import { fold, unitColor, wordUnitMap } from './util'

export function WordsScreen() {
  const { knownWordIds, state } = useProgress()
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const known = useMemo(() => new Set(knownWordIds()), [knownWordIds])
  const unitOf = useMemo(() => wordUnitMap(course), [])
  const { toneColors, showHanzi } = state.settings

  const q = fold(query)
  const qNoSpace = q.replace(/ /g, '')
  const matches = (w: Word) => {
    if (!q) return true
    const py = fold(w.pinyin)
    return py.includes(q) || py.replace(/ /g, '').includes(qNoSpace)
      || fold(w.sv).includes(q) || (w.svAlt ?? []).some((a) => fold(a).includes(q))
      || (w.en ? fold(w.en).includes(q) : false) || w.hanzi.includes(query.trim())
  }

  // Groups in course order; words not introduced by any unit go in "Övrigt".
  const groups = (() => {
    const ids = showAll ? Object.keys(course.words) : [...known].filter((id) => course.words[id])
    const byUnit = new Map<string, Word[]>()
    for (const id of ids) {
      const w = course.words[id]
      if (!w || !matches(w)) continue
      const key = unitOf.get(id)?.id ?? '_other'
      byUnit.set(key, [...(byUnit.get(key) ?? []), w])
    }
    const out = course.units.map((u, i) => ({ key: u.id, title: `${u.emoji} ${u.title}`, index: i, words: byUnit.get(u.id) ?? [] }))
    out.push({ key: '_other', title: 'Övrigt', index: course.units.length, words: byUnit.get('_other') ?? [] })
    return out.filter((g) => g.words.length > 0)
  })()

  const total = groups.reduce((n, g) => n + g.words.length, 0)
  const courseHasWords = Object.keys(course.words).length > 0

  return (
    <>
      <TopBar title="Ord" right={<span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-black text-brand-dark">{known.size} lärda</span>} />
      <div className="sticky top-[calc(3.5rem+2px+env(safe-area-inset-top))] z-10 space-y-2 border-b-2 border-line bg-surface px-4 py-3">
        <label className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface-2 px-3 focus-within:border-sky">
          <SearchIcon size={20} className="shrink-0 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök pinyin eller svenska…"
            className="min-w-0 flex-1 bg-transparent py-2.5 font-bold outline-none placeholder:font-semibold placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
            autoCapitalize="off" autoCorrect="off" spellCheck={false}
          />
          {query && <button type="button" aria-label="Rensa" onClick={() => setQuery('')} className="text-ink-muted"><CloseIcon size={18} /></button>}
        </label>
        <div className="flex gap-2 text-sm font-extrabold">
          {[false, true].map((all) => (
            <button key={String(all)} type="button" onClick={() => setShowAll(all)}
              className={`rounded-full border-2 px-3 py-1 ${showAll === all ? 'border-sky bg-sky-soft text-sky-dark' : 'border-line text-ink-muted'}`}>
              {all ? 'Alla ord i kursen' : 'Mina ord'}
            </button>
          ))}
        </div>
      </div>

      {!courseHasWords ? (
        <EmptyState emoji="📚" title="Inga ord ännu">Kursinnehållet är inte på plats än.</EmptyState>
      ) : !showAll && known.size === 0 ? (
        <EmptyState emoji="🌱" title="Du har inte lärt dig några ord än">
          Gör din första lektion så samlas orden här.
          <div className="mt-4"><Button variant="secondary" onClick={() => setShowAll(true)}>Visa alla ord</Button></div>
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState emoji="🔍" title="Inga träffar">Prova att söka utan toner, t.ex. <b>ni hao</b>.</EmptyState>
      ) : (
        <div className="px-4 pt-3 pb-8">
          {groups.map((g) => {
            const color = unitColor(g.index)
            return (
              <section key={g.key} className="mb-5">
                <h2 className="mb-2 px-1 text-sm font-black tracking-wide uppercase" style={{ color: g.key === '_other' ? undefined : color.dark }}>{g.title}</h2>
                <ul className="divide-y-2 divide-line overflow-hidden rounded-3xl border-2 border-line">
                  {g.words.map((w) => {
                    const learned = known.has(w.id)
                    return (
                      <li key={w.id} className={`flex items-center gap-3 px-3 py-2.5 ${learned ? '' : 'bg-surface-2/60'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <PinyinText pinyin={w.pinyin} colored={toneColors} className="text-lg font-black" />
                            {showHanzi && <span className="text-base text-ink-muted">{w.hanzi}</span>}
                            {!learned && <span className="rounded-md bg-line px-1.5 text-[10px] font-extrabold tracking-wide text-ink-muted uppercase">ej lärt</span>}
                          </div>
                          <div className="truncate text-sm font-semibold text-ink-muted">{w.sv}{w.svAlt?.length ? ` · ${w.svAlt.slice(0, 2).join(', ')}` : ''}</div>
                        </div>
                        <SpeakButton hanzi={w.hanzi} size="sm" />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
