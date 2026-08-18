import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// ⚠ THROWAWAY DEV-ONLY SKETCH SURFACE (sketch 179). This app has no url router
// (SEED-185), so the sketch is reached by the same guarded-pathname escape hatch /setup
// and /invite already use — but gated HERE rather than inside App(), because an early
// return inside App() would skip the hooks below it (rules-of-hooks) and because the
// sketch must not depend on the backend probe that gates App's render.
// DELETE THIS BRANCH AND src/dev/SketchLibraryCard.tsx IN ONE COMMIT when the sketch
// closes. Any non-/sketch-card visit is byte-identical to before.
import { SketchLibraryCard } from './dev/SketchLibraryCard'

const isSketch = window.location.pathname === '/sketch-card'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSketch ? <SketchLibraryCard /> : <App />}
  </StrictMode>,
)
