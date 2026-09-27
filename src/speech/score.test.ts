import { describe, expect, it } from 'vitest'
import { digitsToHanzi, hanziToSyllables, scoreAlternatives } from './score'

describe('hanziToSyllables', () => {
  it('converts hanzi to toneless syllables with tones', () => {
    expect(hanziToSyllables('你好吗？')).toEqual([
      { base: 'ni', tone: 3 }, { base: 'hao', tone: 3 }, { base: 'ma', tone: 5 },
    ])
    expect(hanziToSyllables('绿')).toEqual([{ base: 'lv', tone: 4 }])
  })
  it('handles digits', () => {
    expect(digitsToHanzi('3个')).toBe('三个')
    expect(digitsToHanzi('12')).toBe('十二')
    expect(digitsToHanzi('20')).toBe('二十')
    expect(hanziToSyllables('3')).toEqual([{ base: 'san', tone: 1 }])
  })
})

describe('scoreAlternatives', () => {
  const nihao = { hanzi: '你好', pinyin: 'nǐ hǎo' }
  it('exact hanzi match is ok', () => {
    const r = scoreAlternatives(nihao, ['你好'])
    expect(r.ok).toBe(true)
    expect(r.score).toBe(1)
    expect(r.heardPinyin).toBe('nǐ hǎo')
  })
  it('homophones are ok (same pinyin, other characters)', () => {
    const r = scoreAlternatives({ hanzi: '是', pinyin: 'shì' }, ['事'])
    expect(r.ok).toBe(true)
    expect(r.score).toBeGreaterThan(0.9)
  })
  it('wrong tone still ok but lower score', () => {
    const r = scoreAlternatives({ hanzi: '买', pinyin: 'mǎi' }, ['卖'])
    expect(r.ok).toBe(true)
    expect(r.score).toBeLessThan(1)
  })
  it('different words are not ok', () => {
    const r = scoreAlternatives(nihao, ['谢谢'])
    expect(r.ok).toBe(false)
    expect(r.score).toBeLessThan(0.5)
  })
  it('picks the best of several alternatives', () => {
    const r = scoreAlternatives(nihao, ['谢谢', '你好啊', '泥好'])
    expect(r.ok).toBe(true)
    expect(r.heard).toBe('泥好')
  })
  it('ignores punctuation and neutral tone differences', () => {
    const r = scoreAlternatives({ hanzi: '谢谢', pinyin: 'xiè xie' }, ['谢谢！'])
    expect(r.ok).toBe(true)
    const r2 = scoreAlternatives({ hanzi: '谢谢你', pinyin: 'xiè xie nǐ' }, ['谢谢泥'])
    expect(r2.ok).toBe(true)
  })
  it('allows one miss in a long sentence', () => {
    const exp = { hanzi: '我是瑞典人', pinyin: 'wǒ shì Ruì diǎn rén .' }
    expect(scoreAlternatives(exp, ['我是瑞典人。']).ok).toBe(true)
    expect(scoreAlternatives(exp, ['我四瑞典人']).ok).toBe(true)
    expect(scoreAlternatives(exp, ['我是']).ok).toBe(false)
  })
  it('numbers from the recogniser', () => {
    expect(scoreAlternatives({ hanzi: '三', pinyin: 'sān' }, ['3']).ok).toBe(true)
  })
  it('empty input', () => {
    expect(scoreAlternatives(nihao, []).ok).toBe(false)
  })
})
