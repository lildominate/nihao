// Dev-only playground for the lesson engine: /src/exercises/_playground/index.html?lesson=u1-l1&seed=1
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { fixtureCourse } from '../fixture.test-data'
import { generateLessonExercises } from '../generate'
import { LessonPlayer } from '../LessonPlayer'
import type { LessonResult } from '../../types'

const q = new URLSearchParams(location.search)
const lesson = fixtureCourse.units[0].lessons.find((l) => l.id === (q.get('lesson') ?? 'u1-l1'))!
const only = q.get('only')

function App() {
  const [res, setRes] = useState<LessonResult | null>(null)
  const [ex] = useState(() => {
    const all = generateLessonExercises(lesson, fixtureCourse, { seed: Number(q.get('seed') ?? 1), speaking: true, knownWordIds: ['shui', 'cha', 'ta'] })
    return only ? all.filter((e) => e.type === only) : all
  })
  if (res) return <pre id="result" className="p-4 text-xs whitespace-pre-wrap">{JSON.stringify(res, null, 2)}</pre>
  return <LessonPlayer exercises={ex} lessonId={lesson.id} course={fixtureCourse} onFinish={setRes} onExit={() => setRes({ lessonId: 'EXIT', total: 0, correct: 0, mistakes: 0, durationMs: 0, items: [] })} />
}
createRoot(document.getElementById('root')!).render(<StrictMode><ProgressProvider><App /></ProgressProvider></StrictMode>)
