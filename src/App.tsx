// OWNER: Shell agent. App shell: onboarding, tabs, full-screen sessions.
import { useEffect, useState } from 'react'
import type { Lesson } from './types'
import { course } from './data/course'
import { generateLessonExercises } from './exercises'
import { useProgress } from './progress'
import { isRecognitionAvailable, setDefaultSpeechRate } from './speech'
import { TabBar } from './app/chrome'
import { LearnScreen } from './app/LearnScreen'
import { ProfileScreen } from './app/ProfileScreen'
import { ReviewScreen } from './app/ReviewScreen'
import { Session, type SessionSpec } from './app/Session'
import { Welcome } from './app/Welcome'
import { WordsScreen } from './app/WordsScreen'
import { useTab } from './app/router'
import { ONBOARDED_KEY, safeGet, safeRemove, safeSet } from './app/util'

export default function App() {
  const progress = useProgress()
  const { settings } = progress.state
  const [tab, setTab] = useTab()
  const [onboarded, setOnboarded] = useState(() => safeGet(ONBOARDED_KEY) === '1')
  const [session, setSession] = useState<SessionSpec | null>(null)

  useEffect(() => { setDefaultSpeechRate(settings.speechRate) }, [settings.speechRate])

  // Lock background scroll while a full-screen layer is open.
  const overlay = !onboarded || !!session
  useEffect(() => {
    document.body.style.overflow = overlay ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [overlay])

  const startLesson = (lesson: Lesson, unitIndex: number) => {
    const exercises = generateLessonExercises(lesson, course, {
      knownWordIds: progress.knownWordIds(),
      speaking: settings.speakingExercises && isRecognitionAvailable(),
    })
    setSession({ kind: 'lesson', lesson, unitIndex, exercises })
  }

  const closeSession = () => {
    if (session?.kind === 'lesson') setTab('learn')
    setSession(null)
  }

  if (!onboarded) {
    return <Welcome onDone={() => { safeSet(ONBOARDED_KEY, '1'); setOnboarded(true); setTab('learn') }} />
  }

  return (
    <div className="min-h-full bg-surface-2/70">
      <div className="mx-auto min-h-dvh max-w-md bg-surface px-safe pb-[calc(5rem+env(safe-area-inset-bottom))] sm:border-x-2 sm:border-line">
        <main key={tab}>
          {tab === 'learn' && <LearnScreen onStartLesson={startLesson} />}
          {tab === 'review' && <ReviewScreen onStart={setSession} />}
          {tab === 'words' && <WordsScreen />}
          {tab === 'profile' && <ProfileScreen onReplayIntro={() => { safeRemove(ONBOARDED_KEY); setOnboarded(false) }} />}
        </main>
      </div>
      {!session && <TabBar tab={tab} onTab={setTab} reviewBadge={progress.dueItems().length} />}
      {session && <Session spec={session} onClose={closeSession} />}
    </div>
  )
}
