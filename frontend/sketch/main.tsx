/**
 * ⚠ THROWAWAY — SKETCH 202's entry point. Delete `frontend/sketch/` at teardown.
 *
 * ── ⚠ NO `ThemeProvider`, AND THAT IS A MEASURED DECISION, NOT AN OMISSION ────────────
 *
 * The first draft mirrored `src/main.tsx` and wrapped this in `ThemeProvider`. Driven in a
 * browser, the sketch rendered on `rgb(246, 247, 249)` — LIGHT — because the provider's
 * `getInitialTheme` falls through to `prefers-color-scheme` when no choice is stored, and its
 * effect then STRIPPED the `class="dark"` this sketch's `index.html` sets. The Stitch
 * reference is Deep Midnight and every colour judgement here depends on the ground.
 *
 * ⚠ SEEDING THE PROVIDER'S KEY WOULD HAVE BEEN WORSE. It persists to `localStorage["theme"]`,
 * and the dev server serves this sketch from the SAME ORIGIN as the real app — so
 * `setItem("theme", "dark")` here silently overwrites the operator's own app preference. A
 * sketch must not mutate the environment it is being judged in.
 *
 * So the theme is set once, statically, by `class="dark"` on `<html>` in `index.html`, and no
 * provider is mounted. That is safe because `ThemeProvider`'s own docblock records a
 * non-throwing accessor (`useThemeOptional`) precisely so components can mount without it —
 * *"four canvas suites mount with no provider"* — and this sketch mounts no canvas.
 *
 * ⚠ NO `StrictMode` either. The shipped entry uses it; this deliberately does not. `RunSpine`
 * and `RunTranscript` are pure renders here (no fetch, no stream, no store), so the double
 * invoke buys nothing — and a sketch that double-renders reads wrong to the eye judging it.
 */
import { createRoot } from "react-dom/client"
import "../src/index.css"
import { SketchRunColumn } from "./SketchRunColumn"

createRoot(document.getElementById("root")!).render(<SketchRunColumn />)
