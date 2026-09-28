// OWNER: Speech/Lab agent. Dev-only harness: /src/lab/_preview/index.html renders LabHub standalone.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { LabHub } from '..'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <div className="mx-auto min-h-dvh max-w-md bg-surface px-4 py-5">
        <LabHub />
      </div>
    </ProgressProvider>
  </StrictMode>,
)
