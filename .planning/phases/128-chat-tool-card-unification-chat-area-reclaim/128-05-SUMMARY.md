---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 05
status: complete
verdict: partial-pass
completed: 2026-06-27
---

# Plan 128-05 SUMMARY — D-06 LIVE Cross-Provider Scoreboard

## Outcome: PARTIAL PASS (honest — core verified live, exhaustive run deferred)

The D-06 cross-provider scoreboard was executed operator-driven and recorded in
`128-VALIDATION.md` (§ "Scoreboard Results — executed 2026-06-27"). It is recorded
honestly as a **partial pass** — the core CTC-01/CTC-02 visual contract was verified
LIVE, and the full native-7 × 4-axis exhaustive sweep is explicitly **deferred**, not
faked.

## What was verified

**LIVE (operator-confirmed):**
- The real `@lobehub/icons` provider mark **loads correctly per provider/model** on the
  unified tool card, and is **legible + looks good in BOTH light and dark themes**. This
  live observation surfaced a genuine CTC-01 contrast defect (`.Mono`/`.Color` marks
  illegible on the violet `gradient-primary` backing) which was fixed mid-plan with the
  white-chip avatar (`214d24d0`) and re-confirmed by the operator across both themes.

**STRUCTURAL (automated, green):**
- `providerLogo` (CTC-01 map incl. the `lmstudio` local-mark override), `preparingDescription`
  (TDP-02 partial-JSON parse), `RunCard.logo` (avatar swap + white chip + brandPulse), and
  `MessageItem.clamp` (CTC-04) unit suites pass; production `vite build` clean.

## What was deferred (recorded, not claimed)

- The **full native-7 + OpenRouter exhaustive sweep** + the **multi-tool / parallel-thread /
  long-message** axes were NOT exhaustively executed. Reason: operator hardware cannot run a
  local model large enough to drive tool cards, and the cloud exhaustive sweep was deferred to
  keep the phase closeable under time/resource constraints.
- Re-open trigger recorded in VALIDATION.md: any cross-provider tool-card regression → run the
  full scoreboard before further CTC changes. Carries the SC#10 cross-provider mandate forward
  as a known, accepted gap (precedent: Phase 116 partial cross-provider UAT).

## Deviations

- **[Rule: lived-UAT surfaced a defect]** The live logo check exposed the contrast problem the
  static/structural tests false-greened — exactly the D-06 thesis (mocks/static mask cross-provider
  reality). Fixed in-flight (white chip, `214d24d0`) + operator re-approved.
- **D-08 override (operator):** `lmstudio` now maps to the LM Studio mark (was Bot fallback) —
  a known local connector, alongside `ollama`.

## D-07 hand-off

The Plan 06 StickyTimerBar deletion proceeds on the operator's **explicit approval** with this
PARTIAL verdict recorded. The unified card was confirmed to carry the logo + status uniformly on
the providers observed; the exhaustive proof is deferred, not claimed.

## Self-Check: PASSED (partial-pass verdict recorded honestly; no overclaim)
