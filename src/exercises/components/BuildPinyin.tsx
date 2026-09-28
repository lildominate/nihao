import { useEffect, useState } from 'react'
import { speak } from '../../speech'
import { PinyinText } from '../../speech/PinyinText'
import { checkBuild } from '../check'
import { getSentence, wordByPinyin } from '../items'
import { Instruction, PromptCard, type ExProps } from './common'
import { explainBuild } from './explain'
import { sfx } from './util'
import { TileBuilder } from './TileBuilder'

/** Swedish sentence shown → build it from pinyin tiles. */
export function BuildPinyin({ ex, course, settings, verdict, setChecker }: ExProps<'build-pinyin'>) {
  const s = getSentence(course, ex.item)
  const [picked, setPicked] = useState<number[]>([])
  useEffect(() => {
    if (!s) return setChecker(null)
    setChecker(picked.length === 0 ? null : () =>
      checkBuild('build-pinyin', s, picked.map((i) => ex.tiles[i]))
        ? { status: 'correct' }
        : { status: 'wrong', answer: { pinyin: s.chunks.join(' ') }, explain: explainBuild(picked.map((i) => ex.tiles[i]), s.chunks) })
  }, [picked, ex, s, setChecker])

  const onTapTile = (t: string) => {
    const w = wordByPinyin(course, t.replace(/[^\p{L}\s]/gu, '').trim(), s?.wordIds)
    if (w) void speak(w.hanzi, { rate: settings.speechRate })
    else sfx(settings, 'tap')
  }

  return (
    <div className="flex flex-col gap-6">
      <Instruction>Översätt till kinesiska</Instruction>
      <PromptCard className="self-start text-xl">{s?.sv}</PromptCard>
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
