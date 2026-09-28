// Non-component helpers for exercise components.
import type { Settings } from '../../types'
import { playSfx, type Sfx } from '../../speech'
import { haptic } from '../../motion'

export function sfx(settings: Settings, s: Sfx) {
  if (settings.soundEffects) playSfx(s)
}

/** Tap feedback when the learner picks an option / tile: tap sound + selection haptic. */
export function pickFx(settings: Settings) {
  sfx(settings, 'tap')
  haptic('select')
}

/** Chunky 3D press: button sinks into its bottom border and squishes a touch. */
export const PRESS = 'press active:border-b-2 disabled:active:border-b-4'

export type OptionState = 'idle' | 'selected' | 'right' | 'wrong' | 'dim'

export function optionClass(state: OptionState) {
  switch (state) {
    case 'selected': return 'border-sky bg-sky-soft text-sky-dark'
    case 'right': return 'border-brand bg-brand-soft text-brand-dark'
    case 'wrong': return 'border-danger bg-danger-soft text-danger shake'
    case 'dim': return 'border-line bg-surface text-ink opacity-60'
    default: return 'border-line bg-surface text-ink hover:bg-surface-2'
  }
}

