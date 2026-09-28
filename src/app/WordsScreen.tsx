// "Ord" — searchable word list grouped by unit, with a mastery meter per word.
import { useMemo, useState } from 'react'
import type { Word } from '../types'
import { course } from '../data/course'
import { useProgress } from '../progress'
import { PinyinText, SpeakButton } from '../speech'
import { Button } from '../ui/Button'
import { Badge, EmptyState, SegmentedControl } from '../ui/kit'
import { UnitArt } from '../ui/art/UnitArt'
import { TopBar } from './chrome'
import { SearchIcon, CloseIcon } from './icons'
import { fold, unitColor, wordUnitMap } from './util'

export function WordsScreen() {
  const { knownWordIds, state, mastery } = useProgress()
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
      <TopBar title="Ord" right={<Badge tone="plum" className="!text-sm">{known.size} lärda</Badge>} />
      <div className="sticky top-[calc(3.5rem+1px+env(safe-area-inset-top))] z-10 space-y-2.5 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
        <label className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface px-3 shadow-[inset_0_2px_0_rgb(0_0_0/0.03)] focus-within:border-plum">
          <SearchIcon size={20} className="shrink-0 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök pinyin eller svenska…"
            className="min-w-0 flex-1 bg-transparent py-2.5 font-bold outline-none placeholder:font-semibold placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
            autoCapitalize="off" autoCorrect="off" spellCheck={false}
          />
          {query && <button type="button" aria-label="Rensa" onClick={() => setQuery('')} className="text-ink-muted"><CloseIcon size={18} /></button>}
        </label>
        <SegmentedControl label="Visa" value={showAll ? 'all' : 'mine'} onChange={(v) => setShowAll(v === 'all')}
          options={[{ value: 'mine', label: 'Mina ord' }, { value: 'all', label: 'Alla ord i kursen' }]} />
      </div>

      {!courseHasWords ? (
        <EmptyState mood="think" title="Inga ord ännu">Kursinnehållet är inte på plats än.</EmptyState>
      ) : !showAll && known.size === 0 ? (
        <EmptyState mood="wave" title="Din ordbok är tom – än så länge" action={<Button variant="secondary" onClick={() => setShowAll(true)}>Visa alla ord</Button>}>
          Gör din första lektion så samlar Pānpan orden här.
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState mood="surprised" title="Inga träffar">Prova att söka utan toner, t.ex. <b className="text-ink">ni hao</b>.</EmptyState>
      ) : (
        <div className="px-4 pt-4 pb-10">
          {groups.map((g) => {
            const color = unitColor(g.index)
            const unit = course.units[g.index]
            return (
              <section key={g.key} className="mb-6">
                <div className="mb-2 flex items-center gap-2 px-1">
                  {unit && <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: color.soft }}><UnitArt unitId={unit.id} size={28} /></span>}
                  <h2 className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{unit ? unit.title : 'Övrigt'}</h2>
                  <span className="text-xs font-extrabold text-ink-faint">{g.words.length}</span>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-card">
                  {g.words.map((w) => {
                    const learned = known.has(w.id)
                    const m = mastery({ kind: 'word', id: w.id })
                    return (
                      <li key={w.id} className="flex items-center gap-3 px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <PinyinText pinyin={w.pinyin} colored={toneColors} className={`text-lg font-black ${learned ? '' : 'opacity-60'}`} />
                            {showHanzi && <span className="text-base text-ink-muted">{w.hanzi}</span>}
                          </div>
                          <div className="truncate text-sm font-semibold text-ink-muted">{w.sv}{w.svAlt?.length ? ` · ${w.svAlt.slice(0, 2).join(', ')}` : ''}</div>
                        </div>
                        {learned ? (
                          <span className="flex gap-[3px]" aria-label={`Kunskap ${m} av 5`}>
                            {[1, 2, 3, 4, 5].map((k) => <span key={k} className="h-3.5 w-1.5 rounded-full" style={{ background: k <= m ? color.bg : 'var(--color-surface-3)' }} />)}
                          </span>
                        ) : <Badge tone="neutral">ej lärt</Badge>}
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
