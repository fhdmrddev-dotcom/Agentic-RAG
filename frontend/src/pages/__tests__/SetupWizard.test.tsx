/**
 * Phase 158 (DEPLOY-02, Wave 0) — the pre-auth /setup branch + finalized lock-out (SC#1/2, D-06).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Wave 8/11 replaces each todo with a live render
 * test once `App.tsx` gains the pre-auth branch (a public GET /api/setup/status probe → render
 * the wizard INSTEAD of AuthPage/ChatLayout) and the wizard page + its finalized lock-out land.
 *
 * D-06 (no react-router): a `window.location.pathname === "/setup"` check honors the literal
 * path (nginx SPA-falls-back any path to index.html), so typing /setup works AND a fresh box
 * auto-shows the wizard. Post-finalize, /setup renders an "already configured" lock-out (SC#2),
 * never a config field — re-configuration is an /admin operator action (D-14).
 *
 * Deliberately imports NOTHING from the wizard page or App branch — neither exists yet;
 * `it.todo` takes only a string, so this file collects GREEN (pending) until Wave 8/11.
 */
import { describe, it } from "vitest"

describe("App pre-auth branch — needs_setup entry (SC#1 / D-06)", () => {
  it.todo("App renders the setup wizard when GET /api/setup/status returns needs_setup:true")
  it.todo("a `window.location.pathname === '/setup'` visit forces the wizard even when configured")
  it.todo("a configured box (needs_setup:false, no /setup path) renders AuthPage/ChatLayout, NOT the wizard")
})

describe("finalized lock-out — post-finalize /setup (SC#2 / D-14)", () => {
  it.todo("post-finalize /setup renders the 'Setup is already complete' lock-out, never a config field")
  it.todo("the lock-out directs re-configuration to the /admin operator surface, not the public wizard")
})

// Wave 8/11 replaces each it.todo with a live render test importing the wizard page + App branch.
