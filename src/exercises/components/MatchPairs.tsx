import { useEffect, useRef, useState } from 'react'
import type { ItemRef } from '../../types'
import { speak } from '../../speech'
import { PinyinText } from '../../speech/PinyinText'
import { itemInfo, itemKey } from '../items'
import { Instruction, type ExProps } from './common'
import { sfx } from './util'

function shuffled<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

type Side = 'left' | 'right'

/** Two columns: pinyin ↔ Swedish. Tap one of each; tapping pinyin plays audio. */
export function MatchPairs({ ex, course, settings, verdict, submit }: ExProps<'match-pairs'>) {
  const [left] = useState(() => shuffled(ex.items))
  const [right] = useState(() => shuffled(ex.items))
  const [sel, setSel] = useState<{ left?: string; right?: string }>({})
  const [matched, setMatched] = useState<Set<string>>(() => new Set())
  const [flash, setFlash] = useState<{ left: string; right: string } | null>(null)
  const [justMatched, setJustMatched] = useState<string | null>(null)
  const missed = useRef(new Map<string, ItemRef>())
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }

  const tap = (side: Side, r: ItemRef) => {
    const k = itemKey(r)
    if (verdict || matched.has(k)) return
    if (flash) setFlash(null)
    if (side === 'left') void speak(itemInfo(course, r).hanzi, { rate: settings.speechRate })
    else sfx(settings, 'tap')
    const next = { ...sel, [side]: sel[side] === k ? undefined : k }
    if (next.left && next.right) {
      if (next.left === next.right) {
        const m = new Set(matched).add(k)
        setMatched(m)
        setJustMatched(k)
        setSel({})
        if (m.size === ex.items.length) {
          later(() => submit({ status: 'correct', mistakeItems: [...missed.current.values()] }), 350)
        }
      } else {
        sfx(settings, 'wrong')
        for (const key of [next.left, next.right]) {
          const item = ex.items.find((x) => itemKey(x) === key)
          if (item) missed.current.set(key, item)
        }
        setFlash({ left: next.left, right: next.right })
        setSel({})
        later(() => setFlash(null), 500)
      }
    } else {
      setSel(next)
    }
  }

  const tileClass = (side: Side, k: string) => {
    if (matched.has(k)) return justMatched === k ? 'border-brand bg-brand-soft text-brand-dark animate-pop opacity-60' : 'border-line bg-surface-2 text-ink-muted opacity-40'
    if (flash && flash[side] === k) return 'border-danger bg-danger-soft text-danger animate-[nh-shake_0.4s_ease-in-out]'
    if (sel[side] === k) return 'border-sky bg-sky-soft text-sky-dark'
    return 'border-line bg-surface text-ink hover:bg-surface-2'
  }

  const base = 'flex min-h-16 w-full items-center justify-center rounded-2xl border-2 border-b-4 px-2 py-2 text-center font-bold transition-colors active:translate-y-0.5 active:border-b-2 disabled:active:translate-y-0 disabled:active:border-b-4'

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Para ihop</Instruction>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-3">
          {left.map((r) => {
            const k = itemKey(r)
            const info = itemInfo(course, r)
            return (
              <button key={k} type="button" disabled={matched.has(k)} onClick={() => tap('left', r)} className={`${base} text-xl ${tileClass('left', k)}`}>
                <span className="flex flex-col items-center">
                  <PinyinText pinyin={info.pinyin} colored={settings.toneColors && !matched.has(k)} />
                  {settings.showHanzi && <span className="text-xs font-normal text-ink-muted" lang="zh-CN">{info.hanzi}</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-3">
          {right.map((r) => {
            const k = itemKey(r)
            return (
              <button key={k} type="button" disabled={matched.has(k)} onClick={() => tap('right', r)} className={`${base} text-lg ${tileClass('right', k)}`}>
                <span className="break-words">{itemInfo(course, r).sv}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
