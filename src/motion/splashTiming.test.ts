import { describe, expect, it } from 'vitest'
import { SPLASH_MIN_MS, splashCanLeave, splashHoldMs } from './splashTiming'

describe('splash timing', () => {
  it('holds at least ~1.5 s by default', () => {
    expect(SPLASH_MIN_MS).toBeGreaterThanOrEqual(1500)
    expect(splashHoldMs()).toBe(SPLASH_MIN_MS)
  })
  it('sanitises odd values', () => {
    expect(splashHoldMs(-5)).toBe(0)
    expect(splashHoldMs(NaN)).toBe(SPLASH_MIN_MS)
    expect(splashHoldMs(2000)).toBe(2000)
  })
  it('leaves only when min time passed, typed and ready', () => {
    expect(splashCanLeave({ minPassed: false, typedAll: true, ready: true })).toBe(false)
    expect(splashCanLeave({ minPassed: true, typedAll: false, ready: true })).toBe(false)
    expect(splashCanLeave({ minPassed: true, typedAll: true, ready: false })).toBe(false)
    expect(splashCanLeave({ minPassed: true, typedAll: true, ready: true })).toBe(true)
  })
})
