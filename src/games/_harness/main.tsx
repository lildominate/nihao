// Dev-only harness for Spelhallen: /src/games/_harness/index.html
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../index.css'
import { ProgressProvider } from '../../progress'
import { GamesHub } from '..'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <div className="mx-auto min-h-dvh max-w-md bg-surface"><GamesHub /></div>
    </ProgressProvider>
  </StrictMode>,
)
