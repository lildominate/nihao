// OWNER: Motion agent. SSR/node safety: every imperative helper must be a silent no-op without a DOM.
import { describe, expect, it } from 'vitest'
import { celebrate, flyTo, haptic, prefersReducedMotion, replay, bump } from '.'

describe('motion (no DOM)', () => {
  it('celebrate and haptic never throw', () => {
    for (const k of ['confetti', 'burst', 'fireworks', 'stars'] as const) expect(() => celebrate(k, { origin: { x: 1, y: 2 } })).not.toThrow()
    for (const k of ['light', 'success', 'error', 'medium', 'heavy', 'select', 'warning'] as const) expect(() => haptic(k)).not.toThrow()
  })
  it('flyTo resolves and still reports arrivals', async () => {
    let n = 0
    await flyTo(null, null, '+10', { count: 3, onArrive: () => n++ })
    expect(n).toBe(3)
  })
  it('helpers are safe with null', () => {
    expect(prefersReducedMotion()).toBe(false)
    expect(() => { replay(null, 'shake'); bump(null) }).not.toThrow()
  })
})
