---
phase: 095-chat-tool-card-unification
plan: 08
subsystem: ui
tags: [react, tailwind, output-files, fileicon, sketch-fidelity, chat-surface]

# Dependency graph
requires:
  - phase: 095-chat-tool-card-unification (Plan 095-01)
    provides: the shared fileIcon(filename, sizePx) module (the ONE icon system the hero/working cards render)
  - phase: 095-chat-tool-card-unification (Plan 095-05)
    provides: the OutputFileCard hero/working variant + the MessageItem FinalOutputsPanel hero/working split this plan re-skins
  - phase: 095-chat-tool-card-unification (Plan 095-02 / 095-04)
    provides: the RunStatusStrip (placement="header") + the floating jump-to-live chip whose child order this plan reverses
provides:
  - Hero file icon at 48px, working icons at 30px (sketch 016 sizes), up from 30/16
  - A soft 24px primary glow halo on the hero card (shadow-glow-primary), replacing the flat 1px ring
  - A borderless top-rule + uppercase dim mono eyebrow generated-files container (sketch 016), replacing the bordered card
  - The "— intermediates, all downloadable" working-toggle copy (sketch 016)
  - The floating jump-to-live chip reordered status-first / jump-trailing (sketch 015)
affects: [095-09 (single-hero backend fix — same FinalOutputsPanel surface), 095-verify-work (live Chrome-MCP UAT of the output-files surface)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-fidelity-only gap closure: re-skin chrome + copy without touching the underlying partition/render LOGIC (the multi-hero leak is a separate backend fix in 095-09)"
    - "Tailwind arbitrary box-shadow value mirroring a CSS token: shadow-[0_0_24px_hsl(239_100%_82%/0.18)] = --shadow-glow-primary"

key-files:
  created: []
  modified:
    - frontend/src/components/chat/OutputFileCard.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/MessageList.tsx
    - frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx

key-decisions:
  - "Hero glow uses the literal sketch token value (0 0 24px hsl(239 100% 82% / 0.18)) as a Tailwind arbitrary value rather than a new CSS class — single-line change, matches --shadow-glow-primary, no index.css touch"
  - "Eyebrow keeps the text 'Generated files' verbatim (sketch outputs-label); only its weight/case/color/font changed (bold foreground -> uppercase tracked dim mono)"
  - "Floating-chip reorder is children-only (RunStatusStrip leads, jump-span trails); RunStatusStrip.tsx is NOT edited, so there is zero file overlap with the sibling 095-07 header-chrome plan"

patterns-established:
  - "Pattern: a sketch-divergence gap plan touches ONLY presentation (className + copy), proven by a git-diff partition-logic grep showing no +/- line references the heroes/working filter"

requirements-completed: [CHAT-04]

# Metrics
duration: 5min
completed: 2026-06-06
---

# Phase 095 Plan 08: File-Axis Sketch Fidelity Summary

**Landed the sketch-016/015 file-axis visual divergences — hero icon 48/working 30, a soft 24px primary hero-glow halo, a borderless top-rule + uppercase dim eyebrow generated-files container, the "— intermediates, all downloadable" toggle copy, and a status-first/jump-trailing floating chip — with the hero/working partition LOGIC byte-untouched.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-06T07:27:39Z
- **Completed:** 2026-06-06T07:32:27Z
- **Tasks:** 3
- **Files modified:** 4 (3 source + 1 test)

## Accomplishments

- **GAP-095-03 MED icon size + MED hero glow (Task 1):** `OutputFileCard` fileIcon raised `isHeroVariant ? 30 : 16` → `48 : 30`; the hero card's flat `0_0_0_1px_rgba(99,102,241,0.08)` ring swapped for the soft 24px primary halo `0_0_24px_hsl(239_100%_82%/0.18)` (= `--shadow-glow-primary`). The dead-state hero branch inherits the larger icon and stays glow-less (a dead file should not glow).
- **GAP-095-03 MED top-rule/eyebrow + LOW intermediates copy (Task 2):** `MessageItem.FinalOutputsPanel` container went from the bordered box `rounded-md ghost-border bg-card/40 p-3` to the borderless top-rule `border-t border-border/60 pt-3.5`; the bold label became an uppercase letter-spaced DIM mono eyebrow (`text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground`); the working toggle now reads `Working files (N) — intermediates, all downloadable`. Text "Generated files" kept verbatim; `data-testid` markers preserved.
- **GAP-095-03 LOW chip-order (Task 3):** `MessageList` floating jump-to-live chip children reordered — the `RunStatusStrip` (status segments) now LEADS, the separator and "↓ Jump to live" span TRAIL (sketch 015 `.live-chip`: the `.jump` morphs in after the status). Button identity (testid, aria-label, onClick, sticky positioning, glow) unchanged.

## Task Commits

Each task was committed atomically (normal commits, with hooks):

1. **Task 1: Hero icon 48 / working 30 + soft 24px hero glow halo** — `4e06d425` (feat)
2. **Task 2: Borderless top-rule + dim eyebrow + intermediates copy** — `ab67f9e6` (feat)
3. **Task 3: Floating chip status-first, jump trailing** — `2c59ba36` (feat)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP + REQUIREMENTS) committed separately.

## Files Created/Modified

- `frontend/src/components/chat/OutputFileCard.tsx` — hero icon 48 / working 30; flat ring → soft 24px primary halo on the hero variant.
- `frontend/src/components/chat/MessageItem.tsx` — `FinalOutputsPanel` borderless top-rule + uppercase dim mono eyebrow; working toggle "— intermediates, all downloadable" copy. Partition logic (`heroes`/`working` filter) untouched.
- `frontend/src/components/chat/MessageList.tsx` — floating chip children reordered (RunStatusStrip leads, jump trails).
- `frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx` — retargeted 2 exact-string `getByText("Working files (N)")` assertions to substring/regex for the new toggle copy (the third lookup was already a regex and needed no change).

## Decisions Made

- **Hero glow as a Tailwind arbitrary value, not a new CSS class.** The literal `shadow-[0_0_24px_hsl(239_100%_82%/0.18)]` mirrors `--shadow-glow-primary` exactly and is a one-line className change — no `index.css` touch, no new keyframe.
- **Eyebrow text kept verbatim.** Only weight/case/color/font changed (sketch `outputs-label` keeps the literal "Generated files").
- **Chip reorder is children-only.** `RunStatusStrip.tsx` is not edited, so this plan is fully file-disjoint from the sibling 095-07 header-chrome work — no merge surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Maintenance] Retargeted 2 stale exact-string test assertions to the new toggle copy**
- **Found during:** Task 2 (Borderless top-rule + dim eyebrow + intermediates copy)
- **Issue:** `MessageItem.finalOutputs.test.tsx` asserted `screen.getByText("Working files (2)")` via Testing-Library's default **exact** string match (lines ~96 and ~155). Appending the sketch copy `— intermediates, all downloadable` to the toggle made those exact matches fail. (The line-117 lookup was already a regex `/Working files \(1\)/`, a substring match, and needed no change.)
- **Fix:** Changed the two exact-string lookups to regex substring matches `/Working files \(2\) — intermediates, all downloadable/`, preserving each assertion's intent (the working group renders with the right count + the new copy).
- **Files modified:** `frontend/src/__tests__/components/MessageItem.finalOutputs.test.tsx`
- **Verification:** `npx vitest run src/__tests__/components/MessageItem.finalOutputs.test.tsx` → 7/7 pass.
- **Committed in:** `ab67f9e6` (Task 2 commit)

This was explicitly anticipated by Task 2's acceptance criteria ("update any test asserting the old container classes/label") — a plan-mandated copy change, not scope creep.

---

**Total deviations:** 1 auto-fixed (1 Rule-1 test-maintenance from the plan-mandated copy change).
**Impact on plan:** No scope creep. No source-logic deviation. The change kept the touched test's intent intact and did not mask the pre-existing baseline cluster.

## Issues Encountered

None. All three tasks executed exactly as written; greps and automated verification passed on first attempt for each.

## Verification

- **Plan acceptance greps (all PASS):**
  - `isHeroVariant ? 48 : 30` = 1 · `isHeroVariant ? 30 : 16` = 0 · `shadow-[0_0_24px_hsl(239_100%_82%/0.18)]` = 1 · old ring `0_0_0_1px_rgba(99,102,241,0.08)` = 0
  - `border-t border-border` = 1 · old container `rounded-md ghost-border bg-card/40 p-3` = 0 · `uppercase tracking-[0.1em]` = 1 · `intermediates, all downloadable` = 1 · `data-testid="final-outputs-panel"` rendered once (line 83)
  - chip reorder: `<RunStatusStrip` (line 203) now precedes the rendered "↓ Jump to live" span (line 213); `aria-label="Jump to live"` = 1; `data-testid="jump-to-live-chip"` = 1
- **Plan `<verification>` (all PASS):** `dangerouslySetInnerHTML` = 0 in both OutputFileCard.tsx and MessageItem.tsx; hero/working partition filter UNCHANGED (git-diff grep confirms no +/- line references `files.filter`/`heroes.length > 0 ?`).
- **Targeted suites:** `MessageItem.finalOutputs` 7/7 · `MessageList` 9/9.
- **`vite build`:** exit 0 (twice — after Task 1 and Task 3).
- **`tsc -b`:** 37 errors = the documented baseline, **zero net-new**; none reference any of the touched files.
- **Full vitest suite:** 17 failed / 497 passed (514) — identical to the documented pre-existing baseline cluster (same 7 files: model-info / MessageItem / Plan04 / useMessages / StreamsProvider.dedup / streamsProvider / streamsProvider_075_9_clientkey). **ZERO net-new failures.** The one test file this plan touched (`MessageItem.finalOutputs`) is GREEN and not in the failure set.

## Cross-provider safety

Frontend-only, presentation-only, derivation-only. No SSE event, no shared chat hot-path, no provider branch touched — the Deep path across the 6 native providers is unaffected. PANEL-06 isolation held (no panel-store reads added).

## Known Stubs

None. Per the plan scope, the per-file descriptive subtitle and the folded-page SVG icon remain DEFERRED to SEED-054 (explicitly out of scope, not stubs).

## Next Phase Readiness

- The file-axis visual divergences from sketch 016 (3 MED) + the two cheap LOW items (chip order, intermediates copy) are closed.
- **095-09** (single-hero / multi-select leak) is the remaining gap plan — it is the BACKEND partition fix on the same FinalOutputsPanel surface; this plan deliberately left the partition logic untouched so 095-09 owns it cleanly. Files are disjoint.
- After 095-09, `/gsd:verify-work 095` owns the live Chrome-MCP lived-experience UAT of the output-files hero/working surface.

## Self-Check: PASSED

- SUMMARY file present at `.planning/phases/095-chat-tool-card-unification/095-08-SUMMARY.md`.
- All 3 task commits exist in git history (`4e06d425`, `ab67f9e6`, `2c59ba36`).
- All 4 modified files present on disk.

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-06*
