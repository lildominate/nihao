// OWNER: Themes agent. One picture box for a word: illustration (Word.image under public/) or the emoji.
// Same box for both, so illustrations can be dropped in later without touching layout code.
import type { Word } from '../types'

export function WordPicture({ word, size = 64, className = '' }: { word: Pick<Word, 'emoji' | 'image'>; size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center leading-none select-none ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.82 }} aria-hidden="true">
      {word.image
        ? <img src={import.meta.env.BASE_URL + word.image} alt="" draggable={false} className="h-full w-full object-contain" />
        : <span>{word.emoji ?? '❓'}</span>}
    </span>
  )
}

/** Same box for a theme icon (emoji only). */
export function EmojiBox({ emoji, size = 48, className = '' }: { emoji: string; size?: number; className?: string }) {
  return <WordPicture word={{ emoji }} size={size} className={className} />
}
