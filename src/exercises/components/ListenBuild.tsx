import { useEffect, useMemo, useState } from 'react'
import { PinyinText } from '../../speech/PinyinText'
import { SpeakButton } from '../../speech/SpeakButton'
import { Instruction, type ExProps } from './common'
import { explainBuild } from './explain'
import { infoFor, pinyinKey } from './lineInfo'
import { sfx } from './util'
import { TileBuilder } from './TileBuilder'

/** Audio only (no Swedish, no pinyin) → build what you heard from pinyin tiles. */
export function ListenBuild({ ex, course, settings, verdict, setChecker }: ExProps<'listen-build'>) {
  const info = useMemo(() => infoFor(course, ex.item), [course, ex.item])
  const [picked, setPicked] = useState<number[]>([])
  useEffect(() => {
    if (!info.hanzi) return setChecker(null)
    setChecker(picked.length === 0 ? null : () => {
      const built = picked.map((i) => ex.tiles[i])
      return pinyinKey(built.join(' ')) === pinyinKey(info.chunks.join(' '))
        ? { status: 'correct' }
        : { status: 'wrong', answer: { pinyin: info.chunks.join(' ') }, explain: explainBuild(built, info.chunks) }
    })
  }, [picked, ex, info.hanzi, info.chunks, setChecker])

  // Tiles are NOT voiced here: that would let the learner match sounds instead of listening.
  const onTapTile = () => sfx(settings, 'tap')

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Bygg det du hör</Instruction>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-end justify-center gap-4">
          <SpeakButton hanzi={info.hanzi} size="lg" autoPlay rate={settings.speechRate} />
          <SpeakButton hanzi={info.hanzi} size="md" slow rate={settings.speechRate} />
        </div>
        <div className="flex min-h-7 items-center text-center" aria-live="polite">
          {verdict
            ? <span className="animate-fade text-ink-muted">”{info.sv}”</span>
            : <span className="text-sm font-bold text-ink-muted">Bara ljud – lyssna så många gånger du vill</span>}
        </div>
      </div>
      <TileBuilder
        tiles={ex.tiles}
        picked={picked}
        onChange={setPicked}
        locked={!!verdict}
        onTapTile={onTapTile}
        render={(t) => <PinyinText pinyin={t} colored={settings.toneColors} />}
      />
    </div>
  )
}
