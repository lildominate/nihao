import { describe, expect, it } from 'vitest'
import { course } from '../../data/course'
import { buildWordPool } from './pool'
import { seeded } from './random'
import { playableSentences } from './builder'
import {
  boardRows, optionCount, placeTokens, SnakeDeck, spawnSnake, step, steer, swipeToDir, tickMs, tokenAt, tokenCells, tokenSize,
  SNAKE_COLS, SNAKE_MIN_LEN, type Snake, type Token,
} from './snake'
import { wordItem } from './runner'

const pool = buildWordPool([], course)
const items = (n: number) => pool.words.slice(0, n).map(wordItem)
const tok = (id: string, x: number, y: number, correct: boolean, w = 3, h = 1): Token => ({ id, item: wordItem(pool.words[0]), correct, x, y, w, h })
const snakeAt = (cells: [number, number][], dir: Snake['dir'] = 'right'): Snake => ({ body: cells.map(([x, y]) => ({ x, y })), dir, queue: [] })

describe('difficulty curve', () => {
  it('gets faster and stays above the floor', () => {
    expect(tickMs(0)).toBe(330)
    expect(tickMs(5)).toBeLessThan(tickMs(0))
    expect(tickMs(14)).toBeLessThan(tickMs(7))
    expect(tickMs(99)).toBe(170)
  })
  it('3 options first, 4 later, phrases stay at 3', () => {
    expect(optionCount(0)).toBe(3)
    expect(optionCount(9)).toBe(4)
    expect(optionCount(9, true)).toBe(3)
  })
  it('rows follow the canvas aspect within limits', () => {
    expect(boardRows(374, 500)).toBeGreaterThanOrEqual(9)
    expect(boardRows(374, 5000)).toBe(15)
    expect(boardRows(374, 10)).toBe(9)
  })
})

describe('input', () => {
  it('swipes need distance and pick the dominant axis', () => {
    expect(swipeToDir(5, 5)).toBeNull()
    expect(swipeToDir(-40, 10)).toBe('left')
    expect(swipeToDir(10, -40)).toBe('up')
    expect(swipeToDir(10, 40)).toBe('down')
  })
  it('never reverses into itself and buffers at most two turns', () => {
    let s = snakeAt([[5, 5], [4, 5], [3, 5]])
    expect(steer(s, 'left')).toBe(s)
    expect(steer(s, 'right')).toBe(s)
    s = steer(s, 'up')
    expect(s.queue).toEqual(['up'])
    expect(steer(s, 'down')).toBe(s)
    s = steer(s, 'left')
    expect(s.queue).toEqual(['up', 'left'])
    expect(steer(s, 'down')).toBe(s)
  })
})

describe('movement', () => {
  it('moves the whole snake one cell and consumes a buffered turn', () => {
    const s = steer(snakeAt([[5, 5], [4, 5], [3, 5]]), 'down')
    const r = step(s, [], 11, 13)
    expect(r.kind).toBe('move')
    if (r.kind !== 'move') return
    expect(r.snake.body).toEqual([{ x: 5, y: 6 }, { x: 5, y: 5 }, { x: 4, y: 5 }])
    expect(r.snake.dir).toBe('down')
    expect(r.snake.queue).toEqual([])
  })
  it('crashes into walls and into itself', () => {
    expect(step(snakeAt([[10, 3], [9, 3]]), [], 11, 13).kind).toBe('crash')
    const wall = step(snakeAt([[0, 0], [1, 0]], 'left'), [], 11, 13)
    expect(wall.kind === 'crash' && wall.cause).toBe('wall')
    const coil = snakeAt([[5, 5], [5, 6], [4, 6], [4, 5], [4, 4], [5, 4], [6, 4]], 'up')
    const self = step(coil, [], 11, 13)
    expect(self.kind === 'crash' && self.cause).toBe('self')
  })
  it('may follow its own tail cell', () => {
    const loop = snakeAt([[5, 5], [5, 6], [4, 6], [4, 5]], 'left')
    expect(step(loop, [], 11, 13).kind).toBe('move')
  })
  it('grows on the correct token and shrinks (min 2) on a wrong one', () => {
    const s = snakeAt([[4, 5], [3, 5], [2, 5]])
    const good = step(s, [tok('g', 5, 5, true)], 11, 13)
    expect(good.kind).toBe('eat')
    if (good.kind === 'eat') { expect(good.snake.body.length).toBe(4); expect(good.token.correct).toBe(true) }
    const bad = step(s, [tok('b', 5, 5, false)], 11, 13)
    expect(bad.kind).toBe('eat')
    if (bad.kind === 'eat') expect(bad.snake.body.length).toBe(2)
    const tiny = step(snakeAt([[4, 5], [3, 5]]), [tok('b', 5, 5, false)], 11, 13)
    if (tiny.kind === 'eat') expect(tiny.snake.body.length).toBe(SNAKE_MIN_LEN)
  })
})

describe('spawn and tokens', () => {
  it('respawns inside the board, straight, capped in length', () => {
    for (const rows of [9, 13, 15]) {
      const s = spawnSnake(30, SNAKE_COLS, rows)
      expect(s.body.length).toBeLessThanOrEqual(8)
      expect(s.body.length).toBeLessThanOrEqual(rows - 4)
      expect(s.body.every((c) => c.x >= 0 && c.x < SNAKE_COLS && c.y >= 0 && c.y < rows)).toBe(true)
      expect(s.body[0].y).toBeLessThan(s.body[s.body.length - 1].y)
      expect(s.body[0].y).toBeGreaterThanOrEqual(3)
      expect(step(s, [], SNAKE_COLS, rows).kind).toBe('move')
    }
  })
  it('places tokens inside the board, apart, off the snake and with one correct', () => {
    for (let seed = 0; seed < 60; seed++) {
      const rng = seeded(seed)
      const rows = 9 + (seed % 7)
      const snake = spawnSnake(3 + (seed % 6), SNAKE_COLS, rows)
      const its = items(seed % 2 ? 4 : 3)
      const tokens = placeTokens(its, its[seed % its.length].key, snake, SNAKE_COLS, rows, rng)
      expect(tokens.length).toBe(its.length)
      expect(tokens.filter((t) => t.correct).length).toBe(1)
      const seen = new Set<string>()
      for (const t of tokens) {
        for (const c of tokenCells(t)) {
          expect(c.x >= 0 && c.x < SNAKE_COLS && c.y >= 0 && c.y < rows).toBe(true)
          const k = `${c.x},${c.y}`
          expect(seen.has(k)).toBe(false)
          seen.add(k)
          expect(snake.body.some((b) => b.x === c.x && b.y === c.y)).toBe(false)
        }
      }
      expect(tokenAt(tokens, { x: tokens[0].x, y: tokens[0].y })).toBe(tokens[0])
    }
  })
  it('sizes tokens by text length and kind', () => {
    expect(tokenSize({ ...wordItem(pool.words[0]), pinyin: 'nǐ' })).toEqual({ w: 3, h: 1 })
    expect(tokenSize({ ...wordItem(pool.words[0]), pinyin: 'xièxie' })).toEqual({ w: 3, h: 1 })
    expect(tokenSize({ ...wordItem(pool.words[0]), pinyin: 'zàijiàn' })).toEqual({ w: 4, h: 1 })
    expect(tokenSize({ ...wordItem(pool.words[0]), pinyin: 'nǐ hǎo ma', kind: 'sentence' })).toEqual({ w: 5, h: 2 })
  })
})

describe('deck', () => {
  it('serves unique options with the target, 3 then 4, phrases later', () => {
    const sents = playableSentences(course, pool.words.map((w) => w.id))
    const deck = new SnakeDeck(pool.words, Object.values(course.words), sents, seeded(5))
    let phrases = 0
    for (let i = 0; i < 15; i++) {
      const r = deck.next(i)
      expect(r.options.some((o) => o.key === r.target.key)).toBe(true)
      expect(new Set(r.options.map((o) => o.pinyin)).size).toBe(r.options.length)
      expect(r.options.length).toBe(r.target.kind === 'sentence' ? 3 : i < 6 ? 3 : 4)
      if (i < 8) expect(r.target.kind).toBe('word')
      if (r.target.kind === 'sentence') phrases++
    }
    if (deck.canPhrase) expect(phrases).toBeGreaterThan(0)
  })
})
