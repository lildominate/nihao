// OWNER: Design/Shell (agent 1). App shell: onboarding, five tabs, full-screen sessions and dialogues.
import { useEffect, useState } from 'react'
import type { Dialogue, Lesson } from './types'
import { course } from './data/course'
import { generateLessonExercises } from './exercises'
import { lessonParts, nextPartIndex, PART_MAX_SCORED } from './exercises/parts'
import { useProgress } from './progress'
import { isRecognitionAvailable, playSfx, setDefaultSpeechRate, setMultiVoice } from './speech'
import { MotivationOverlays } from './motivation'
import { GamesHub } from './games'
import { lessonGenOptions, PlacementTest } from './pedagogy'
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

  useThemeSync(settings)
  useEffect(() => { setDefaultSpeechRate(settings.speechRate) }, [settings.speechRate])
  useEffect(() => { setMultiVoice(settings.multiVoice ?? true) }, [settings.multiVoice])
  useEffect(() => { setTapSound(() => { if (settings.soundEffects) playSfx('tap') }) }, [settings.soundEffects])

  // Lock background scroll while a full-screen layer is open.
  const overlay = !onboarded || !!session || !!dialogue
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

  const closeSession = () => {
    if (session?.kind === 'lesson') setTab('learn')
    setSession(null)
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
            {tab === 'learn' && <LearnScreen onStartLesson={startLesson} onStartDialogue={setDialogue} />}
            {tab === 'practice' && <ReviewScreen onStart={setSession} />}
            {tab === 'games' && <GamesHub />}
            {tab === 'words' && <WordsScreen />}
            {tab === 'profile' && <ProfileScreen onReplayIntro={() => { safeRemove(ONBOARDED_KEY); setOnboarded(false) }} />}
          </Transition>
        </main>
      </div>
      {!session && !dialogue && <TabBar tab={tab} onTab={setTab} reviewBadge={progress.dueItems().length} />}
      {session && <Session spec={session} onClose={closeSession} />}
      {dialogue && <DialogueScreen dialogue={dialogue} onClose={() => setDialogue(null)} />}
      <MotivationOverlays paused={!!session || !!dialogue} />
    </div>
  )
}
