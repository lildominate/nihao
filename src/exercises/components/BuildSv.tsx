import { useEffect, useState } from 'react'
import { SpeakButton } from '../../speech/SpeakButton'
import { checkBuild } from '../check'
import { getSentence } from '../items'
import { Instruction, ItemPinyin, type ExProps } from './common'
import { sfx } from './util'
import { TileBuilder } from './TileBuilder'

/** Audio + pinyin shown → build the Swedish translation from tiles. */
export function BuildSv({ ex, course, settings, verdict, setChecker }: ExProps<'build-sv'>) {
  const s = getSentence(course, ex.item)
  const [picked, setPicked] = useState<number[]>([])
  useEffect(() => {
    if (!s) return setChecker(null)
    setChecker(picked.length === 0 ? null : () =>
      checkBuild('build-sv', s, picked.map((i) => ex.tiles[i]))
        ? { status: 'correct' }
        : { status: 'wrong', answer: { text: s.sv, pinyin: s.chunks.join(' ') } })
  }, [picked, ex, s, setChecker])

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Översätt till svenska</Instruction>
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 flex-col gap-2">
          <SpeakButton hanzi={s?.hanzi ?? ''} size="md" autoPlay rate={settings.speechRate} />
          <SpeakButton hanzi={s?.hanzi ?? ''} size="sm" slow rate={settings.speechRate} className="self-center" />
        </div>
        <div className="rounded-2xl border-2 border-line px-4 py-3 text-2xl">
          <ItemPinyin pinyin={s?.chunks.join(' ') ?? ''} hanzi={s?.hanzi} settings={settings} />
        </div>
      </div>
      <TileBuilder
        tiles={ex.tiles}
        picked={picked}
        onChange={setPicked}
        locked={!!verdict}
        onTapTile={() => sfx(settings, 'tap')}
        render={(t) => t}
      />
    </div>
  )
}
