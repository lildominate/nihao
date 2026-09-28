import { describe, expect, it } from 'vitest'
import { nextFocusIndex } from './focusTrap'

describe('nextFocusIndex', () => {
  it('wraps forward and backward', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1)
    expect(nextFocusIndex(2, 3, false)).toBe(0)
    expect(nextFocusIndex(0, 3, true)).toBe(2)
    expect(nextFocusIndex(2, 3, true)).toBe(1)
  })
  it('pulls outside focus in', () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0)
    expect(nextFocusIndex(-1, 3, true)).toBe(2)
  })
  it('handles empty and single', () => {
    expect(nextFocusIndex(-1, 0, false)).toBe(-1)
    expect(nextFocusIndex(0, 1, false)).toBe(0)
    expect(nextFocusIndex(0, 1, true)).toBe(0)
  })
})
