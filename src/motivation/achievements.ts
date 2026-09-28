// Pure achievement definitions + evaluation. Metrics come from progress (derived) and
// motivation stats (event-derived, see state.ts).

export type Tier = 'bronze' | 'silver' | 'gold'

export interface AchievementCtx {
  lessonsCompleted: number
  unitsCompleted: number
  wordsKnown: number
  levelXp: number
  level: number
  bestStreak: number
  perfectSessions: number
  sessions: number
  dialogues: number
  games: number
  bestGameCorrect: number
  labSessions: number
  reviews: number
  nightOwl: number
  earlyBird: number
  bestRun: number
  chests: number
  tonesMastered: number
  freezesUsed: number
}

export type Metric = keyof AchievementCtx

export interface AchievementDef {
  id: string
  title: string
  desc: string
  tier: Tier
  emoji: string
  metric: Metric
  target: number
}

const a = (id: string, emoji: string, tier: Tier, title: string, desc: string, metric: Metric, target: number): AchievementDef =>
  ({ id, emoji, tier, title, desc, metric, target })

export const ACHIEVEMENTS: AchievementDef[] = [
  // Lessons & units
  a('first-lesson', '👣', 'bronze', 'Första steget', 'Klara din första lektion.', 'lessonsCompleted', 1),
  a('lessons-10', '📚', 'silver', 'Flitig elev', 'Klara 10 lektioner.', 'lessonsCompleted', 10),
  a('lessons-50', '🎓', 'gold', 'Bokmal', 'Klara 50 lektioner.', 'lessonsCompleted', 50),
  a('unit-1', '🗺️', 'bronze', 'Första kapitlet', 'Klara alla lektioner i en enhet.', 'unitsCompleted', 1),
  a('unit-5', '🧭', 'silver', 'Halvvägs till Peking', 'Klara 5 enheter.', 'unitsCompleted', 5),
  a('unit-10', '🏯', 'gold', 'Hela kartan', 'Klara 10 enheter.', 'unitsCompleted', 10),
  // Streak
  a('streak-3', '🔥', 'bronze', 'Tänd gnista', 'Öva 3 dagar i rad.', 'bestStreak', 3),
  a('streak-7', '🔥', 'silver', 'En hel vecka', 'Öva 7 dagar i rad.', 'bestStreak', 7),
  a('streak-30', '🌋', 'gold', 'Månadens eldsjäl', 'Öva 30 dagar i rad.', 'bestStreak', 30),
  a('streak-100', '☄️', 'gold', 'Legendarisk låga', 'Öva 100 dagar i rad.', 'bestStreak', 100),
  a('freeze-used', '🧊', 'bronze', 'Räddad av isen', 'Ett streakskydd räddade din streak.', 'freezesUsed', 1),
  // Words
  a('words-10', '🌱', 'bronze', 'Första orden', 'Lär dig 10 ord.', 'wordsKnown', 10),
  a('words-100', '🌿', 'silver', 'Ordförrådet växer', 'Lär dig 100 ord.', 'wordsKnown', 100),
  a('words-500', '🌳', 'gold', 'Levande lexikon', 'Lär dig 500 ord.', 'wordsKnown', 500),
  // Quality
  a('perfect-1', '💎', 'bronze', 'Felfritt', 'Klara ett pass utan ett enda fel.', 'perfectSessions', 1),
  a('perfect-10', '💠', 'silver', 'Diamantöra', 'Klara 10 felfria pass.', 'perfectSessions', 10),
  a('run-20', '🎯', 'silver', 'Prickskytt', 'Svara rätt 20 gånger i rad.', 'bestRun', 20),
  a('tones-1', '🎵', 'bronze', 'Tonkänsla', 'Bemästra 5 ord med samma ton.', 'tonesMastered', 1),
  a('tones-4', '🎼', 'gold', 'Tonernas mästare', 'Bemästra 5 ord med var och en av de fyra tonerna.', 'tonesMastered', 4),
  // Listening, games, lab
  a('dialogue-1', '💬', 'bronze', 'Tjuvlyssnare', 'Lyssna klart på din första dialog.', 'dialogues', 1),
  a('dialogue-10', '🎧', 'silver', 'Samtalsproffs', 'Lyssna klart på 10 dialoger.', 'dialogues', 10),
  a('game-1', '🎮', 'bronze', 'Spelsugen', 'Spela ditt första spel.', 'games', 1),
  a('game-score', '🕹️', 'silver', 'Rekordjägare', 'Få 20 rätt i ett och samma spel.', 'bestGameCorrect', 20),
  a('games-25', '🏆', 'gold', 'Spelhallens kung', 'Spela 25 spel.', 'games', 25),
  a('lab-1', '🎙️', 'bronze', 'Första repliken', 'Öva uttal i Tallabbet.', 'labSessions', 1),
  a('lab-10', '🗣️', 'silver', 'Klar som en klocka', 'Öva i Tallabbet 10 gånger.', 'labSessions', 10),
  a('review-25', '🔁', 'silver', 'Minnesmästare', 'Gör 25 repetitionspass.', 'reviews', 25),
  // Time of day
  a('night-owl', '🦉', 'bronze', 'Nattuggla', 'Öva efter klockan 22.', 'nightOwl', 1),
  a('early-bird', '🐦', 'bronze', 'Morgonpigg', 'Öva före klockan 7.', 'earlyBird', 1),
  // XP, level, chests
  a('xp-1000', '⚡', 'silver', 'Tusen blixtar', 'Samla 1 000 XP.', 'levelXp', 1000),
  a('xp-5000', '🌩️', 'gold', 'Åskgud', 'Samla 5 000 XP.', 'levelXp', 5000),
  a('level-10', '🥟', 'silver', 'Dumplingsjägare', 'Nå nivå 10.', 'level', 10),
  a('level-25', '🖌️', 'gold', 'Pinyin-mästare', 'Nå nivå 25.', 'level', 25),
  a('chest-1', '🎁', 'bronze', 'Skattjägare', 'Öppna din första dagskista.', 'chests', 1),
  a('chest-10', '💰', 'silver', 'Kistsamlare', 'Öppna 10 dagskistor.', 'chests', 10),
]

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((x) => [x.id, x]))

export interface AchievementView extends AchievementDef {
  value: number
  ratio: number
  unlocked: boolean
  unlockedAt: string | null
}

export function achievementViews(ctx: AchievementCtx, unlocked: Record<string, string>): AchievementView[] {
  return ACHIEVEMENTS.map((d) => {
    const at = unlocked[d.id] ?? null
    const value = at !== null ? d.target : Math.min(d.target, Math.max(0, ctx[d.metric] ?? 0))
    return { ...d, value, ratio: value / d.target, unlocked: at !== null, unlockedAt: at }
  })
}

/** Ids whose condition is met now but aren't recorded as unlocked yet. */
export function newlyEarned(ctx: AchievementCtx, unlocked: Record<string, string>): string[] {
  return ACHIEVEMENTS.filter((d) => !unlocked[d.id] && (ctx[d.metric] ?? 0) >= d.target).map((d) => d.id)
}

// ─── Tones ───────────────────────────────────────────────────

const TONE_MARKS: Record<string, 1 | 2 | 3 | 4> = {
  ā: 1, ē: 1, ī: 1, ō: 1, ū: 1, ǖ: 1,
  á: 2, é: 2, í: 2, ó: 2, ú: 2, ǘ: 2,
  ǎ: 3, ě: 3, ǐ: 3, ǒ: 3, ǔ: 3, ǚ: 3,
  à: 4, è: 4, ì: 4, ò: 4, ù: 4, ǜ: 4,
}

/** Set of tones (1–4) appearing in a pinyin string. */
export function tonesIn(pinyin: string): Set<number> {
  const s = new Set<number>()
  for (const ch of pinyin.normalize('NFC').toLowerCase()) {
    const t = TONE_MARKS[ch]
    if (t) s.add(t)
  }
  return s
}

export const WORDS_PER_TONE = 5

/** How many of the 4 tones have ≥ WORDS_PER_TONE mastered words containing them. */
export function countTonesMastered(masteredPinyin: string[], perTone = WORDS_PER_TONE): number {
  const counts = [0, 0, 0, 0, 0]
  for (const p of masteredPinyin) for (const t of tonesIn(p)) counts[t]++
  return [1, 2, 3, 4].filter((t) => counts[t] >= perTone).length
}
