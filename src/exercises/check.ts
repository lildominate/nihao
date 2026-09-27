// Answer checking for tile exercises (pure).
import type { Sentence } from '../types'
import { norm, normSv } from './pinyinUtil'

export function checkBuild(type: 'build-pinyin' | 'build-sv', s: Sentence, picked: string[]): boolean {
  if (type === 'build-pinyin') return norm(picked.join(' ')) === norm(s.chunks.join(' '))
  const answer = normSv(picked.join(' '))
  return [s.svChunks.join(' '), s.sv, ...(s.svAlt ?? [])].some((a) => normSv(a) === answer)
}
