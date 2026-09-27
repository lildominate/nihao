// Small fixture course for lesson-engine tests / dev. Not used by the app.
import type { Course, Word } from '../types'

const words: Word[] = [
  { id: 'ni-hao', hanzi: '你好', pinyin: 'nǐ hǎo', sv: 'hej', svAlt: ['hallå'], pos: 'phrase' },
  { id: 'xie-xie', hanzi: '谢谢', pinyin: 'xiè xie', sv: 'tack', pos: 'phrase' },
  { id: 'zai-jian', hanzi: '再见', pinyin: 'zài jiàn', sv: 'hej då', pos: 'phrase' },
  { id: 'wo', hanzi: '我', pinyin: 'wǒ', sv: 'jag', pos: 'pron' },
  { id: 'ni', hanzi: '你', pinyin: 'nǐ', sv: 'du', pos: 'pron' },
  { id: 'ta', hanzi: '他', pinyin: 'tā', sv: 'han', pos: 'pron' },
  { id: 'shi', hanzi: '是', pinyin: 'shì', sv: 'är', svAlt: ['vara'], pos: 'verb' },
  { id: 'he', hanzi: '喝', pinyin: 'hē', sv: 'dricka', pos: 'verb' },
  { id: 'chi', hanzi: '吃', pinyin: 'chī', sv: 'äta', pos: 'verb' },
  { id: 'shui', hanzi: '水', pinyin: 'shuǐ', sv: 'vatten', pos: 'noun' },
  { id: 'cha', hanzi: '茶', pinyin: 'chá', sv: 'te', pos: 'noun' },
  { id: 'fan', hanzi: '饭', pinyin: 'fàn', sv: 'mat', svAlt: ['ris'], pos: 'noun' },
  { id: 'ma', hanzi: '吗', pinyin: 'ma', sv: '(frågepartikel)', pos: 'particle' },
  { id: 'hao', hanzi: '好', pinyin: 'hǎo', sv: 'bra', pos: 'adj' },
  { id: 'hai', hanzi: '嗨', pinyin: 'hāi', sv: 'hej', pos: 'phrase' },
]

export const fixtureCourse: Course = {
  words: Object.fromEntries(words.map((w) => [w.id, w])),
  sentences: {
    's-wo-he-shui': { id: 's-wo-he-shui', hanzi: '我喝水', chunks: ['wǒ', 'hē', 'shuǐ'], sv: 'Jag dricker vatten', svChunks: ['Jag', 'dricker', 'vatten'], wordIds: ['wo', 'he', 'shui'] },
    's-ni-hao-ma': { id: 's-ni-hao-ma', hanzi: '你好吗？', chunks: ['nǐ', 'hǎo', 'ma', '?'], sv: 'Hur mår du?', svChunks: ['Hur', 'mår', 'du?'], svAlt: ['Mår du bra?'], wordIds: ['ni', 'hao', 'ma'] },
    's-ta-chi-fan': { id: 's-ta-chi-fan', hanzi: '他吃饭', chunks: ['tā', 'chī', 'fàn'], sv: 'Han äter mat', svChunks: ['Han', 'äter', 'mat'], wordIds: ['ta', 'chi', 'fan'] },
  },
  units: [
    {
      id: 'u1', title: 'Hälsningar', description: 'Säg hej', emoji: '👋',
      lessons: [
        { id: 'u1-l1', title: 'Hej!', kind: 'standard', newWords: ['ni-hao', 'xie-xie', 'zai-jian', 'wo', 'ni'], sentences: ['s-ni-hao-ma'] },
        { id: 'u1-t', title: 'Toner', kind: 'tones', newWords: ['ma', 'hao', 'shui', 'cha'], sentences: [] },
        { id: 'u1-l2', title: 'Mat', kind: 'standard', newWords: ['he', 'chi', 'shui', 'cha', 'fan'], sentences: ['s-wo-he-shui', 's-ta-chi-fan'] },
        { id: 'u1-cp', title: 'Kontrollpunkt', kind: 'checkpoint', newWords: [], sentences: [] },
      ],
    },
  ],
}
