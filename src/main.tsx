import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ProgressProvider } from './progress'
import { MotivationProvider } from './motivation'
import { MotionSettingsSync } from './motion'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <MotionSettingsSync />
      <MotivationProvider>
        <App />
      </MotivationProvider>
    </ProgressProvider>
  </StrictMode>,
)
