import { describe, expect, it } from 'vitest'
import { isHeading, knownWordsIn, sectionLabel, SONGS } from './SongLesson'

describe('song lessons', () => {
  it('ships no lyrics — only the video reference', () => {
    // Only video references — never bundled lyrics.
    expect(SONGS.map((x) => Object.keys(x).sort())).toEqual(SONGS.map(() => ['id', 'title', 'youtubeId']))
    expect(SONGS.map((x) => x.youtubeId)).toEqual(['OjNpRbNdR7E', '4v5-532xqY8'])
  })
  it('finds known course words in a pasted line (longest match first)', () => {
    expect(knownWordsIn('你好老师').map((w) => w.hanzi)).toEqual(['你好', '老师'])
  })
  it('treats [bracketed] lines as Swedish section headings', () => {
    expect(isHeading('[主歌一]')).toBe(true)
    expect(isHeading('你好')).toBe(false)
    expect(sectionLabel('[主歌二]')).toBe('Vers 2')
    expect(sectionLabel('[副歌]')).toBe('Refräng')
  })
})
