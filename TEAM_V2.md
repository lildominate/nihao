# Nǐ hǎo v2 – team brief (read fully before you start)

## Goal
v1 is live (https://lildominate.github.io/nihao/) and works, but it feels "budget" and boring. v2 should feel like a **premium, polished app** that makes the learner WANT to come back daily and that teaches spoken Mandarin **effectively**. The learner is a Swedish adult on an **iPhone** (Safari / home-screen PWA), learns pinyin only (no characters), UI in Swedish. Free forever: no paid APIs and no ads.

## Learning principles (binding for everyone – the pedagogy agent owns the details in PEDAGOGY.md)
1. Ear first: audio everywhere, lots of comprehensible input (dialogues and stories slightly above the learner's level).
2. Retrieval over recognition: move each item from recognising → producing (typing, building, speaking) as mastery grows.
3. Spaced repetition drives review; mistakes come back.
4. Chunks and phrases over isolated words.
5. Tones trained with multiple voices (high-variability phonetic training) and visual pitch feedback.
6. Short daily sessions and a streak; motivation through visible progress, not punishment (no hearts, no limits, no guilt).

## Stack and conventions
Vite + React 19 + TS + Tailwind v4 (tokens in `src/index.css` `@theme`), PWA. `src/types.ts` is the contract (lead-owned). **Do NOT edit files outside your ownership.** No `npm install` of new deps; everything is hand-made (SVG, CSS, WebAudio, canvas). Pinyin convention is in types.ts. Swedish UI copy should be natural, warm and short.
While others work in parallel, `tsc` may show errors in THEIR folders. Only your own folders must be clean. Run `npx tsc -b --pretty false 2>&1 | grep <your folders>` and `npx vitest run <your folders>`.
Don't start dev servers on port 5180 (lead's). Use your own port (5190 + your agent number) and stop it when done.
Mobile-first: test at 375×812. `max-w-md` centred, safe areas (`pt-safe`/`pb-safe`/`px-safe` exist). Respect `prefers-reduced-motion` and `settings.reduceMotion`.

## Ownership
| # | Agent | Owns (exclusively) |
|---|---|---|
| 1 | Design: look | `src/app/**` (all screens and the shell, incl. wiring the new hubs into tabs), `src/ui/**`, `src/mascot/**`, `src/index.css`, `index.html`, `public/**`, `scripts/**` |
| 2 | Lesson experience | `src/exercises/LessonPlayer.tsx`, `src/exercises/components/**`, `src/exercises/_playground/**` |
| 3 | Motivation | `src/motivation/**` |
| 4 | Content 2.0 | `src/data/**` |
| 5 | Speaking and listening lab | `src/speech/**`, `src/lab/**` |
| 6 | Spelhallen (games) | `src/games/**` |
| 7 | Pedagogy | `src/progress/**`, `src/pedagogy/**`, `src/exercises/generate.ts`, `src/exercises/generate.test.ts`, `src/exercises/items.ts`, `src/exercises/index.ts`, `PEDAGOGY.md` |
| 9 | Design: motion and flow | `src/motion/**`, `src/styles/motion.css` |
| Lead | | `src/types.ts`, `TEAM_V2.md`, `PLAN.md`, `src/integration.test.ts`, `vite.config.ts`, `package.json` |

## Cross-module contracts (stubs exist, implement or use them)
- `src/mascot/Panda.tsx`: `<Panda mood size />`, the mascot "Pānpan" (agent 1).
- `src/motion/index.tsx`: `celebrate()`, `haptic()`, `<CountUp>`, `<Transition>`, `<Splash>`, `<CelebrationOverlay>`, `useReducedMotion()` (agent 9). Everyone should USE these for juice; they are no-ops until agent 9 lands, so code against them now.
- `src/progress`: `useProgress()` (+ new `mastery(item)` 0–5), `onSessionFinished(fn)` event bus, `finishSession(result)` with `result.source` (agent 7 owns it; keep existing API working).
- `src/motivation/index.tsx`: `MotivationProvider`, `DailyQuestsCard`, `LevelBadge`, `AchievementsSection`, `MotivationOverlays` (agent 3). Agent 1 places them in the shell.
- `src/games/index.tsx`: `GamesHub` (agent 6). `src/lab/index.tsx`: `LabHub` (agent 5). `src/pedagogy/index.tsx`: `PlacementTest` (agent 7). Agent 1 wires them.
- New types in `types.ts`: `Dialogue`/`DialogueLine`, `course.dialogues`, `Unit.dialogueIds`, `ItemRef.kind 'line'` (id `dialogueId:lineIndex`), new exercises `fill-blank`, `listen-build`, `dialogue-reply`, `shadow`, `LessonResult.source`, and optional Settings `theme`/`reduceMotion`/`multiVoice`.
- New exported function signatures: keep existing exports; ADD, don't break.

## Navigation (agent 1 implements)
Bottom tabs: **Lär dig · Öva · Spel · Ord · Profil**.
- Öva = review (existing) + Tallabbet (LabHub).
- Spel = GamesHub.
- Profil = stats + AchievementsSection + settings.
- Home = path + DailyQuestsCard + LevelBadge in the top bar + dialogue/story nodes on the path (after their `afterLessonId`).

## Definition of done
Your folders typecheck and their tests pass. You've tried it in a browser at 375 px. Finish with a short report to the lead: what you built, what the lead must wire up, and any risks.
