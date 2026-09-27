// Non-component helpers for exercise components.
import type { Settings } from '../../types'
import { playSfx, type Sfx } from '../../speech'

export function sfx(settings: Settings, s: Sfx) {
  if (settings.soundEffects) playSfx(s)
}

export type OptionState = 'idle' | 'selected' | 'right' | 'wrong' | 'dim'

export function optionClass(state: OptionState) {
  switch (state) {
    case 'selected': return 'border-sky bg-sky-soft text-sky-dark'
    case 'right': return 'border-brand bg-brand-soft text-brand-dark'
    case 'wrong': return 'border-danger bg-danger-soft text-danger animate-[nh-shake_0.4s_ease-in-out]'
    case 'dim': return 'border-line bg-surface text-ink opacity-60'
    default: return 'border-line bg-surface text-ink hover:bg-surface-2'
  }
}

