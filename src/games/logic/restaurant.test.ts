import { describe, expect, it } from 'vitest'
import { course } from '../../data/course'
import { MENU, NO_MEAT_ID, NO_SPICY_ID, WISH_IDS, resolveMenu } from './menu'
import { seeded } from './random'
import {
  counterFor, finalBonus, levelOrders, lunchClock, speciesFor, gridSize, LEVELS, patienceMs, pinyinVisible, tipFor, trayMatches, CUSTOMERS,
} from './restaurant'

const menu = resolveMenu(new Map(Object.entries(course.words)))
const byId = new Map(menu.map((m) => [m.id, m]))

describe('menu', () => {
  it('has 20-30 unique items with tone-marked pinyin and no written sandhi', () => {
    expect(MENU.length).toBeGreaterThanOrEqual(20)
    expect(MENU.length).toBeLessThanOrEqual(30)
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length)
    for (const m of MENU) expect(m.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/)
    expect(MENU.some((m) => /yí|bú/.test(m.pinyin))).toBe(false)
  })
  it('wordIds exist in course.words and resolveMenu uses the course pinyin', () => {
    for (const m of MENU.filter((x) => x.wordId)) {
      const w = course.words[m.wordId!]
      expect(w, m.id).toBeTruthy()
      expect(w.hanzi).toBe(m.hanzi)
    }
    for (const m of menu.filter((x) => x.wordId)) expect(m.pinyin).toBe(course.words[m.wordId!].pinyin)
  })
})

describe('difficulty', () => {
  it('patience shortens with level, lengthens with order size', () => {
    expect(patienceMs(5, 1)).toBeLessThan(patienceMs(1, 1))
    expect(patienceMs(2, 3)).toBeGreaterThan(patienceMs(2, 1))
    expect(patienceMs(5, 1)).toBeGreaterThanOrEqual(9000)
  })
  it('pinyin is free on levels 1-2 and needs a tap after', () => {
    expect(pinyinVisible(2, false)).toBe(true)
    expect(pinyinVisible(3, false)).toBe(false)
    expect(pinyinVisible(3, true)).toBe(true)
  })
})

describe('scripted levels', () => {
  it('every level has 8 customers, valid ids, tone-marked pinyin, hanzi and a Swedish translation', () => {
    for (let lv = 1; lv <= LEVELS; lv++) {
      const orders = levelOrders(menu, lv, seeded(lv))
      expect(orders).toHaveLength(CUSTOMERS)
      for (const o of orders) {
        expect(o.level).toBe(lv)
        for (const id of o.tray) expect(byId.has(id) || WISH_IDS.includes(id), id).toBe(true)
        expect(o.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/)
        expect(o.pinyin).not.toMatch(/yí|bú/)
        expect(o.hanzi.length).toBeGreaterThan(0)
        expect(o.sv.length).toBeGreaterThan(3)
      }
    }
  })
  it('level 1 is one dish; level 2 dish + drink; level 3 two dishes', () => {
    for (const o of levelOrders(menu, 1)) {
      expect(o.tray).toHaveLength(1)
      expect(byId.get(o.tray[0])!.kind).toBe('dish')
      expect(o.pinyin).toMatch(/^yī (fèn|wǎn) /)
    }
    for (const o of levelOrders(menu, 2)) {
      expect(o.tray.map((id) => byId.get(id)!.kind).sort()).toEqual(['dish', 'drink'])
    }
    for (const o of levelOrders(menu, 3)) {
      expect(o.tray).toHaveLength(2)
      expect(o.tray.every((id) => byId.get(id)!.kind === 'dish')).toBe(true)
    }
  })
  it('uses the course pinyin for course words and píng for beer', () => {
    const beer = levelOrders(menu, 2).find((o) => o.tray.includes('pi-jiu'))!
    expect(beer.pinyin).toContain('yī píng pí jiǔ')
    const shuiOrder = levelOrders(menu, 2).find((o) => o.tray.includes('shui'))!
    expect(shuiOrder.pinyin).toContain(course.words['shui'].pinyin)
  })
  it('wishes only make sense', () => {
    const noSpicyOk = new Set(['jiao-zi', 'niu-rou-mian', 'mian-tiao'])
    const noMeatOk = new Set(['chao-fan', 'bao-zi'])
    for (const lv of [4, 5]) {
      for (const o of levelOrders(menu, lv)) {
        if (o.tray.includes(NO_SPICY_ID)) expect(o.tray.some((id) => noSpicyOk.has(id))).toBe(true)
        if (o.tray.includes(NO_MEAT_ID) && o.special !== 'vegetarian') expect(o.tray.some((id) => noMeatOk.has(id))).toBe(true)
        expect(o.tray).not.toEqual(expect.arrayContaining(['niu-rou-mian', NO_MEAT_ID]))
        expect(o.tray).not.toEqual(expect.arrayContaining(['ji-dan', NO_MEAT_ID]))
      }
    }
  })
  it('level 4 has "liǎng bēi kā fēi" as a duplicate tray; level 5 has the 3-item order and the specials', () => {
    const two = levelOrders(menu, 4).find((o) => o.pinyin === 'liǎng bēi kā fēi')!
    expect(two.tray).toEqual(['ka-fei', 'ka-fei'])
    expect(trayMatches(two, ['ka-fei', 'ka-fei'])).toBe(true)
    expect(trayMatches(two, ['ka-fei'])).toBe(false)
    const l5 = levelOrders(menu, 5)
    expect(l5.some((o) => o.tray.length === 3 && o.pinyin.includes('chūn juǎn') && o.pinyin.includes('pí jiǔ'))).toBe(true)
    expect(l5.some((o) => o.pinyin.startsWith('wǒ yào liǎng fèn bāo zi'))).toBe(true)
    const change = l5.find((o) => o.special === 'change')!
    expect(change.pinyin).toContain('bù duì!')
    expect(change.prelude).toBeTruthy()
    expect(change.tray).toEqual(expect.arrayContaining(['shou-si', 'lu-cha']))
    const veg = l5.find((o) => o.special === 'vegetarian')!
    expect(veg.prelude!.pinyin).toBe('yǒu sù de ma?')
    expect(veg.tray.sort()).toEqual(['chun-juan', 'mi-fan', NO_MEAT_ID].sort())
    const busy = levelOrders(menu, 4).find((o) => o.special === 'busy')!
    expect(busy.patienceMul!).toBeLessThan(1)
  })
  it('shuffles the order within a level but is deterministic per seed', () => {
    expect(levelOrders(menu, 3, seeded(3))).toEqual(levelOrders(menu, 3, seeded(3)))
    expect(levelOrders(menu, 3, seeded(3)).map((o) => o.pinyin)).not.toEqual(levelOrders(menu, 3, seeded(4)).map((o) => o.pinyin))
  })
})

describe('tray + counter', () => {
  it('matches as a multiset regardless of order', () => {
    const o = { tray: ['a', 'b', 'b'] }
    expect(trayMatches(o, ['b', 'a', 'b'])).toBe(true)
    expect(trayMatches(o, ['a', 'b'])).toBe(false)
    expect(trayMatches(o, ['a', 'b', 'b', 'c'])).toBe(false)
  })
  it('500 random orders per level: every ordered item is on the counter, no duplicates, right size', () => {
    const rng = seeded(11)
    for (let lv = 1; lv <= LEVELS; lv++) {
      const pool = levelOrders(menu, lv, rng)
      for (let n = 0; n < 500; n++) {
        const o = pool[Math.floor(rng() * pool.length)]
        const cards = counterFor(o, menu, rng)
        const ids = cards.map((c) => c.id)
        expect(cards).toHaveLength(gridSize(lv))
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of o.tray) expect(ids, `${o.pinyin} needs ${id}`).toContain(id)
        for (const id of o.decoys ?? []) expect(ids).toContain(id)
        expect(ids.includes(NO_SPICY_ID)).toBe(lv >= 4)
        expect(ids.includes(NO_MEAT_ID)).toBe(lv >= 4)
      }
    }
  })
  it('every menu item can be ordered: water is always on the counter when ordered', () => {
    const o = levelOrders(menu, 2, seeded(5)).find((x) => x.tray.includes('shui'))!
    for (let i = 0; i < 200; i++) expect(counterFor(o, menu, seeded(i)).some((c) => c.id === 'shui')).toBe(true)
  })
})

describe('scoring', () => {
  it('tips grow with level, patience left and streak', () => {
    expect(tipFor(2, 1, 0)).toBeGreaterThan(tipFor(1, 1, 0))
    expect(tipFor(1, 1, 0)).toBeGreaterThan(tipFor(1, 0, 0))
    expect(tipFor(1, 0.5, 4)).toBeGreaterThan(tipFor(1, 0.5, 0))
    expect(tipFor(1, -3, 0)).toBe(10)
  })
  it('final bonus only for completed rounds', () => {
    expect(finalBonus(3, true)).toBe(75)
    expect(finalBonus(3, false)).toBe(0)
  })
})

describe('scene helpers', () => {
  it('cycles species and runs the clock 11:00-14:00', () => {
    expect([0, 1, 2, 3, 4].map(speciesFor)).toEqual(['fox', 'rabbit', 'cat', 'duck', 'fox'])
    expect(lunchClock(0).label).toBe('11:00')
    expect(lunchClock(CUSTOMERS).label).toBe('14:00')
    expect(lunchClock(4).label).toBe('12:30')
    expect(lunchClock(99).label).toBe('14:00')
  })
})
