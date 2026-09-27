import { describe, expect, it } from 'vitest'
import { checkTypedPinyin, numbersToMarks, parsePinyin, stripTones, syllablesOf, toneColorVar } from './pinyin'

describe('numbersToMarks', () => {
  it.each([
    ['shui3', 'shuǐ'],
    ['ni3 hao3', 'nǐ hǎo'],
    ['ni3hao3', 'nǐhǎo'],
    ['lv4', 'lǜ'],
    ['lu:4', 'lǜ'],
    ['nv3', 'nǚ'],
    ['lve4', 'lüè'],
    ['hao3', 'hǎo'],
    ['xie4 xie5', 'xiè xie'],
    ['ma0', 'ma'],
    ['gou3', 'gǒu'],
    ['liu2', 'liú'],
    ['gui4', 'guì'],
    ['zhuang1', 'zhuāng'],
    ['er4', 'èr'],
    ['xiong2', 'xióng'],
    ['Zhong1guo2', 'Zhōngguó'],
    ['ni3 hao3 ma5 ?', 'nǐ hǎo ma ?'],
    ['Rui4 dian3', 'Ruì diǎn'],
    ['no numbers', 'no numbers'],
  ])('%s → %s', (input, out) => {
    expect(numbersToMarks(input)).toBe(out)
  })
})

describe('stripTones', () => {
  it('removes marks but keeps ü and case', () => {
    expect(stripTones('shuǐ')).toBe('shui')
    expect(stripTones('lǜ')).toBe('lü')
    expect(stripTones('Ruì diǎn rén')).toBe('Rui dian ren')
    expect(stripTones('nǐ hǎo ma ?')).toBe('ni hao ma ?')
  })
})

describe('parsePinyin', () => {
  it('parses spaced syllables and punctuation', () => {
    const s = parsePinyin('nǐ hǎo ma ?')
    expect(s.map((x) => [x.text, x.base, x.tone, x.isPunct])).toEqual([
      ['nǐ', 'ni', 3, false],
      ['hǎo', 'hao', 3, false],
      ['ma', 'ma', 5, false],
      ['?', '?', 5, true],
    ])
  })
  it('handles all four tones and ü', () => {
    expect(parsePinyin('mā má mǎ mà ma lǜ').map((x) => x.tone)).toEqual([1, 2, 3, 4, 5, 4])
    expect(parsePinyin('lǜ')[0].base).toBe('lü')
  })
  it('splits attached punctuation', () => {
    expect(parsePinyin('hǎo!').map((x) => x.text)).toEqual(['hǎo', '!'])
    expect(parsePinyin('hǎo，').map((x) => x.isPunct)).toEqual([false, true])
  })
  it('keeps capitalisation in text, lowercases base', () => {
    const [r] = parsePinyin('Ruì')
    expect(r.text).toBe('Ruì')
    expect(r.base).toBe('rui')
    expect(r.tone).toBe(4)
  })
  it('segments unspaced words', () => {
    expect(parsePinyin('nǐhǎo').map((x) => [x.text, x.tone])).toEqual([['nǐ', 3], ['hǎo', 3]])
    expect(parsePinyin('zhōngguó').map((x) => x.text)).toEqual(['zhōng', 'guó'])
    expect(parsePinyin('xièxie').map((x) => x.tone)).toEqual([4, 5])
    expect(parsePinyin("xī'ān").filter((x) => !x.isPunct).map((x) => x.text)).toEqual(['xī', 'ān'])
  })
  it('does not split long single syllables', () => {
    expect(parsePinyin('zhuāng').length).toBe(1)
    expect(parsePinyin('xiǎng').length).toBe(1)
    expect(parsePinyin('shuǐ').length).toBe(1)
  })
  it('accepts tone numbers', () => {
    expect(parsePinyin('ni3 hao3').map((x) => [x.text, x.tone])).toEqual([['nǐ', 3], ['hǎo', 3]])
  })
  it('handles empty input', () => {
    expect(parsePinyin('')).toEqual([])
    expect(parsePinyin('   ')).toEqual([])
  })
  it('syllablesOf drops punctuation and uses v for ü', () => {
    expect(syllablesOf('lǜ chá !')).toEqual([{ base: 'lv', tone: 4 }, { base: 'cha', tone: 2 }])
  })
})

describe('checkTypedPinyin', () => {
  it('accepts exact marks', () => {
    expect(checkTypedPinyin('nǐ hǎo', 'nǐ hǎo')).toBe('exact')
  })
  it('accepts numbers, no spaces, any case', () => {
    expect(checkTypedPinyin('ni3 hao3', 'nǐ hǎo')).toBe('exact')
    expect(checkTypedPinyin('ni3hao3', 'nǐ hǎo')).toBe('exact')
    expect(checkTypedPinyin('NI3 HAO3', 'nǐ hǎo')).toBe('exact')
    expect(checkTypedPinyin('shui3', 'shuǐ')).toBe('exact')
    expect(checkTypedPinyin('nǐhǎo', 'nǐ hǎo')).toBe('exact')
  })
  it('ignores punctuation', () => {
    expect(checkTypedPinyin('ni3 hao3 ma', 'nǐ hǎo ma ?')).toBe('exact')
    expect(checkTypedPinyin('ni3 hao3 ma?!', 'nǐ hǎo ma ?')).toBe('exact')
    expect(checkTypedPinyin("xi1'an1", 'xī ān')).toBe('exact')
  })
  it('neutral tone may be omitted, or written 5 / 0', () => {
    expect(checkTypedPinyin('xie4 xie', 'xiè xie')).toBe('exact')
    expect(checkTypedPinyin('xie4xie5', 'xiè xie')).toBe('exact')
    expect(checkTypedPinyin('xie4 xie0', 'xiè xie')).toBe('exact')
    expect(checkTypedPinyin('xie4 xie4', 'xiè xie')).toBe('tones-wrong')
  })
  it('handles ü as v, u: or ü', () => {
    expect(checkTypedPinyin('lv4', 'lǜ')).toBe('exact')
    expect(checkTypedPinyin('lu:4', 'lǜ')).toBe('exact')
    expect(checkTypedPinyin('lü4', 'lǜ')).toBe('exact')
    expect(checkTypedPinyin('lǜ', 'lǜ')).toBe('exact')
    expect(checkTypedPinyin('lu4', 'lǜ')).toBe('tones-wrong')
    expect(checkTypedPinyin('nv3 ren2', 'nǚ rén')).toBe('exact')
  })
  it('flags missing / wrong tones', () => {
    expect(checkTypedPinyin('ni hao', 'nǐ hǎo')).toBe('tones-wrong')
    expect(checkTypedPinyin('ni2 hao3', 'nǐ hǎo')).toBe('tones-wrong')
    expect(checkTypedPinyin('shui', 'shuǐ')).toBe('tones-wrong')
    expect(checkTypedPinyin('ní hǎo', 'nǐ hǎo')).toBe('tones-wrong')
  })
  it('flags wrong letters', () => {
    expect(checkTypedPinyin('ni3 hai3', 'nǐ hǎo')).toBe('wrong')
    expect(checkTypedPinyin('', 'nǐ hǎo')).toBe('wrong')
    expect(checkTypedPinyin('ni3', 'nǐ hǎo')).toBe('wrong')
    expect(checkTypedPinyin('shi4', 'sì')).toBe('wrong')
  })
  it('proper nouns and multi-syllable chunks', () => {
    expect(checkTypedPinyin('rui4dian3 ren2', 'Ruì diǎn rén')).toBe('exact')
    expect(checkTypedPinyin('Wo3 shi4 Rui4dian3ren2.', 'wǒ shì Ruì diǎn rén .')).toBe('exact')
  })
})

describe('toneColorVar', () => {
  it('maps to css vars', () => {
    expect(toneColorVar(1)).toBe('var(--tone-1)')
    expect(toneColorVar(5)).toBe('var(--tone-5)')
  })
})
