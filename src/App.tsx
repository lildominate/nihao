// OWNER: Design/Shell (agent 1). App shell: onboarding, five tabs, full-screen sessions and dialogues.
import { useEffect, useState } from 'react'
import type { Dialogue, Lesson } from './types'
import { course } from './data/course'
import { generateLessonExercises, generateReviewExercises } from './exercises'
import { lessonParts, nextPartIndex, PART_MAX_SCORED } from './exercises/parts'
import { useProgress } from './progress'
import { isRecognitionAvailable, playSfx, setDefaultSpeechRate, setMultiVoice } from './speech'
import { MotivationOverlays } from './motivation'
import { GamesHub, PlayGame } from './games'
import { lessonGenOptions, PlacementTest, reviewGenOptions } from './pedagogy'
import { localDay } from './progress'
import { DailyCard, DayBetween } from './daily/DailyCard'
import { loadDay, planDay, saveDay } from './daily/plan'
import type { Craving, DayRecord, Energy, StepKind } from './daily/plan'
import { VideoCourse } from './videos/VideoCourse'
import { SongLesson, SONGS } from './songs/SongLesson'
import { seenDialogues } from './app/util'
import { setTapSound, Splash, Transition } from './motion'
import { APP_VERSION } from './version'
import { TabBar } from './app/chrome'
import { DialogueScreen } from './app/DialogueScreen'
import { LearnScreen } from './app/LearnScreen'
import { ProfileScreen } from './app/ProfileScreen'
import { ReviewScreen } from './app/ReviewScreen'
import { Session, type SessionSpec } from './app/Session'
import { Welcome } from './app/Welcome'
import { DesignGallery } from './app/DesignGallery'
import { WordsScreen } from './app/WordsScreen'
import { useTab } from './app/router'
import { useThemeSync } from './app/theme'
import { ONBOARDED_KEY, safeGet, safeRemove, safeSet } from './app/util'

export default function App() {
  const progress = useProgress()
  const { settings } = progress.state
  const [tab, setTab] = useTab()
  const [onboarded, setOnboarded] = useState(() => safeGet(ONBOARDED_KEY) === '1')
  const [placement, setPlacement] = useState(false)
  const [session, setSession] = useState<SessionSpec | null>(null)
  const [dialogue, setDialogue] = useState<Dialogue | null>(null)
  const [splash, setSplash] = useState(true) // once per cold start
  // Dagens pass: the day's plan, whether we're between steps, and the non-session step layers.
  const [day, setDay] = useState<DayRecord | null>(() => loadDay(localDay()))
  const [dayActive, setDayActive] = useState(false)
  const [between, setBetween] = useState(false)
  const [gameOpen, setGameOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [songOpen, setSongOpen] = useState<(typeof SONGS)[number] | null>(null)

  useThemeSync(settings)
  useEffect(() => { setDefaultSpeechRate(settings.speechRate) }, [settings.speechRate])
  useEffect(() => { setMultiVoice(settings.multiVoice ?? true) }, [settings.multiVoice])
  useEffect(() => { setTapSound(() => { if (settings.soundEffects) playSfx('tap') }) }, [settings.soundEffects])

  // Lock background scroll while a full-screen layer is open.
  const overlay = !onboarded || !!session || !!dialogue || gameOpen || videoOpen || !!songOpen || between
  useEffect(() => {
    document.body.style.overflow = overlay ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [overlay])

  const startLesson = (lesson: Lesson, unitIndex: number) => {
    // Short lessons: play the next part (≤3 new words, ~10–13 steps); same lesson id throughout.
    const parts = lessonParts(lesson, course)
    const index = nextPartIndex(lesson.id, parts.length)
    const exercises = generateLessonExercises(parts[index], course, {
      ...lessonGenOptions(progress, { speaking: settings.speakingExercises && isRecognitionAvailable() }),
      maxScored: lesson.kind === 'checkpoint' ? 12 : PART_MAX_SCORED,
    })
    setSession({ kind: 'lesson', lesson: parts[index], unitIndex, exercises, part: { index, count: parts.length } })
  }

  // ─── Dagens pass ───
  const nextLesson = () => {
    for (let ui = 0; ui < course.units.length; ui++) {
      const lesson = course.units[ui].lessons.find((l) => progress.lessonStatus(l.id) === 'available')
      if (lesson) return { lesson, ui }
    }
    return null
  }
  const nextDialogue = () => {
    const seen = seenDialogues()
    const done = new Set(Object.keys(progress.state.completedLessons))
    const open = Object.values(course.dialogues ?? {}).filter((d) => done.has(d.afterLessonId))
    return open.find((d) => !seen.has(d.id)) ?? open[0] ?? null
  }
  const songWithLyrics = () => {
    try {
      const all = JSON.parse(localStorage.getItem('nihao/songs/v1') ?? '{}') as Record<string, string>
      return SONGS.find((s) => all[s.id]?.trim()) ?? null
    } catch { return null }
  }

  const runStep = (step: StepKind) => {
    const speaking = settings.speakingExercises && isRecognitionAvailable()
    if (step === 'review') {
      const items = progress.dueItems(15)
      const pick = items.length ? items : progress.weakItems(12)
      setSession({ kind: 'practice', title: 'Repetera', emoji: '🔁', exercises: generateReviewExercises(pick, course, reviewGenOptions(progress, { speaking })) })
    } else if (step === 'lesson') {
      const n = nextLesson()
      if (n) startLesson(n.lesson, n.ui); else stepDone()
    } else if (step === 'dialogue') {
      const d = nextDialogue()
      if (d) setDialogue(d); else stepDone()
    } else if (step === 'song') {
      const s = songWithLyrics()
      if (s) setSongOpen(s); else stepDone()
    } else if (step === 'game') setGameOpen(true)
    else setVideoOpen(true)
  }

  const startDay = (energy: Energy, craving: Craving) => {
    const existing = loadDay(localDay())
    // Unfinished plan today → continue it; otherwise plan a fresh one.
    const rec: DayRecord = existing && existing.done < existing.steps.length ? existing : {
      day: localDay(),
      steps: planDay(energy, craving, {
        dueCount: progress.dueItems().length,
        hasNextLesson: !!nextLesson(),
        knownWords: progress.knownWordIds().length,
        hasDialogue: !!nextDialogue(),
        hasVideo: true,
        hasSong: !!songWithLyrics(),
      }),
      done: 0,
    }
    saveDay(rec); setDay(rec); setDayActive(true)
    runStep(rec.steps[rec.done])
  }

  /** A step's layer closed: count it and show "Nästa: …". */
  const stepDone = () => {
    if (!dayActive || !day) return
    const rec = { ...day, done: day.done + 1 }
    saveDay(rec); setDay(rec); setBetween(true)
  }
  const nextStep = () => { setBetween(false); if (day) runStep(day.steps[day.done]) }
  const stopDay = () => { setBetween(false); setDayActive(false); setTab('learn') }

  const closeSession = () => {
    if (session?.kind === 'lesson' && !dayActive) setTab('learn')
    setSession(null)
    stepDone()
  }

  const finishOnboarding = () => { safeSet(ONBOARDED_KEY, '1'); setOnboarded(true); setPlacement(false); setTab('learn') }

  if (import.meta.env.DEV && window.location.hash === '#/design') return <DesignGallery />

  if (splash) return <Splash onDone={() => setSplash(false)} tagline="lär dig tala kinesiska" version={APP_VERSION} />

  if (!onboarded) {
    if (placement) {
      return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
          <div className="mx-auto min-h-full max-w-md pt-safe pb-safe px-safe">
            <PlacementTest
              onCancel={() => setPlacement(false)}
              onDone={(lessonId) => { if (lessonId) progress.skipToLesson(lessonId); finishOnboarding() }}
            />
          </div>
        </div>
      )
    }
    return <Welcome onDone={finishOnboarding} onPlacement={() => setPlacement(true)} />
  }

  return (
    <div className="canvas-bg min-h-full">
      <div className="mx-auto min-h-dvh max-w-md px-safe pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:border-x sm:border-line/70">
        <main>
          <Transition swapKey={tab} kind="fade">
            {tab === 'learn' && <LearnScreen onStartLesson={startLesson} onStartDialogue={setDialogue} top={<DailyCard today={day} onStart={startDay} />} />}
            {tab === 'practice' && <ReviewScreen onStart={setSession} />}
            {tab === 'games' && <GamesHub />}
            {tab === 'words' && <WordsScreen />}
            {tab === 'profile' && <ProfileScreen onReplayIntro={() => { safeRemove(ONBOARDED_KEY); setOnboarded(false) }} />}
          </Transition>
        </main>
      </div>
      {!overlay && <TabBar tab={tab} onTab={setTab} reviewBadge={progress.dueItems().length} />}
      {session && <Session spec={session} onClose={closeSession} />}
      {dialogue && <DialogueScreen dialogue={dialogue} onClose={() => { setDialogue(null); stepDone() }} />}
      {gameOpen && <PlayGame gameId="auto" onDone={() => { setGameOpen(false); stepDone() }} />}
      {videoOpen && <VideoCourse openNext onClose={() => { setVideoOpen(false); stepDone() }} />}
      {songOpen && <SongLesson song={songOpen} onClose={() => { setSongOpen(null); stepDone() }} />}
      {between && day && <DayBetween day={day} onNext={nextStep} onStop={stopDay} />}
      <MotivationOverlays paused={overlay} />
    </div>
  )
}
