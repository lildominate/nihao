# PEDAGOGY — how Nǐ hǎo teaches

Owner: pedagogy agent (7). This file is binding for the generator (`src/exercises/generate.ts`), the scheduler (`src/progress/fsrs.ts`) and anyone who adds a practice mode. Every principle below comes with the concrete rule that the code applies.

## 1. Spacing (the distributed practice effect)
Evidence: Cepeda et al. 2006 (meta-analysis); Kornell 2009. The same study time spread over days beats cramming.
- The scheduler is **FSRS-5** with the default weights and a **target retention of 0.9**. The next interval equals the stability S. The code has no dependencies (`src/progress/fsrs.ts`).
- Every item (word, sentence, or dialogue line `dialogueId:index`) has a card. Only the **first attempt per item per session** is graded (wrong → Again, right → Good).
- The very first correct answer uses S₀(Hard) ≈ 1.2 days, which gives a 1-day first interval. That answer comes seconds after the intro card, so it is weak evidence of learning.
- A correct answer given **again on the same day** does not change the schedule. Replays, games and review on the same day can't inflate intervals.
- A wrong answer always brings the item back **tomorrow** and counts a lapse. Mistakes come back.
- Early reviews gain little and overdue successes gain a lot, because FSRS uses the real elapsed time.

## 2. Retrieval practice (the testing effect)
Evidence: Roediger & Karpicke 2006; Karpicke & Blunt 2011. Recalling beats re-reading.
- Every item is tested right after its intro. There are no "study only" screens beyond one intro card per new word.
- The intro card is followed by an **easy recognition check** at once. The pairs are intro, intro, check, check.

## 3. Production over recognition (mastery ladder)
Evidence: generation effect (Slamecka & Graf 1978). Output in SLA (Swain 1985).
Mastery 0–5 comes from FSRS stability and successful reps (`masteryOfCard`):

| Mastery | Meaning | Words | Sentences | Dialogue lines |
|---|---|---|---|---|
| 0 | unseen | intro → recognition | build-sv, listen/pinyin-to-sv | dialogue-reply |
| 1 | seen / just lapsed | intro again + recognition | same | dialogue-reply, fill-blank |
| 2 | S < 3 d | sv-to-pinyin, type-pinyin | **fill-blank**, build-pinyin | dialogue-reply, fill-blank, listen-build |
| 3 | S < 10 d | same | same | same |
| 4 | S < 30 d, ≥3 reps | **type-pinyin, speak** | **listen-build, shadow, speak** | listen-build, shadow |
| 5 | S ≥ 30 d, ≥4 reps | same | same | same |

The table is `preferredTypes()`, a weighted random preference with fallbacks. Inside one lesson, fresh words still ramp from recognition to production. Exercises are ordered by tier (recognition → match/build → choice-production → typed/spoken), and the same item never appears twice in a row.

## 4. Desirable difficulties and confusables
Evidence: Bjork 1994. Hard-but-achievable retrieval strengthens memory. Interference research warns against presenting look-alikes together too early.
- **Confusable options are kept apart** in the same multiple-choice question and in match-pairs:
  - same opening syllables, e.g. *lǎo shī hǎo* vs *lǎo shī, zài jiàn*
  - ≥ 50 % syllable overlap
  - tonal minimal pairs, e.g. *mā / mǎ*
  - Swedish answers that share most words, e.g. *hej* / *hej då*
- At **mastery ≥ 4** the question becomes intentionally **contrastive**: one confusable distractor is allowed on purpose.
- Punctuation attached to chunks ("lǎo shī ,") is ignored when comparing items. A bare punctuation chunk is never blanked.

## 5. Interleaving
Evidence: Rohrer & Taylor 2007; Kang 2016.
- Every standard lesson reserves **25 %** of its scored exercises (`REVIEW_SHARE`, 4–5 of 18) for **due and weak items from earlier lessons**. These are spread evenly through the lesson body, not stuck at the end. Their exercise type follows their own mastery.
- Review sessions mix words, sentences and lines, and are ordered by tier.

## 6. Comprehensible input and chunks
Evidence: Krashen's i+1; lexical-chunk approach (Lewis 1993; Boers & Lindstromberg 2009).
- Sentences and dialogue lines are practised as **chunks**: tiles are word-level chunks, never single letters.
- Once a unit's dialogue is unlocked (its `afterLessonId` is completed), lessons and checkpoints in that unit include **dialogue-reply**. The learner sees the previous line and picks the reply. Weak lines come first, and strong lines get listen-build instead.
- Audio plays everywhere. listen-build and shadow are audio-only at the top of the ladder.

## 7. Tones: high-variability phonetic training (HVPT)
Evidence: Wang, Spence, Jongman & Sereno 1999. Training with several talkers improves tone perception and transfers to new voices.
- Tone-pick exercises get the hint `voice: 'rotate'` when `settings.multiVoice` is on (the default is on). Players pass it to `speak(hanzi, { voice })`.
- Tone lessons and the tone drill are balanced across the 4 tones, and the same syllable never plays twice in a row.

## 8. Short daily sessions
Evidence: spacing research; habit formation (Lally et al. 2010).
- A lesson has at most 18 scored exercises (about 5 minutes), and a tone lesson at most 16.
- There are no hearts and no lockouts. The placement test gives neutral feedback, and "Vet inte" is always allowed.

## 9. Placement test
- The test asks 10–15 adaptive questions. It alternates **listen → meaning** and **Swedish → pinyin**.
- It uses a Bayesian estimate of K, the number of lessons already known. The model assumes P(correct | known) = 0.9 and P(correct | unknown) = 0.3.
- Each question probes the posterior median. The first two probe the 20th percentile, so beginners start with easy words.
- The test stops at 15 questions, or once the 80 % interval spans ≤ 2 lessons (after ≥ 10 questions). A clear beginner stops after 4.
- The result is conservative (the 30th percentile), and a skip needs at least 2 known lessons. Skipping too far hurts more than a little repetition.
- `skipToLesson(id)` completes the earlier lessons and seeds their words as fragile known cards: S = 2 d, 1 rep, mastery 2. Their due dates are staggered over 1–4 days, so FSRS verifies them quickly.

## Rules for new practice modes (games, lab, dialogues)
1. Report results through `finishSession({ …, source })` with **item refs**, so FSRS sees every retrieval. Only the first attempt per item counts.
2. Pick exercise types for an item with `preferredTypes(kind, mastery, speaking)`. Don't hard-code a recognition task for a mastered item.
3. Never put two confusable options side by side unless the task is explicitly a contrast drill. Use `confusablePinyin` / `confusableSv`.
