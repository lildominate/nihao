// Dev-only: Spelhallen harness server without HMR/file watching (other agents edit in parallel).
// npx vite --config src/games/_harness/vite.harness.config.ts
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  root: new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  plugins: [react(), tailwindcss()],
  server: { port: 5196, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } },
})
