// Fetches the ChineseFor.Us channel's playlists + videos via the YouTube Data API v3 and
// writes src/videos/videos.generated.json (ids + titles only; videos play via YouTube's embed).
// Usage: YT_API_KEY=... node scripts/fetch-videos.mjs   (CI passes the key from a GitHub secret)
// Without a key it exits quietly and the committed snapshot is used.
import { writeFileSync, mkdirSync } from 'node:fs'

const KEY = process.env.YT_API_KEY
const CHANNEL = 'UCgCrOLcWvSFl5K2ld0nKS7w' // @ChineseForUsOfficial
const OUT = new URL('../src/videos/videos.generated.json', import.meta.url)

if (!KEY) {
  console.log('fetch-videos: no YT_API_KEY — keeping the committed snapshot')
  process.exit(0)
}

async function api(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  for (const [k, v] of Object.entries({ ...params, key: KEY })) url.searchParams.set(k, v)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

async function all(path, params) {
  const items = []
  let pageToken
  do {
    const r = await api(path, { ...params, maxResults: '50', ...(pageToken ? { pageToken } : {}) })
    items.push(...r.items)
    pageToken = r.nextPageToken
  } while (pageToken)
  return items
}

const isPlayable = (it) => it.snippet?.title && !/^(Private|Deleted) video$/i.test(it.snippet.title)
const video = (it) => ({ id: it.contentDetails.videoId, title: it.snippet.title })

try {
  const [channel] = (await api('channels', { part: 'snippet,contentDetails', id: CHANNEL })).items
  const uploads = (await all('playlistItems', { part: 'snippet,contentDetails', playlistId: channel.contentDetails.relatedPlaylists.uploads }))
    .filter(isPlayable).map(video)
  const lists = await all('playlists', { part: 'snippet,contentDetails', channelId: CHANNEL })
  const playlists = []
  for (const p of lists) {
    if (!p.contentDetails.itemCount) continue
    const videos = (await all('playlistItems', { part: 'snippet,contentDetails', playlistId: p.id })).filter(isPlayable).map(video)
    if (videos.length) playlists.push({ id: p.id, title: p.snippet.title, videos })
  }
  mkdirSync(new URL('../src/videos/', import.meta.url), { recursive: true })
  writeFileSync(OUT, JSON.stringify({ channel: { id: CHANNEL, title: channel.snippet.title }, fetchedAt: new Date().toISOString().slice(0, 10), playlists, uploads }, null, 1) + '\n')
  console.log(`fetch-videos: ${playlists.length} playlists, ${uploads.length} uploads`)
} catch (err) {
  // Never fail the deploy over this: keep the previous snapshot.
  console.warn('fetch-videos: failed, keeping snapshot —', err.message)
}
