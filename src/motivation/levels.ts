// Pure level curve. Level XP = progress.xpTotal + motivation bonusXp (quest chests).
// No storage: the level is always derived.

export const MAX_LEVEL = 50

/** Cumulative XP needed to REACH `level` (level 1 = 0). 50·(n−1)^1.5 → 50, 141, 260, 400 … 17 150. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))
  return Math.round(50 * Math.pow(n - 1, 1.5))
}

export interface LevelTitle { from: number; sv: string; hanzi: string; pinyin: string; emoji: string }

/** One title per band of 5 levels. Pinyin follows the project convention. */
export const LEVEL_TITLES: LevelTitle[] = [
  { from: 1, sv: 'Nybörjare', hanzi: '新手', pinyin: 'xīn shǒu', emoji: '🌱' },
  { from: 5, sv: 'Tebutiksstammis', hanzi: '茶客', pinyin: 'chá kè', emoji: '🍵' },
  { from: 10, sv: 'Dumplingsjägare', hanzi: '饺子迷', pinyin: 'jiǎo zi mí', emoji: '🥟' },
  { from: 15, sv: 'Tonjonglör', hanzi: '声调', pinyin: 'shēng diào', emoji: '🎵' },
  { from: 20, sv: 'Marknadsprutare', hanzi: '讲价', pinyin: 'jiǎng jià', emoji: '🏮' },
  { from: 25, sv: 'Pinyin-mästare', hanzi: '拼音大师', pinyin: 'pīn yīn dà shī', emoji: '🖌️' },
  { from: 30, sv: 'Pandaviskare', hanzi: '熊猫', pinyin: 'xióng māo', emoji: '🐼' },
  { from: 35, sv: 'Drakryttare', hanzi: '龙', pinyin: 'lóng', emoji: '🐉' },
  { from: 40, sv: 'Tebergets vise', hanzi: '智者', pinyin: 'zhì zhě', emoji: '⛰️' },
  { from: 45, sv: 'Mandarinlegend', hanzi: '传奇', pinyin: 'chuán qí', emoji: '👑' },
]

export function titleForLevel(level: number): LevelTitle {
  let t = LEVEL_TITLES[0]
  for (const x of LEVEL_TITLES) if (level >= x.from) t = x
  return t
}

export interface LevelInfo {
  level: number
  title: LevelTitle
  xp: number
  /** XP at which the current level started. */
  levelStartXp: number
  /** XP needed to reach the next level (null at max level). */
  nextLevelXp: number | null
  /** 0..1 progress inside the current level (1 at max). */
  progress: number
  /** XP left to the next level (0 at max). */
  xpToNext: number
  isMax: boolean
}

export function levelForXp(xpRaw: number): LevelInfo {
  const xp = Math.max(0, Math.floor(Number.isFinite(xpRaw) ? xpRaw : 0))
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  const isMax = level >= MAX_LEVEL
  const levelStartXp = xpForLevel(level)
  const nextLevelXp = isMax ? null : xpForLevel(level + 1)
  const progress = isMax || nextLevelXp === null ? 1 : (xp - levelStartXp) / (nextLevelXp - levelStartXp)
  return {
    level,
    title: titleForLevel(level),
    xp,
    levelStartXp,
    nextLevelXp,
    progress: Math.max(0, Math.min(1, progress)),
    xpToNext: nextLevelXp === null ? 0 : nextLevelXp - xp,
    isMax,
  }
}
