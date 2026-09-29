// Dev-only harness: /src/themes/_harness/index.html (port 5198)
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { ThemesSection, ThemeGameEntry } from '..'
import { Session, type SessionSpec } from '../../app/Session'
import { fixtureThemed } from '../fixture'

const useFixture = new URLSearchParams(location.search).has('fixture')
function Harness() {
  const [spec, setSpec] = useState<SessionSpec | null>(null)
  const [entry, setEntry] = useState(false)
  const c = useFixture ? fixtureThemed : undefined
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas p-4">
      <button id="entry" onClick={() => setEntry(true)}>Spelhallen-entry</button>
      <ThemesSection course={c} onStartLesson={setSpec} />
      {spec && <Session spec={spec} onClose={() => setSpec(null)} />}
      {entry && <ThemeGameEntry course={c} onExit={() => setEntry(false)} />}
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<StrictMode><ProgressProvider><Harness /></ProgressProvider></StrictMode>)
