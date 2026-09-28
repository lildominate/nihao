// Playground-only fixture: the lesson-engine fixture course + notes + a dialogue, and a hand-made
// exercise list that covers every v2 exercise type (the generator may not emit them yet).
import type { Course, Exercise } from '../../types'
import { fixtureCourse } from '../fixture.test-data'

export const playCourse: Course = {
  ...fixtureCourse,
  words: {
    ...fixtureCourse.words,
    shui: { ...fixtureCourse.words.shui, note: 'Tänk ”schwej” som när man dyker ner i vattnet och kommer upp igen – ner och upp, precis som 3:e tonen.' },
    'ni-hao': { ...fixtureCourse.words['ni-hao'], note: 'Två 3:e toner i rad: den första blir stigande när du säger det (ní hǎo).' },
  },
  dialogues: {
    'u1-d1': {
      id: 'u1-d1',
      unitId: 'u1',
      kind: 'dialogue',
      title: 'På kaféet',
      context: 'Du möter en vän på ett kafé i Peking.',
      speakers: { A: 'Du', B: 'Lì' },
      afterLessonId: 'u1-l1',
      lines: [
        { speaker: 'B', hanzi: '你好！', chunks: ['nǐ', 'hǎo', '!'], sv: 'Hej!', wordIds: ['ni-hao'] },
        { speaker: 'A', hanzi: '你好！你好吗？', chunks: ['nǐ', 'hǎo', '!', 'nǐ', 'hǎo', 'ma', '?'], sv: 'Hej! Hur mår du?', wordIds: ['ni-hao', 'ni', 'hao', 'ma'] },
        { speaker: 'B', hanzi: '我很好，谢谢。你喝茶吗？', chunks: ['wǒ', 'hěn', 'hǎo', ',', 'xiè xie', '.', 'nǐ', 'hē', 'chá', 'ma', '?'], sv: 'Jag mår bra, tack. Dricker du te?', wordIds: ['wo', 'hao', 'xie-xie', 'ni', 'he', 'cha', 'ma'] },
        { speaker: 'A', hanzi: '我喝水。', chunks: ['wǒ', 'hē', 'shuǐ', '.'], sv: 'Jag dricker vatten.', wordIds: ['wo', 'he', 'shui'] },
      ],
    },
  },
}

export const v2Exercises: Exercise[] = [
  { type: 'intro', item: { kind: 'word', id: 'shui' } },
  { type: 'intro', item: { kind: 'word', id: 'ni-hao' } },
  { type: 'fill-blank', item: { kind: 'sentence', id: 's-wo-he-shui' }, blankIndex: 2, options: ['shuǐ', 'shuì', 'chá', 'fàn'], answer: 'shuǐ' },
  { type: 'listen-build', item: { kind: 'sentence', id: 's-ta-chi-fan' }, tiles: ['chī', 'tā', 'fàn', 'hē', 'wǒ'] },
  { type: 'dialogue-reply', item: { kind: 'line', id: 'u1-d1:3' }, options: ['wǒ hē shuǐ .', 'wǒ chī fàn .', 'zài jiàn !'], answer: 'wǒ hē shuǐ .' },
  { type: 'shadow', item: { kind: 'line', id: 'u1-d1:1' } },
  { type: 'dialogue-reply', item: { kind: 'line', id: 'u1-d1:1' }, options: ['nǐ hǎo ! nǐ hǎo ma ?', 'xiè xie !', 'tā chī fàn .'], answer: 'nǐ hǎo ! nǐ hǎo ma ?' },
  { type: 'shadow', item: { kind: 'word', id: 'xie-xie' } },
  { type: 'sv-to-pinyin', item: { kind: 'word', id: 'shui' }, options: ['shuǐ', 'shuì', 'chá'], answer: 'shuǐ' },
  { type: 'tone-pick', item: { kind: 'word', id: 'cha' }, syllable: 'chá', answer: 2 },
  { type: 'type-pinyin', item: { kind: 'word', id: 'shui' } },
  { type: 'build-pinyin', item: { kind: 'sentence', id: 's-wo-he-shui' }, tiles: ['hē', 'shuǐ', 'wǒ', 'chá'] },
  { type: 'listen-choose', item: { kind: 'word', id: 'cha' }, options: ['te', 'vatten', 'mat'], answer: 'te' },
]
