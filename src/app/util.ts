// Shell helpers.
import type { Course, Unit } from '../types'

/** Per-unit colour theme (cycled). */
export const UNIT_COLORS = [
  { bg: '#22c55e', dark: '#16a34a', soft: '#dcfce7' }, // green
  { bg: '#0ea5e9', dark: '#0284c7', soft: '#e0f2fe' }, // sky
  { bg: '#a855f7', dark: '#9333ea', soft: '#f3e8ff' }, // purple
  { bg: '#f97316', dark: '#ea580c', soft: '#ffedd5' }, // orange
  { bg: '#ec4899', dark: '#db2777', soft: '#fce7f3' }, // pink
  { bg: '#14b8a6', dark: '#0d9488', soft: '#ccfbf1' }, // teal
  { bg: '#eab308', dark: '#ca8a04', soft: '#fef9c3' }, // yellow
  { bg: '#6366f1', dark: '#4f46e5', soft: '#e0e7ff' }, // indigo
] as const
export const unitColor = (i: number) => UNIT_COLORS[i % UNIT_COLORS.length]

/** Lowercase, strip diacritics (tone marks, å/ä/ö are kept as base letters). */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** word id → the unit that introduces it. */
export function wordUnitMap(course: Course): Map<string, Unit> {
  const m = new Map<string, Unit>()
  for (const u of course.units) for (const l of u.lessons) for (const w of l.newWords) if (!m.has(w)) m.set(w, u)
  return m
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

export const ONBOARDED_KEY = 'nihao/onboarded'
export function safeGet(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
export function safeSet(key: string, v: string): void { try { localStorage.setItem(key, v) } catch { /* ignore */ } }
export function safeRemove(key: string): void { try { localStorage.removeItem(key) } catch { /* ignore */ } }
