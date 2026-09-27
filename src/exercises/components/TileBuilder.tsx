import type { ReactNode } from 'react'

/** Duolingo word bank: tap tiles to move them to the answer line and back. */
export function TileBuilder({ tiles, picked, onChange, locked, render, onTapTile }: {
  tiles: string[]
  /** indexes into `tiles`, in answer order */
  picked: number[]
  onChange: (picked: number[]) => void
  locked: boolean
  render: (t: string) => ReactNode
  onTapTile?: (t: string) => void
}) {
  const tile = 'inline-flex min-h-12 items-center rounded-xl border-2 border-b-4 border-line bg-surface px-3 py-1.5 text-lg font-bold text-ink transition-transform active:translate-y-0.5 active:border-b-2 disabled:active:translate-y-0 disabled:active:border-b-4'
  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex min-h-[7.5rem] flex-wrap content-start gap-2 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_58px,var(--color-line)_58px,var(--color-line)_60px)] py-1"
        aria-label="Ditt svar"
      >
        {picked.map((ti, pos) => (
          <button
            key={`${ti}`}
            type="button"
            disabled={locked}
            onClick={() => onChange(picked.filter((_, p) => p !== pos))}
            className={`${tile} animate-pop`}
          >
            {render(tiles[ti])}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Ordbank">
        {tiles.map((t, i) => {
          const used = picked.includes(i)
          return used ? (
            <span key={i} className={`${tile} border-surface-2 bg-surface-2 select-none`} aria-hidden="true"><span className="invisible">{render(t)}</span></span>
          ) : (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => { onTapTile?.(t); onChange([...picked, i]) }}
              className={tile}
            >
              {render(t)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
