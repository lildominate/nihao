// OWNER: Games agent. Restaurangrusch menu data (pure). Pinyin follows OUR convention: tone marks, syllables
// space-separated, base tones with no written sandhi (yī fèn, bù yào). Where a dish exists in course.words
// (`wordId`), resolveMenu() replaces hanzi/pinyin/sv with the course entry so the two never drift apart.
import type { Word } from '../../types'

export interface MenuItem {
  id: string
  sv: string
  hanzi: string
  pinyin: string
  emoji: string
  kind: 'dish' | 'drink'
  /** Course word id if this exact item exists in course.words (first attempts are recorded for those). */
  wordId?: string
  /** Hot dishes: may be ordered "bù yào là". */
  spicy?: boolean
  /** Measure word used when ordering by count: fèn (portion), wǎn (bowl), bēi (glass), píng (bottle). */
  mw: Measure
}

export type Measure = 'fèn' | 'wǎn' | 'bēi' | 'píng'
export const MEASURE_ZH: Record<Measure, string> = { fèn: '份', wǎn: '碗', bēi: '杯', píng: '瓶' }
/** Swedish counting phrase [one, many]. */
export const MEASURE_SV: Record<Measure, [string, string]> = {
  fèn: ['en portion', 'portioner'], wǎn: ['en skål', 'skålar'], bēi: ['ett glas', 'glas'], píng: ['en flaska', 'flaskor'],
}

export const MENU: MenuItem[] = [
  { id: 'chao-fan', sv: 'stekt ris', hanzi: '炒饭', pinyin: 'chǎo fàn', emoji: '🍳', kind: 'dish', mw: 'wǎn' },
  { id: 'jiao-zi', sv: 'dumplings', hanzi: '饺子', pinyin: 'jiǎo zi', emoji: '🥟', kind: 'dish', wordId: 'jiao-zi', mw: 'fèn' },
  { id: 'niu-rou-mian', sv: 'nötköttsnudlar', hanzi: '牛肉面', pinyin: 'niú ròu miàn', emoji: '🍜', kind: 'dish', spicy: true, mw: 'wǎn' },
  { id: 'mi-fan', sv: 'ris', hanzi: '米饭', pinyin: 'mǐ fàn', emoji: '🍚', kind: 'dish', wordId: 'mi-fan', mw: 'wǎn' },
  { id: 'mian-tiao', sv: 'nudlar', hanzi: '面条', pinyin: 'miàn tiáo', emoji: '🍝', kind: 'dish', wordId: 'mian-tiao', mw: 'wǎn' },
  { id: 'gong-bao-ji-ding', sv: 'kung pao-kyckling', hanzi: '宫保鸡丁', pinyin: 'gōng bǎo jī dīng', emoji: '🍗', kind: 'dish', spicy: true, mw: 'fèn' },
  { id: 'ma-po-dou-fu', sv: 'mapo tofu', hanzi: '麻婆豆腐', pinyin: 'má pó dòu fu', emoji: '🌶️', kind: 'dish', spicy: true, mw: 'fèn' },
  { id: 'bao-zi', sv: 'ångad bulle', hanzi: '包子', pinyin: 'bāo zi', emoji: '🥯', kind: 'dish', mw: 'fèn' },
  { id: 'chun-juan', sv: 'vårrulle', hanzi: '春卷', pinyin: 'chūn juǎn', emoji: '🌯', kind: 'dish', mw: 'fèn' },
  { id: 'hun-tun', sv: 'wonton', hanzi: '馄饨', pinyin: 'hún tun', emoji: '🥣', kind: 'dish', mw: 'wǎn' },
  { id: 'tang', sv: 'soppa', hanzi: '汤', pinyin: 'tāng', emoji: '🍲', kind: 'dish', mw: 'wǎn' },
  { id: 'kao-ya', sv: 'pekingand', hanzi: '北京烤鸭', pinyin: 'běi jīng kǎo yā', emoji: '🦆', kind: 'dish', mw: 'fèn' },
  { id: 'yu', sv: 'fisk', hanzi: '鱼', pinyin: 'yú', emoji: '🐟', kind: 'dish', wordId: 'yu', mw: 'fèn' },
  { id: 'shou-si', sv: 'sushi', hanzi: '寿司', pinyin: 'shòu sī', emoji: '🍣', kind: 'dish', mw: 'fèn' },
  { id: 'xiao-long-bao', sv: 'soppdumplings', hanzi: '小笼包', pinyin: 'xiǎo lóng bāo', emoji: '🥡', kind: 'dish', mw: 'fèn' },
  { id: 'ji-dan', sv: 'ägg', hanzi: '鸡蛋', pinyin: 'jī dàn', emoji: '🥚', kind: 'dish', wordId: 'ji-dan', mw: 'fèn' },
  { id: 'shu-cai', sv: 'grönsaker', hanzi: '蔬菜', pinyin: 'shū cài', emoji: '🥬', kind: 'dish', wordId: 'shu-cai', mw: 'fèn' },
  { id: 'shui-guo', sv: 'frukt', hanzi: '水果', pinyin: 'shuǐ guǒ', emoji: '🍎', kind: 'dish', wordId: 'shui-guo', mw: 'fèn' },
  { id: 'shui', sv: 'vatten', hanzi: '水', pinyin: 'shuǐ', emoji: '💧', kind: 'drink', wordId: 'shui', mw: 'bēi' },
  { id: 'cha', sv: 'te', hanzi: '茶', pinyin: 'chá', emoji: '🍵', kind: 'drink', wordId: 'cha', mw: 'bēi' },
  { id: 'nai-cha', sv: 'bubbelte', hanzi: '奶茶', pinyin: 'nǎi chá', emoji: '🧋', kind: 'drink', mw: 'bēi' },
  { id: 'ka-fei', sv: 'kaffe', hanzi: '咖啡', pinyin: 'kā fēi', emoji: '☕', kind: 'drink', wordId: 'ka-fei', mw: 'bēi' },
  { id: 'pi-jiu', sv: 'öl', hanzi: '啤酒', pinyin: 'pí jiǔ', emoji: '🍺', kind: 'drink', wordId: 'pi-jiu', mw: 'píng' },
  { id: 'niu-nai', sv: 'mjölk', hanzi: '牛奶', pinyin: 'niú nǎi', emoji: '🥛', kind: 'drink', wordId: 'niu-nai', mw: 'bēi' },
  { id: 'guo-zhi', sv: 'juice', hanzi: '果汁', pinyin: 'guǒ zhī', emoji: '🧃', kind: 'drink', wordId: 'guo-zhi', mw: 'bēi' },
  { id: 'lu-cha', sv: 'grönt te', hanzi: '绿茶', pinyin: 'lǜ chá', emoji: '🫖', kind: 'drink', mw: 'bēi' },
  { id: 'ke-le', sv: 'cola', hanzi: '可乐', pinyin: 'kě lè', emoji: '🥤', kind: 'drink', mw: 'bēi' },
]

/** Pseudo card for "bù yào là" (no chili). Not a dish: it is only ever part of an order's tray. */
export const NO_SPICY_ID = 'no-spicy'
export const NO_SPICY: MenuItem = { id: NO_SPICY_ID, sv: 'inte starkt', hanzi: '不要辣', pinyin: 'bù yào là', emoji: '🌶️🚫', kind: 'dish', mw: 'fèn' }
/** Pseudo card for "bù yào ròu" (no meat). Same rules as NO_SPICY. */
export const NO_MEAT_ID = 'no-meat'
export const NO_MEAT: MenuItem = { id: NO_MEAT_ID, sv: 'utan kött', hanzi: '不要肉', pinyin: 'bù yào ròu', emoji: '🥩🚫', kind: 'dish', mw: 'fèn' }
export const WISH_IDS: readonly string[] = [NO_SPICY_ID, NO_MEAT_ID]

/** Menu with course pinyin/hanzi/sv substituted where the dish exists as a course word. */
export function resolveMenu(wordsById: ReadonlyMap<string, Word> | Record<string, Word>, menu: readonly MenuItem[] = MENU): MenuItem[] {
  const get = (id: string) => (wordsById instanceof Map ? wordsById.get(id) : (wordsById as Record<string, Word>)[id])
  return menu.map((m) => {
    const w = m.wordId ? get(m.wordId) : undefined
    return w ? { ...m, hanzi: w.hanzi, pinyin: w.pinyin } : m
  })
}
