// Dev-only preview of the placement test: /src/pedagogy/_preview/index.html
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { PlacementTest } from '../PlacementTest'

function Demo() {
  const [done, setDone] = useState<string | null | undefined>(undefined)
  if (done !== undefined) return <p className="p-6 text-lg" id="done">onDone: {String(done)}</p>
  return <PlacementTest seed={3} onDone={(id) => setDone(id)} onCancel={() => setDone('cancel')} />
}

createRoot(document.getElementById('root')!).render(<StrictMode><ProgressProvider><Demo /></ProgressProvider></StrictMode>)
