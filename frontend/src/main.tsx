import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Phase 200-06 (BUG-260813-01) — the ONE theme state, mounted ABOVE `<App />`.
//
// Above rather than inside, because the theme is the outermost visual fact in the product
// and every surface that can ask for it lives under `<App />`: the chat shell (which owns
// the toggle), the workspace panel, and the workflow canvas on BOTH of its pages. A
// provider mounted beside its first consumer is one a second consumer eventually renders
// outside of, and outside this provider the throwing hook is a runtime error.
import { ThemeProvider } from '@/providers/ThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
