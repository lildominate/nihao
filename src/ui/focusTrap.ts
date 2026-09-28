// Pure helper for keeping Tab focus inside a dialog.

/**
 * Index of the element that should receive focus after Tab (or Shift+Tab).
 * `current` is the index of the focused element in the focusable list, or -1 when focus is outside it.
 * Returns -1 when there is nothing to focus.
 */
export function nextFocusIndex(current: number, count: number, shift: boolean): number {
  if (count <= 0) return -1
  if (current < 0 || current >= count) return shift ? count - 1 : 0
  return shift ? (current - 1 + count) % count : (current + 1) % count
}

export const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
