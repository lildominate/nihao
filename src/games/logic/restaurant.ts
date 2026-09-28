// OWNER: Games agent. Restaurangrusch logic (pure): order generation, tray check, patience, scoring.
import { NO_SPICY, NO_SPICY_ID, type MenuItem } from './menu'
import { shuffle, type Rng } from './random'
import type { Weights } from './weighting'

export const CUSTOMERS = 8
export const STARS = 3
export const GRID_SIZE = 6
export const GRID_SIZE_LATE = 8
/** Pinyin is visible from the start on levels 1..PINYIN_FREE_LEVELS; later it needs a tap on the speaker. */
export const PINYIN_FREE_LEVELS = 2

export type OrderKind = 'one' | 'portion' | 'pair' | 'two-dishes' | 'no-spicy' | 'no-spicy-drink' | 'two-drinks'

export interface Order {
  kind: OrderKind
  level: number
  /** Tray the player must build (multiset of menu ids; NO_SPICY_ID for the "no chili" card). */
  tray: string[]
  hanzi: string
  pinyin: string
  /** Swedish gloss, shown after a mistake. */
  sv: string
}

/** Levels 1-4: two customers each. */
export function levelFor(index: number): number {
  return Math.min(4, 1 + Math.floor(Math.max(0, index) / 2))
}

/** Patience budget in ms: shorter each level, longer for bigger orders. */
export function patienceMs(level: number, trayLen: number): number {
  const base = Math.max(9000, 20000 - 3000 * (level - 1))
  return base + 2500 * Math.max(0, trayLen - 1)
}

export function gridSize(level: number): number {
  return level >= 3 ? GRID_SIZE_LATE : GRID_SIZE
}

export function pinyinVisible(level: number, tapped: boolean): boolean {
  return level <= PINYIN_FREE_LEVELS || tapped
}

function pickWeighted<T extends MenuItem>(list: readonly T[], weights: Weights | undefined, rng: Rng): T {
  const w = list.map((m) => Math.max(0.05, (m.wordId && weights?.[m.wordId]) || 1))
  let r = rng() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i] }
  return list[list.length - 1]
}

function pickN<T extends MenuItem>(list: readonly T[], n: number, weights: Weights | undefined, rng: Rng): T[] {
  const left = [...list]
  const out: T[] = []
  while (out.length < n && left.length) {
    const p = pickWeighted(left, weights, rng)
    out.push(p)
    left.splice(left.indexOf(p), 1)
  }
  return out
}

const join = (parts: string[]) => parts.join(' ')

/** Kinds allowed at a level (level 1: one dish only). */
export function kindsFor(level: number): OrderKind[] {
  if (level <= 1) return ['one']
  if (level === 2) return ['one', 'portion', 'pair']
  if (level === 3) return ['pair', 'two-dishes', 'no-spicy', 'portion']
  return ['pair', 'two-dishes', 'no-spicy', 'no-spicy-drink', 'two-drinks']
}

/** Builds one customer's order. `avoid` = the previous order's trayKey, so it is not repeated back to back. */
export function generateOrder(menu: readonly MenuItem[], index: number, rng: Rng = Math.random, weights?: Weights, avoid?: string): Order {
  const level = levelFor(index)
  const dishes = menu.filter((m) => m.kind === 'dish')
  const drinks = menu.filter((m) => m.kind === 'drink')
  const spicy = dishes.filter((m) => m.spicy)
  const kinds = kindsFor(level)
  let order: Order | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const kind = kinds[Math.floor(rng() * kinds.length)]
    order = build(kind, level, dishes, drinks, spicy, weights, rng)
    if (!avoid || trayKey(order.tray) !== avoid) break
  }
  return order!
}

function build(kind: OrderKind, level: number, dishes: MenuItem[], drinks: MenuItem[], spicy: MenuItem[], weights: Weights | undefined, rng: Rng): Order {
  const mk = (tray: string[], hanzi: string, pinyin: string, sv: string): Order => ({ kind, level, tray, hanzi, pinyin, sv })
  switch (kind) {
    case 'one': {
      const d = pickWeighted(level === 1 ? dishes : [...dishes, ...drinks], weights, rng)
      return mk([d.id], `我要${d.hanzi}`, join(['wǒ yào', d.pinyin]), `Jag vill ha ${d.sv}`)
    }
    case 'portion': {
      const d = pickWeighted(dishes, weights, rng)
      return mk([d.id], `我要一份${d.hanzi}`, join(['wǒ yào yī fèn', d.pinyin]), `Jag vill ha en portion ${d.sv}`)
    }
    case 'pair': {
      const a = pickWeighted(dishes, weights, rng)
      const b = pickWeighted(drinks, weights, rng)
      return mk([a.id, b.id], `我要${a.hanzi}和${b.hanzi}`, join(['wǒ yào', a.pinyin, 'hé', b.pinyin]), `Jag vill ha ${a.sv} och ${b.sv}`)
    }
    case 'two-dishes': {
      const [a, b] = pickN(dishes, 2, weights, rng)
      return mk([a.id, b.id], `我要${a.hanzi}和${b.hanzi}`, join(['wǒ yào', a.pinyin, 'hé', b.pinyin]), `Jag vill ha ${a.sv} och ${b.sv}`)
    }
    case 'no-spicy': {
      const d = pickWeighted(spicy.length ? spicy : dishes, weights, rng)
      return mk([d.id, NO_SPICY_ID], `我要${d.hanzi}，不要辣`, `${join(['wǒ yào', d.pinyin])}, ${NO_SPICY.pinyin}`, `Jag vill ha ${d.sv}, inte stark`)
    }
    case 'no-spicy-drink': {
      const d = pickWeighted(spicy.length ? spicy : dishes, weights, rng)
      const k = pickWeighted(drinks, weights, rng)
      return mk([d.id, k.id, NO_SPICY_ID], `我要${d.hanzi}和${k.hanzi}，不要辣`, `${join(['wǒ yào', d.pinyin, 'hé', k.pinyin])}, ${NO_SPICY.pinyin}`, `Jag vill ha ${d.sv} och ${k.sv}, inte stark`)
    }
    case 'two-drinks': {
      const k = pickWeighted(drinks, weights, rng)
      return mk([k.id, k.id], `请给我两杯${k.hanzi}`, join(['qǐng gěi wǒ liǎng bēi', k.pinyin]), `Snälla, ge mig två ${k.sv}`)
    }
  }
}

export const trayKey = (tray: readonly string[]) => [...tray].sort().join('|')

/** Multiset comparison: order on the tray does not matter, counts do. */
export function trayMatches(order: Pick<Order, 'tray'>, tray: readonly string[]): boolean {
  return trayKey(order.tray) === trayKey(tray)
}

/**
 * The cards on the counter: everything the order needs (unique) padded with distractors, shuffled.
 * From level 3 the "bù yào là" card is always on the counter (ordered or not) so it never gives the answer away.
 */
export function counterFor(order: Order, menu: readonly MenuItem[], rng: Rng = Math.random): MenuItem[] {
  const size = gridSize(order.level)
  const byId = new Map(menu.map((m) => [m.id, m]))
  const cards = [...new Set(order.tray)].filter((id) => id !== NO_SPICY_ID).map((id) => byId.get(id)!).filter(Boolean)
  const withMod = order.level >= 3
  const wanted = withMod ? size - 1 : size
  for (const m of shuffle(menu.filter((x) => !cards.some((c) => c.id === x.id)), rng)) {
    if (cards.length >= wanted) break
    cards.push(m)
  }
  const out = shuffle(cards, rng)
  if (withMod) out.push(NO_SPICY)
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
