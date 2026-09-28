// OWNER: Games agent. Memory — match audio/pinyin cards with Swedish cards.
import { useMemo, useRef, useState } from 'react'
import { PinyinText, playSfx, speak } from '../../speech'
import { celebrate, haptic } from '../../motion'
import { svLabel } from '../logic/pool'
import { shuffle } from '../logic/random'
import { closeOpen, flip, isDone, memoryColumns, newMemory, type MemoryState } from '../logic/memory'
import { memoryScore, memoryStars } from '../logic/scoring'
import { AnswerTracker, wordRef } from '../logic/session'
import { GameFrame, practisedWords, useGameLoop, usePause, type GameProps } from '../ui/kit'

const PAIRS = 6

function Speaker() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a.8.8 0 0 0 1.3-.6V5.4a.8.8 0 0 0-1.3-.6L8 8.5H5a1 1 0 0 0-1 1Z" /><path d="M16.2 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
}

export function Memory({ words, reduced, toneColors, onEnd, onExit }: GameProps) {
  const chosen = useMemo(() => shuffle(words).slice(0, Math.min(PAIRS, words.length)), [words])
  const byId = useMemo(() => new Map(chosen.map((w) => [w.id, w])), [chosen])
  const [state, setState] = useState<MemoryState>(() => newMemory(chosen))
  const [paused, setPaused] = usePause()
  const [lastMatch, setLastMatch] = useState<string | null>(null)
  const [wrongPair, setWrongPair] = useState<number[]>([])
  const tracker = useRef(new AnswerTracker())
  const playMs = useRef(0)
  const started = useRef(false)
  const done = useRef(false)
  const [finished, setFinished] = useState(false)
  const timerRef = useRef<HTMLSpanElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const closeTimer = useRef<number | null>(null)
  const shownSec = useRef(-1)

  useGameLoop(paused || finished, (dt) => {
    if (!started.current) return
    playMs.current += dt
    const s = Math.floor(playMs.current / 1000)
    if (s !== shownSec.current && timerRef.current) {
      shownSec.current = s
      timerRef.current.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    }
  })

  const finish = (final: MemoryState) => {
    done.current = true
    setFinished(true)
    const result = tracker.current.result(playMs.current)
    const score = memoryScore(chosen.length, final.moves, playMs.current)
    const stars = memoryStars(chosen.length, final.moves)
    const secs = Math.round(playMs.current / 1000)
    window.setTimeout(() => onEnd({
      score,
      result,
      practised: practisedWords(result, byId),
      headline: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${final.moves} drag för ${chosen.length} par`,
      stats: [
        { label: 'Drag', value: String(final.moves) },
        { label: 'Tid', value: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` },
        { label: 'Par', value: String(chosen.length) },
      ],
    }), 900)
  }

  const onCard = (idx: number) => {
    if (paused || done.current) return
    let s = state
    if (s.open.length === 2) { // tap during mismatch display → close immediately
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
      s = closeOpen(s)
      setWrongPair([])
    }
    const { state: ns, event } = flip(s, idx)
    if (event.kind === 'ignored') { if (ns !== state) setState(ns); return }
    started.current = true
    const w = byId.get(event.card.wordId)!
    if (event.card.face === 'pinyin') void speak(w.hanzi)
    if (event.kind === 'first') playSfx('tap')
    if (event.kind === 'match') {
      if (event.card.face === 'sv') void speak(w.hanzi)
      playSfx('correct')
      haptic('success')
      tracker.current.record(wordRef(w.id), true)
      setLastMatch(w.id)
      celebrate('burst', { from: cardRefs.current[idx] ?? undefined, intensity: 0.7 })
      if (isDone(ns)) finish(ns)
    }
    if (event.kind === 'mismatch') {
      if (event.blame) {
        tracker.current.record(wordRef(event.blame), false)
        playSfx('wrong')
        haptic('error')
      }
      setWrongPair(ns.open)
      closeTimer.current = window.setTimeout(() => {
        setState((cur) => closeOpen(cur))
        setWrongPair([])
      }, 1000)
    }
    setState(ns)
  }

  const cols = memoryColumns(state.cards.length)
  const hud = (
    <div className="flex items-center justify-between">
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Drag</span>
        <span key={state.moves} className="g-bump text-2xl font-black tabular-nums">{state.moves}</span>
      </div>
      <span className="text-lg font-black">Memory</span>
      <div className="flex flex-col items-end leading-none">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">Tid</span>
        <span ref={timerRef} className="text-2xl font-black tabular-nums">0:00</span>
      </div>
    </div>
  )

  return (
    <GameFrame title="Memory" paused={paused} setPaused={setPaused} reduced={reduced} hud={hud}
      onExit={() => onExit(tracker.current.answered ? tracker.current.result(playMs.current) : null)}>
      <div className="flex h-full flex-col px-3 pb-3">
        <p className="py-1 text-center text-sm font-bold text-ink-muted">
          {lastMatch ? <>Par! <PinyinText pinyin={byId.get(lastMatch)!.pinyin} colored={toneColors} /> = {svLabel(byId.get(lastMatch)!)}</> : 'Hitta paren: lyssna på pinyin, matcha med svenska.'}
        </p>
        <div className="relative min-h-0 flex-1">
          <div className="grid h-full gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gridAutoRows: '1fr' }}>
            {state.cards.map((c, i) => {
              const w = byId.get(c.wordId)!
              const up = state.open.includes(i) || state.matched.includes(c.wordId)
              const matched = state.matched.includes(c.wordId)
              const wrong = wrongPair.includes(i)
              return (
                <button key={c.uid} ref={(el) => { cardRefs.current[i] = el }} type="button"
                  aria-label={up ? (c.face === 'pinyin' ? w.pinyin : svLabel(w)) : 'Dolt kort'}
                  onClick={() => onCard(i)}
                  className={`press g-card min-h-0 ${wrong ? 'g-shake' : ''}`}>
                  <div className={`g-card-inner ${up ? 'is-up' : ''}`}>
                    <div className="g-face flex items-center justify-center rounded-2xl border-b-4 border-violet-800 bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md">
                      <svg viewBox="0 0 40 40" className="h-10 w-10 opacity-90" aria-hidden="true">
                        <circle cx="20" cy="20" r="15" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
                        <text x="20" y="27" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff">?</text>
                      </svg>
                    </div>
                    <div className={`g-face g-face-front flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-b-4 px-1.5 text-center leading-tight
                      ${matched ? 'border-brand-dark bg-brand-soft' : wrong ? 'border-red-400 bg-danger-soft' : c.face === 'pinyin' ? 'border-sky bg-sky-soft' : 'border-amber-400 bg-amber-50'}`}>
                      {c.face === 'pinyin' ? (
                        <>
                          <span className="text-sky-dark"><Speaker /></span>
                          <PinyinText pinyin={w.pinyin} colored={toneColors} className="text-lg font-black" />
                        </>
                      ) : (
                        <span className="text-[15px] font-extrabold text-ink">{svLabel(w)}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div ref={layerRef} className="pointer-events-none absolute inset-0" />
        </div>
      </div>
    </GameFrame>
  )
}
