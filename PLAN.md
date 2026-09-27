# Nǐ hǎo – projektplan

Mobil-PWA för att lära sig **talad mandarin via pinyin** (inga tecken att lära sig). Duolingo-känsla, men utan reklam, hjärtan eller begränsningar. Gränssnittet är på svenska.

## Stack
Vite + React 19 + TypeScript + Tailwind v4 + vite-plugin-pwa. Framsteg sparas i localStorage. Ljud via Web Speech API (zh-CN TTS + taligenkänning) och `pinyin-pro` för att jämföra det som sagts.

## Team och filägarskap
| Roll | Äger | Levererar |
|---|---|---|
| Lead (huvud-Claude) | `src/types.ts`, `src/ui/`, `PLAN.md` | Kontrakt, integration, verifiering |
| 1. Kursdesigner | `src/data/` | Kursinnehåll: enheter, lektioner, ord, meningar, tips |
| 2. Röst & pinyin | `src/speech/` | TTS, taligenkänning, pinyin-verktyg, tonfärger, ljudeffekter |
| 3. Lektionsmotor | `src/exercises/` | Övningsgenerator + alla övningstyper + LessonPlayer |
| 4. Framsteg | `src/progress/` | Lagring, XP, streak, spaced repetition (SRS), inställningar |
| 5. App-skal & design | `src/app/`, `App.tsx`, `main.tsx`, `index.css`, `vite.config.ts`, `public/` | Hemskärm (lektionsstig), repetition, ordlista, profil/inställningar, PWA |

Regel: skriv bara i dina egna mappar. Kontrakten i `src/types.ts` och stub-API:erna i varje moduls `index.ts` får inte ändras utan att lead godkänner det.

## Övningstyper
intro · lyssna → välj · svenska → pinyin · pinyin → svenska · ton-quiz · para ihop · bygg meningen (pinyin) · bygg översättningen (svenska) · skriv pinyin (`shui3` godkänns) · säg det (mikrofon)

## Faser
1. **v1 (nu):** kurs A1 (~10 enheter), alla övningstyper, XP, streak, SRS-repetition, tontränare, ordlista, PWA offline
2. **v2:** publicering (GitHub Pages / Netlify) för installation på telefonen, förinspelat/AI-ljud om TTS-kvaliteten inte räcker, fler enheter
3. **v3:** samtalsläge med AI (rollspel på pinyin)
