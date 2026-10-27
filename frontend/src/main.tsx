import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
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

// Phase 297-02 (LINK-01 / D-07) — ONE catch-all route, created once at module scope.
//
// ⛔ ONE ROUTE, NO CHILDREN, NO KEY. Every address matches this same route, so React keeps the
// same `<App />` element mounted across every navigation — and with it OrgProvider and
// StreamsProvider, whose unmount would abort every live answer's stream. A nested route, an
// outlet above the providers, or a path-derived key would each remount that stack. App reads
// the address through `useAppNavigation` (the only caller of the router hooks, D-08).
// ⛔ Never held in React state or created during render.
const router = createBrowserRouter([{ path: '*', Component: App }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
