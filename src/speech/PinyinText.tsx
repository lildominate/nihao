// OWNER: Voice agent. Renders pinyin with per-syllable tone colours (respects settings.toneColors via prop).
import { Fragment, useMemo } from 'react'
import { parsePinyin, toneTextClass } from './pinyin'

/**
 * Pinyin with each syllable coloured by tone (colored defaults to true).
 * Keeps the source spacing; punctuation is not coloured. Tone numbers ("ni3") are shown as marks.
 */
export function PinyinText({ pinyin, colored = true, className }: { pinyin: string; colored?: boolean; className?: string }) {
  const parts = useMemo(
    () => pinyin.split(/(\s+)/).filter(Boolean).map((tok) => (/^\s+$/.test(tok) ? tok : parsePinyin(tok))),
    [pinyin],
  )
  return (
    <span className={className} lang="zh-Latn-pinyin">
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <Fragment key={i}>{part}</Fragment>
        ) : (
          <Fragment key={i}>
            {part.map((s, j) =>
              s.isPunct || !colored ? (
                <Fragment key={j}>{s.text}</Fragment>
              ) : (
                <span key={j} className={toneTextClass(s.tone)}>{s.text}</span>
              ),
            )}
          </Fragment>
        ),
      )}
    </span>
  )
}
