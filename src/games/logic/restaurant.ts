// OWNER: Games agent. Restaurangrusch logic (pure): scripted levels, tray check, counter, patience, scoring.
import { MEASURE_SV, MEASURE_ZH, NO_MEAT, NO_SPICY, WISH_IDS, type MenuItem } from './menu'
import { shuffle, type Rng } from './random'

export const CUSTOMERS = 8
export const LEVELS = 5
export const STARS = 3
export const GRID_SIZE = 6
/** Levels 4-5 also put the two wish cards on the counter. */
export const GRID_SIZE_WISH = 8
/** Pinyin is visible from the start on levels 1..PINYIN_FREE_LEVELS; later it needs a tap on the speaker. */
export const PINYIN_FREE_LEVELS = 2
/** How long a prelude line ("yǒu sù de ma?", the first order that gets corrected) stays up before the real order. */
export const PRELUDE_MS = 2200

export type Special = 'busy' | 'change' | 'vegetarian'

export interface Line { hanzi: string; pinyin: string; sv: string }

export interface Order {
  level: number
  special?: Special
  /** Tray the player must build (multiset of menu ids; wish ids for the "no chili" / "no meat" cards). */
  tray: string[]
  hanzi: string
  pinyin: string
  /** Swedish translation, shown after the serve. */
  sv: string
  /** Shown/spoken first; after PRELUDE_MS the bubble switches to hanzi/pinyin. */
  prelude?: Line
  /** Patience multiplier (stressed customers < 1). */
  patienceMul?: number
  /** Extra items that must be on the counter (e.g. what the customer first asked for). */
  decoys?: string[]
}

/** Patience budget in ms: shorter each level, longer for bigger orders. */
export function patienceMs(level: number, trayLen: number): number {
  const base = Math.max(9000, 20000 - 2500 * (level - 1))
  return base + 2500 * Math.max(0, trayLen - 1)
}

export function gridSize(level: number): number {
  return level >= 4 ? GRID_SIZE_WISH : GRID_SIZE
}

export function pinyinVisible(level: number, tapped: boolean): boolean {
  return level <= PINYIN_FREE_LEVELS || tapped
}

// ─── Scripted levels ─────────────────────────────────────────

interface Bit { py: string; zh: string; sv: string; ids: string[] }
interface Text { py: string; zh: string; sv: string }

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Builds one level's 8 customers from the (course-resolved) menu. Order within the level is shuffled. */
export function levelOrders(menu: readonly MenuItem[], level: number, rng: Rng = Math.random): Order[] {
  const by = new Map(menu.map((m) => [m.id, m]))
  const get = (id: string) => { const m = by.get(id); if (!m) throw new Error(`menu item ${id}`); return m }
  /** Counted: "yī fèn jiǎo zi" / "liǎng bēi kā fēi". */
  const n = (id: string, count = 1): Bit => {
    const m = get(id)
    const [one, many] = MEASURE_SV[m.mw]
    return {
      py: `${count === 1 ? 'yī' : 'liǎng'} ${m.mw} ${m.pinyin}`,
      zh: `${count === 1 ? '一' : '两'}${MEASURE_ZH[m.mw]}${m.hanzi}`,
      sv: count === 1 ? `${one} ${m.sv}` : `två ${many} ${m.sv}`,
      ids: Array<string>(count).fill(id),
    }
  }
  /** Bare word: "jiǎo zi". */
  const w = (id: string): Bit => { const m = get(id); return { py: m.pinyin, zh: m.hanzi, sv: m.sv, ids: [id] } }
  const wish = (m: MenuItem): Bit => ({ py: m.pinyin, zh: m.hanzi, sv: m.sv, ids: [m.id] })
  const NS = wish(NO_SPICY)
  const NM = wish(NO_MEAT)
  const comma = (bits: Bit[]): Text => ({ py: bits.map((b) => b.py).join(', '), zh: bits.map((b) => b.zh).join('，'), sv: cap(bits.map((b) => b.sv).join(', ')) })
  const and = (bits: Bit[]): Text => ({ py: bits.map((b) => b.py).join(' hé '), zh: bits.map((b) => b.zh).join('和'), sv: bits.map((b) => b.sv).join(' och ') })
  const mk = (bits: Bit[], t: Text, extra: Partial<Order> = {}): Order =>
    ({ level, tray: bits.flatMap((b) => b.ids), hanzi: t.zh, pinyin: t.py, sv: t.sv, ...extra })
  const list = (...bits: Bit[]) => mk(bits, comma(bits))
  const say = (prefix: Text, bits: Bit[]) => {
    const t = and(bits)
    return mk(bits, { py: `${prefix.py} ${t.py}`, zh: `${prefix.zh}${t.zh}`, sv: `${prefix.sv} ${t.sv}` })
  }
  const wantP: Text = { py: 'wǒ yào', zh: '我要', sv: 'Jag vill ha' }
  const giveP: Text = { py: 'qǐng gěi wǒ', zh: '请给我', sv: 'Snälla, ge mig' }
  const comeP: Text = { py: 'qǐng lái', zh: '请来', sv: 'Kan jag få' }
  const rush = (): Order => mk([n('niu-rou-mian'), n('ka-fei')], {
    py: 'kuài yī diǎn, yī wǎn niú ròu miàn, yī bēi kā fēi', zh: '快一点，一碗牛肉面，一杯咖啡', sv: 'Skynda på! En skål nötköttsnudlar och ett glas kaffe',
  }, { special: 'busy', patienceMul: 0.6 })

  let orders: Order[]
  switch (level) {
    case 1:
      orders = ['jiao-zi', 'mi-fan', 'shou-si', 'tang', 'bao-zi', 'mian-tiao', 'chun-juan', 'ji-dan'].map((id) => list(n(id)))
      break
    case 2:
      orders = [
        ['jiao-zi', 'cha'], ['niu-rou-mian', 'shui'], ['shou-si', 'lu-cha'], ['chao-fan', 'ka-fei'],
        ['xiao-long-bao', 'nai-cha'], ['tang', 'pi-jiu'], ['chun-juan', 'cha'], ['bao-zi', 'shui'],
      ].map(([a, b]) => list(n(a), n(b)))
      break
    case 3:
      orders = [
        ['jiao-zi', 'mi-fan'], ['niu-rou-mian', 'chun-juan'], ['shou-si', 'tang'], ['chao-fan', 'ji-dan'],
        ['xiao-long-bao', 'mian-tiao'], ['bao-zi', 'yu'], ['tang', 'jiao-zi'], ['chun-juan', 'mi-fan'],
      ].map(([a, b]) => say(wantP, [w(a), w(b)]))
      break
    case 4:
      orders = [
        list(n('jiao-zi'), NS),
        list(n('niu-rou-mian'), NS),
        list(n('chao-fan'), NM),
        list(n('bao-zi'), NM),
        list(n('ka-fei', 2)),
        list(n('mian-tiao'), NS, n('cha')),
        rush(),
        list(n('jiao-zi'), NS, n('shui')),
      ]
      break
    default: {
      const first = comma([n('jiao-zi'), n('ka-fei')])
      const second = comma([n('shou-si'), n('lu-cha')])
      const change = mk([n('shou-si'), n('lu-cha')], { py: `bù duì! ${second.py}`, zh: `不对！${second.zh}`, sv: `Nej, fel! ${second.sv}` },
        { special: 'change', prelude: { pinyin: first.py, hanzi: first.zh, sv: first.sv }, decoys: ['jiao-zi', 'ka-fei'] })
      const veg = mk([w('chun-juan'), w('mi-fan'), NM], { py: 'wǒ yào chūn juǎn hé mǐ fàn, bù yào ròu', zh: '我要春卷和米饭，不要肉', sv: 'Jag vill ha vårrulle och ris, utan kött' },
        { special: 'vegetarian', prelude: { pinyin: 'yǒu sù de ma?', hanzi: '有素的吗？', sv: 'Finns det något vegetariskt?' } })
      orders = [
        say(giveP, [n('jiao-zi'), n('cha')]),
        say(wantP, [n('niu-rou-mian')]),
        say(comeP, [n('ka-fei')]),
        say(wantP, [n('bao-zi', 2)]),
        say(giveP, [w('chun-juan'), w('yu'), w('pi-jiu')]),
        rush(), change, veg,
      ]
    }
  }
  return shuffle(orders, rng)
}

export const trayKey = (tray: readonly string[]) => [...tray].sort().join('|')

/** Multiset comparison: order on the tray does not matter, counts do. */
export function trayMatches(order: Pick<Order, 'tray'>, tray: readonly string[]): boolean {
  return trayKey(order.tray) === trayKey(tray)
}

/**
 * The cards on the counter: every item of the order (one card each - duplicates come from tapping twice),
 * padded with distractors, shuffled. Levels 4-5 always add both wish cards last, so they never give the answer away.
 * The UI shows no pinyin on the cards: the player has to understand the order.
 */
export function counterFor(order: Order, menu: readonly MenuItem[], rng: Rng = Math.random): MenuItem[] {
  const size = gridSize(order.level)
  const wishes = order.level >= 4
  const byId = new Map(menu.map((m) => [m.id, m]))
  const wanted = wishes ? size - WISH_IDS.length : size
  const need = [...new Set([...order.tray, ...(order.decoys ?? [])])].filter((id) => !WISH_IDS.includes(id))
  const cards = need.map((id) => byId.get(id)!).filter(Boolean)
  for (const m of shuffle(menu.filter((x) => !need.includes(x.id) && !WISH_IDS.includes(x.id)), rng)) {
    if (cards.length >= wanted) break
    cards.push(m)
  }
  const out = shuffle(cards, rng)
  if (wishes) out.push(NO_SPICY, NO_MEAT)
  return out
}

/** Tip for a served order: more for higher levels, patience left (0..1) and a streak. */
export function tipFor(level: number, patienceLeft: number, streak: number): number {
  const frac = Math.max(0, Math.min(1, patienceLeft))
  return Math.round(10 * level + 10 * level * frac + Math.min(streak, 5) * 5)
}

export function finalBonus(stars: number, completed: boolean): number {
  return completed ? 25 * Math.max(0, stars) : 0
}

/** Patience bar colour band. */
export function patienceMood(frac: number): 'happy' | 'ok' | 'angry' {
  return frac > 0.55 ? 'happy' : frac > 0.25 ? 'ok' : 'angry'
}

/** The four customer species, cycled in order so a shift always shows a mix. */
export const SPECIES = ['fox', 'rabbit', 'cat', 'duck'] as const
export type Species = (typeof SPECIES)[number]

export function speciesFor(index: number): Species {
  return SPECIES[((Math.floor(index) % SPECIES.length) + SPECIES.length) % SPECIES.length]
}

/** "Lunch rush" clock: the shift runs 11:00 -> 14:00; `done` = customers dealt with so far. */
export function lunchClock(done: number): { label: string; hourDeg: number; minuteDeg: number } {
  const p = Math.max(0, Math.min(1, done / CUSTOMERS))
  const total = Math.round(p * 180)
  const h = 11 + Math.floor(total / 60)
  const m = total % 60
  return { label: `${h}:${String(m).padStart(2, '0')}`, hourDeg: ((h % 12) + m / 60) * 30, minuteDeg: (total / 60) * 360 }
}
