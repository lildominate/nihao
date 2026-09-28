import { describe, expect, it } from 'vitest'
import data from './videos.generated.json'
import { orderPlaylists } from './VideoCourse'

describe('Videokurs', () => {
  it('has a snapshot of the channel with playable videos', () => {
    expect(data.playlists.length).toBeGreaterThan(5)
    for (const p of data.playlists) for (const v of p.videos) expect(v.id).toMatch(/^[\w-]{11}$/)
  })
  it('orders beginner series first and hides character-writing', () => {
    const ordered = orderPlaylists(data.playlists)
    expect(ordered[0].title).toMatch(/complete beginners/i)
    expect(ordered.some((p) => /write chinese characters/i.test(p.title))).toBe(false)
  })
})
