// Fixture course with themes — tests and the dev harness only.
import type { Course, Word } from '../types'

const W = (id: string, pinyin: string, sv: string, emoji: string): Word => ({ id, hanzi: id.toUpperCase() + pinyin, pinyin, sv, emoji })
const words = [
  W('ping-guo', 'píng guǒ', 'äpple', '🍎'), W('shui', 'shuǐ', 'vatten', '💧'), W('mi-fan', 'mǐ fàn', 'ris', '🍚'),
  W('cha', 'chá', 'te', '🍵'), W('ji-dan', 'jī dàn', 'ägg', '🥚'), W('mian-bao', 'miàn bāo', 'bröd', '🍞'),
  W('gou', 'gǒu', 'hund', '🐶'), W('mao', 'māo', 'katt', '🐱'), W('niao', 'niǎo', 'fågel', '🐦'), W('yu', 'yú', 'fisk', '🐟'),
  W('che', 'chē', 'bil', '🚗'), W('chuan', 'chuán', 'båt', '🚢'),
]

export const fixtureThemed: Course = {
  words: Object.fromEntries(words.map((w) => [w.id, w])),
  sentences: {},
  units: [],
  themes: [
    { id: 't-food', title: 'Mat', emoji: '🍎', words: ['ping-guo', 'shui', 'mi-fan', 'cha', 'ji-dan', 'mian-bao', 'nope'] },
    { id: 't-animals', title: 'Djur', emoji: '🐶', words: ['gou', 'mao', 'niao', 'yu'] },
    { id: 't-cars', title: 'Fordon', emoji: '🚗', words: ['che', 'chuan'] },
  ],
}
