---
id: SEED-049
title: E2E Playwright suite revival — tests can't drive the current composer/streaming UI (075.x/087/088 drift)
status: planted
planted: 2026-06-02
planted_by: orchestrator (092.5-06 close — E2E de-rot follow-up)
trigger_when: any phase that wants the Playwright E2E backstop to gate (esp. a chat-surface / streaming / RunCard / workspace phase), OR before a milestone close that claims E2E coverage, OR when CI frontend-tests.yml is turned on for real
priority: medium
tags: [frontend/e2e, playwright, test-debt, chat-ui, streaming, runcard, 075.x, 087, 088]
---

# SEED-049: E2E Playwright Suite Revival

## Context (how it surfaced)

During the Phase 092.5 close, the operator ran the full `frontend/tests/e2e` Playwright
suite (`scenario-01..13`, 17 tests). Result: **16 failed / 1 passed (scenario-08), 8.3 min.**
None of the failures are 092.5 regressions — 092.5 is a backend provider-gateway refactor
proven byte-identical by the SSE diff + eval + 14-agent adversarial review, and a browser
keystroke registering is orthogonal to it.

## Root cause: test-app-driving drift, not selector typos

Decisive evidence — scenario-07's page snapshot AT the 30s timeout:

```
- main:
  - heading "New Chat"                 ← still the empty welcome screen
  - textbox "Ask anything…"             ← composer EMPTY
  - button "Send message" [disabled]    ← nothing was submitted
```

The test typed `TOOL_PROMPT` into the composer and pressed Enter, but **the text never
registered against the current composer**, so Send stayed disabled, no run started, and the
downstream `[data-testid="run-card"]` / streaming-indicator / `collapsed-row` waits all timed
out (scenario-10 and -12 sat the full **180s**). The suite was authored across phases
075.4 / 075.7 / 088; the composer-submit interaction + streaming/RunCard signals have since
drifted (StatusPill/RunCard rework, composer `canSend` gating, model-pill consolidation).

This is a real test-revival effort (≈ phase-sized), NOT a one-line selector swap — it needs
live-app (Chrome MCP) rediscovery of: (1) how to type+submit into the current composer
reliably, (2) the current "streaming in progress" DOM signal, (3) the current RunCard /
collapsed-tool-row selectors.

## Already fixed (quick wins, committed 2026-06-02, commit e68fdca6)

These two were static and are DONE — they make the next revival pass much cheaper:

1. **Env bootstrap** — `playwright.config.ts` now auto-loads `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env` if unset (the db-teardown LOCALHOST_RE
   guard still independently protects). Previously ALL 17 died instantly on unset
   `SUPABASE_URL`.
2. **scenario-01 `/login` assertion** — replaced the stale `not.toHaveURL(/login/)` (the app
   keeps `/login` after auth and re-renders chat inline; auth.fixture.ts documents this as a
   "false-positive trap") with the composer-visible assertion the fixture itself uses.
   scenario-01 now runs the real flow instead of dying at step 1.

## Failure buckets (for the revival pass)

| Bucket | Scenarios | Action |
|---|---|---|
| Composer/submit interaction drift (primary) | 01, 02, 04, 05, 07, 09×4, 10, 11, 12 | Chrome-MCP rediscover type+submit + streaming/RunCard selectors; fix once, apply across |
| RED by design | 06 | iteration-parity measurement — leave red or re-baseline |
| Live multi-step flow | 13 ×2 (anthropic/google) | workspace write→diff→ask_user→resume; needs the submit fix first + live providers |
| Provider-credit-dependent | 03 (OpenRouter), maybe 05 | needs OpenRouter credit to pass |
| Passing | 08 | reference for a working interaction path |

## Likely shape if promoted

1. Drive the live app via Chrome MCP; capture the exact composer type+submit sequence that
   reliably starts a run on the current UI (likely a `data-testid` on the composer + Send,
   or a `.fill()` + explicit Send-enabled wait instead of `pressSequentially`+Enter).
2. Define stable `data-testid`s on the streaming indicator + RunCard + collapsed-row if the
   current DOM lacks them (small frontend add — coordinate with whoever owns ToolCallPanel).
3. Update the shared interaction into the auth/helper layer so all scenarios use one driver.
4. Re-baseline scenario-06 (or keep it explicitly RED). Gate scenario-03 on OpenRouter credit.
5. Wire `.github/workflows/frontend-tests.yml` once green.

## Re-open trigger (concrete)

Promote when a phase needs the E2E backstop to actually gate (most likely a chat-surface /
streaming / panel phase, e.g. Phase 094 workflow-legibility panel), or at the v2.8 milestone
close if E2E coverage is claimed. Until then the backstop is known-rotted and should NOT be
treated as a passing gate (092.5 explicitly deferred it).
