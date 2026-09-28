// Dev-only playground for the lesson engine.
//   /src/exercises/_playground/index.html                 → v2 demo (every new exercise type, fixture dialogue)
//   ?mode=gen&lesson=u1-l1&seed=1                          → generator output for a fixture lesson
//   ?mode=real&pick=3                                      → new types built from the real course dialogues
//   &only=shadow                                           → keep one exercise type
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { generateLessonExercises } from '../generate'
import { LessonPlayer, type LessonSummary } from '../LessonPlayer'
import type { LessonResult } from '../../types'
import { playCourse, v2Exercises } from './fixture'
import { realDemo } from './realDemo'
import { course as realCourse } from '../../data/course'

const q = new URLSearchParams(location.search)
const mode = q.get('mode') ?? 'v2'
const lesson = playCourse.units[0].lessons.find((l) => l.id === (q.get('lesson') ?? 'u1-l1'))!
const only = q.get('only')
const activeCourse = mode === 'real' ? realCourse : playCourse

function App() {
  const [res, setRes] = useState<LessonResult | null>(null)
  const [summary, setSummary] = useState<LessonSummary | null>(null)
  const [ex] = useState(() => {
    const all = mode === 'gen'
      ? generateLessonExercises(lesson, playCourse, { seed: Number(q.get('seed') ?? 1), speaking: true, knownWordIds: ['shui', 'cha', 'ta'] })
      : mode === 'real' ? realDemo(realCourse, Number(q.get('pick') ?? 0)) : v2Exercises
    return only ? all.filter((e) => e.type === only) : all
  })
  if (res) return <pre id="result" className="p-4 text-xs whitespace-pre-wrap">{JSON.stringify({ result: res, summary }, null, 2)}</pre>
  return (
    <LessonPlayer
      exercises={ex}
      lessonId={mode === 'gen' ? lesson.id : 'v2-demo'}
      course={activeCourse}
      onSummary={setSummary}
      onFinish={setRes}
      onExit={() => setRes({ lessonId: 'EXIT', total: 0, correct: 0, mistakes: 0, durationMs: 0, items: [] })}
    />
  )
}
createRoot(document.getElementById('root')!).render(<StrictMode><ProgressProvider><App /></ProgressProvider></StrictMode>)
