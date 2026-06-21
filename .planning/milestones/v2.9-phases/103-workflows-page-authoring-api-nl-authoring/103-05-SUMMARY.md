---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 05
subsystem: frontend
tags: [react, typescript, vite, vitest, workflow-authoring, publish-gauntlet, publish-verdict, judge-hard-wall, key-detection, honesty-surface, tdd]

# Dependency graph
requires:
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "03"
    provides: the api.ts publishWorkflow fn + PublishVerdict/LintError/PublishOutcome types + the 4-distinct-HTTP-outcome distinction (200-with-block != success) — consumed AS-IS, never recreated
provides:
  - "PublishGauntlet — the publish-gauntlet UI client: the single golden_input textarea + Publish (disabled on empty/whitespace), the 8 server-fixed stages (display-only, never invented/reordered), the 5 PublishVerdict fields rendered VERBATIM (published/version/golden_run_id/blocked_stage/named_failures, never re-derived), the 4 distinct HTTP outcomes switched on PublishOutcome.kind, the polymorphic named_failures rendered by KEY-DETECTION, the judge HARD WALL with NO override (struck-through 'publish anyway' + only Fix & re-publish), and the run-link gated on golden_run_id != null"
  - "renderFailure(entry, key) — the key-detection renderer (typeof string / 'criterion' in / 'code' in / 'phase'+'message' / 'summary' / unrecognized -> block); ANY bare-string/missing-criterion/unknown shape renders a BLOCK, never a pass"
affects:
  - "103-06 (Workflows page — PublishGauntlet mounts into the WorkflowBuilderPage.renderPublish? prop seam from Plan 04; the onPublished?(version) callback lets the page auto-return on a PASS)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render the server PublishVerdict VERBATIM: the display is a SUCCESS only when verdict.published === true; a 200-with-published:false (any blocked_stage incl. 'judge') is a BLOCK; the client never recomputes published/blocked_stage (the G-6 optimistic-verdict guard, T-103-05-01)"
    - "Switch on the discriminated PublishOutcome.kind (verdict / business_requirement / not_found / already_published), NOT a binary 200=ok/else=error handler — each of the 4 HTTP outcomes renders a distinct honest UI state with its own http-outcome badge (T-103-05-02)"
    - "named_failures is POLYMORPHIC across stages → render by KEY-DETECTION per ENTRY (the list can MIX shapes), never by blocked_stage; ANY bare string / missing-criterion / unrecognized shape fails CLOSED to a block (T-103-05-04, REQ-6 g)"
    - "The judge block is a HARD WALL — no client override / 'publish anyway' escape hatch anywhere; the deliberate absence is rendered struck-through (<s>publish anyway</s>); the only forward affordance is Fix & re-publish (T-103-05-03)"
    - "Source-grep guards via Vite ?raw import (typecheck-clean under vite/client) pin the render rules survive refactors: key-detection literals, the publishWorkflow call, the struck-through-only override, the golden_run_id != null run-link gate"

key-files:
  created:
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PublishGauntlet.test.tsx
  modified: []

key-decisions:
  - "The 8 stages are a SERVER-FIXED constant the client DISPLAYS (owner / definition-valid / business_requirement / lint / interactive-phase / golden run / structural gate / judge), it does not invent or reorder them; the spine PASS/BLOCK highlight is a VISUAL derivation only (find the stage whose codes contain the server blocked_stage) — the truth comes from the server verdict, never re-computed (sketch 020-B D2)."
  - "A SUCCESS is rendered EXCLUSIVELY on outcome.kind === 'verdict' && verdict.published === true; everything else (a 200-with-block, a 400 business_requirement, a 404, a 409) is a block/non-success — proving no client re-derivation (the test asserts a 200-with-block stays a block)."
  - "onPublished?(version) fires ONLY on a verbatim PASS (published === true) so Plan 06 can auto-return to the Workflows page; a block never fires it. Fix & re-publish resets the outcome to the resting form (a fresh golden run + judge each attempt) — there is no override path."
  - "Theme: real app Tailwind semantic tokens (text-success / text-destructive / text-accent-violet / bg-primary / border-border / bg-card / text-muted-foreground); amber-500/600 for the running/golden-run hero (no `warning` token exists — matches PhaseSpineGraph's amber skip-edge precedent). The sketch's --color-* names are sketch-local."

patterns-established:
  - "Net-new-failure proof the additive way: Plan 05 ADDED 2 files and MODIFIED zero pre-existing files (git diff --name-status HEAD = empty; both files untracked-then-added), so no pre-existing test's behavior can change by construction. Empirically: HEAD = 17 failed / 699 total in 7 untouched rot files; the prior base (Plan 04 HEAD) = 17 failed / 687 → delta 0 new failures, +12 passing (all mine). The 17 are documented rot (SEED-056) in MessageItem / Plan04.frontend(095) / useMessages / StreamsProvider×3 / model-info — none are PublishGauntlet."

requirements-completed: [WFAUTH-01]

# Metrics
duration: 7min
completed: 2026-06-14
---

# Phase 103 Plan 05: Publish-Gauntlet UI Client Summary

**The honesty surface for publishing, exactly as the locked sketch-020-B / D-103-CONF-3 contract demands: `PublishGauntlet` renders the EXISTING server-side 8-stage gauntlet's `PublishVerdict` — one `golden_input` textarea + a Publish button disabled on empty/whitespace (body `{golden_input}`), the 8 server-fixed stages displayed (never invented/reordered), the 5 verdict fields (`published`/`version`/`golden_run_id`/`blocked_stage`/`named_failures`) rendered VERBATIM with no client re-derivation of pass/block, the 4 distinguished HTTP outcomes switched on the discriminated `PublishOutcome.kind` (a 200-with-block stays a BLOCK; 400 `business_requirement` / 404 `not_found` / 409 `already_published` each distinct), the polymorphic `named_failures` rendered by KEY-DETECTION (criterion/code/phase+message/summary/bare-string — ANY string or unrecognized shape fails CLOSED to a block, never a pass), the judge block as a HARD WALL with NO override (struck-through `publish anyway`, only `Fix & re-publish`), and the `view the golden run` link gated strictly on `golden_run_id != null` (else the explicit no-run note) — 12 vitest cases GREEN, net-new failures = 0 (additive-only + base-checkout proven), `tsc -b` clean on the new files, mounting into the Plan-04 `renderPublish?` prop seam.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-14 10:40 UTC
- **Completed:** 2026-06-14 10:47 UTC
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files changed:** 2 created (1 source + 1 test); 0 pre-existing modified

## Accomplishments

- **REQ-6 / WFAUTH-01 — `PublishGauntlet` (the publish-gauntlet UI client).** The resting publish form is ONE `golden_input` `<textarea>` + a Publish button `disabled` while `golden_input.trim()` is empty (the body sent is `{golden_input}` via the Plan-03 `publishWorkflow(definitionId, golden_input)`). The 8 server-fixed stages (Owner check / Definition valid / business_requirement / Structural lint / Interactive-phase check / Golden run on your KB / Structural gate / Independent judge) render as a horizontal progress-spine the client DISPLAYS — it does not invent or reorder them; the long synchronous golden-run wait is the visible amber hero panel while `loading`. After the outcome resolves the spine highlights passed-up-to / blocked-at, but that highlight is a VISUAL derivation only — the PASS/BLOCK truth comes from the server `published`/`blocked_stage`, never re-computed.
- **The 5 PublishVerdict fields rendered VERBATIM (no re-derivation).** `VerdictFields` renders the labeled 2-column grid: `published` (green `true` / red `false`), `version` (or italic `null`), `golden_run_id` (or italic `null`), `blocked_stage` (one of the 10 real codes in danger red, or italic `null`), `named_failures` (summarized as `[] (empty)` or `list · N item(s) (rendered above)`), with the "rendered verbatim from the server — not re-derived in the client" provenance caption. A SUCCESS is rendered EXCLUSIVELY when `outcome.kind === "verdict" && verdict.published === true`; a 200-with-`published:false` (any blocked_stage incl. `"judge"`) is a BLOCK — the test asserts a 200-with-block stays a block (T-103-05-01, the optimistic-verdict guard).
- **The 4 distinct HTTP outcomes (no binary 200=ok handler).** The component switches on the discriminated `PublishOutcome.kind` from Plan 03: `"verdict"` (200 — read `published`/`blocked_stage`), `"business_requirement"` (400 — the verdict is in `detail`, rendered as a block), `"not_found"` (404 — "Workflow not found", no existence leak), `"already_published"` (409 — "Already published"). Each renders a distinct `http-outcome` badge (200 / 400 / 404 / 409 + the kind) and a distinct surface (T-103-05-02).
- **named_failures rendered by KEY-DETECTION (the G-6 silent-pass guard).** `renderFailure(entry, key)` detects the shape per ENTRY (the list can MIX shapes): `typeof entry === "string"` → `BlockMessage` (bare string → block); `"criterion" in e` → `CriterionRow {criterion, score, evidence}`; `"code" in e` → `LintRow` (the LOWERCASE LintError literals); `"phase" in e && "message" in e` → `PhaseRow` (interactive_phase); `"summary" in e` → `SummaryLine` (the server-authored judge paragraph); else → `BlockMessage "the judge could not produce a verdict — treated as a block, never a pass"`. ANY string / missing-criterion / unrecognized shape renders a BLOCK, never `published=true` (T-103-05-04, REQ-6 g). It detects by KEYS, NOT by `blocked_stage` (survives mixed lists).
- **The judge block is a HARD WALL — no override.** When a verdict blocks (esp. `blocked_stage === "judge"`), the per-criterion `{criterion, score, evidence}` rows + the server summary render; there is NO enabled "publish anyway"/override control anywhere; the deliberate absence is rendered struck-through (`<s>publish anyway</s>` in the `HardWall` strip); the only forward affordance is the `Fix & re-publish` button (which resets to the resting form — a fresh golden run + judge each attempt) (T-103-05-03).
- **The run link gates strictly on `golden_run_id != null`.** `RunLink` renders the "Open the golden run that was judged" link only when `golden_run_id != null` (stage 3+ reached — so a judge block, which happens AFTER a successful golden run, DOES show it); a pre-stage-3 block (`golden_run_id: null`) renders the explicit `no-run-note` ("blocked before stage 3, no run to open") instead.
- **Mounts into the Plan-04 seam.** Props `{ definitionId: string; onPublished?: (version: number) => void }` — `definitionId` drives `POST /workflows/{id}/publish`; `onPublished` fires ONLY on a verbatim PASS so Plan 06 can auto-return to the Workflows page. This matches the `WorkflowBuilderPage.renderPublish?(def, draftId)` typed prop seam (the page composes `<PublishGauntlet definitionId={draftId} onPublished={...} />`).

## Task Commit

Committed atomically (TDD RED → GREEN, the test + implementation are one feature):

1. **Task 1: PublishGauntlet — verbatim verdict + 8 stages + 4 HTTP outcomes + judge hard wall** — `17d9a166` (feat) — 12 vitest cases.

## Files Created

- `frontend/src/components/workflows/PublishGauntlet.tsx` — the publish-gauntlet UI client (well above the `min_lines: 90` bar; the form + `GauntletSpine` + `VerdictFields`/`VerdictRow` + `renderFailure` with `CriterionRow`/`LintRow`/`PhaseRow`/`SummaryLine`/`BlockMessage` + `RunLink` + `HardWall`).
- `frontend/src/components/workflows/PublishGauntlet.test.tsx` — 12 cases.

## Decisions Made

- **The 8 stages are a server-fixed display constant.** The `STAGES` array mirrors `publish_service.py` order; the spine highlight is derived only for the visual progress (find the first stage whose `codes` contain the server `blocked_stage`) — never the source of pass/block truth.
- **SUCCESS = exclusively `published === true` on a 200 verdict.** `isSuccess = outcome?.kind === "verdict" && verdict?.published === true`; `isBlock = outcome != null && !isSuccess`. This proves no re-derivation — a 200-with-block, a 400, a 404, a 409 are all non-success.
- **`onPublished` fires only on a verbatim PASS.** A block never fires it; `Fix & re-publish` resets `outcome` to the resting form (no override path).
- **Real app Tailwind tokens, amber for the golden-run hero.** `text-success`/`text-destructive`/`text-accent-violet`/`bg-primary`/`border-border`/`bg-card`/`text-muted-foreground`; `amber-500/600` for the running/golden-run hero (no `warning` token exists in `tailwind.config.js` — matches PhaseSpineGraph's amber skip-edge precedent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Five test-correctness bugs in my own RED tests (the component behavior was correct from GREEN).**
- **Found during:** Task 1 (the first GREEN run — 7/12 passed, 5 test assertions were wrong).
- **Issue + Fix (all in `PublishGauntlet.test.tsx`, my own new file, same TDD task):**
  1. `toHaveBeenCalledWith("def-1", "ship the vendor brief", expect.anything())` — the component called `publishWorkflow(id, input, undefined)`, and `expect.anything()` does NOT match `undefined`. Fix: dropped the spurious `undefined` 3rd positional arg in the COMPONENT (`publishWorkflow(definitionId, goldenInput)` — cleaner, no fake signal), and the test asserts the 2-arg call.
  2. `getByText(/publish anyway/i)` matched TWO nodes — the judge intro paragraph ("there is no 'publish anyway'") AND the struck-through `<s>`. Fix: `getByText("publish anyway", { selector: "s" })` to target the struck element specifically.
  3. `getByText(/already published/i)` matched both the "Already published" title and the body sentence. Fix: exact `getByText("Already published")`. Same class for `not_found` → `getByText(/workflow not found/i)`.
  4. The 8-stages spine test used substring regexes (`/definition/i`) that matched BOTH a stage label and a stage description ("Definition valid" + "...as a WorkflowDefinition"). Fix: match the exact server-fixed stage LABELS.
  5. The struck-through source-grep `/<s>[^<]*publish anyway/i` failed because the element is `<s className="opacity-60">`. Fix: `/<s\b[^>]*>[^<]*publish anyway/i` (allow attrs) + an added assertion that NO `<button>` renders a "publish anyway" label.
- **Files modified:** `PublishGauntlet.test.tsx` (5 assertions) + `PublishGauntlet.tsx` (1 line — the `publishWorkflow` call arity).
- **Verification:** 12/12 GREEN; `tsc -b` clean on both new files.
- **Committed in:** `17d9a166` (the single Task-1 commit).

**Total deviations:** 1 auto-fixed cluster (5 test-correctness bugs in my OWN new RED test + a 1-line call-arity cleanup). No production-behavior or scope changes; no pre-existing file touched.

## Known Stubs

- **None.** The run link `href="#"` is the sketch-contract placeholder for "open the golden run" — wiring it to the live run thread is Plan 06 / the run-surface (out of this plan's scope per REQ-6, which is the publish verdict renderer only); it is NOT a hidden empty/mock data source. The component is fully functional rendering the real `publishWorkflow` outcome.

## Threat Surface (plan threat_model)

All four `mitigate`-disposition threats are mitigated at the UI seam (test-asserted):
- **T-103-05-01** (client re-derives an optimistic verdict) → the 5 fields render verbatim; SUCCESS is exclusively `published === true`; a 200-with-block stays a block (test: the 200-judge-block renders `publish-block`, never `publish-success`).
- **T-103-05-02** (a binary 200=ok handler mislabels a block) → switch on `PublishOutcome.kind` + read `published` for 200; the 4 HTTP outcomes each render distinctly (test: 200/400/404/409 each assert a distinct `http-outcome` badge + surface).
- **T-103-05-03** (a judge block exposes an override) → NO enabled override anywhere; the absent override is struck-through; only Fix & re-publish (test: zero buttons match /publish anyway|override/, the `<s>` strike exists, Fix & re-publish is enabled; + source-grep no `<button>` override).
- **T-103-05-04** (an un-producible/bare-string verdict defaults to published=true) → `renderFailure` key-detection: any string / missing-criterion / unrecognized → a block message, never a pass (test: a mixed lint-dict + bare-string list AND an `{unexpected_key}` shape both stay `publish-block`).
- **T-103-05-05** (cross-user/not-found existence leak) — accept: `publishWorkflow` (Plan 03) collapses cross-user + not-found to a uniform 404; the client shows the same "Workflow not found" for both (no client-side distinction).

No NEW security-relevant surface beyond the plan's threat_model (this is a pure frontend renderer of a server verdict; no new endpoint, auth path, or schema).

## Test Results

- **Plan target suite** (`PublishGauntlet.test.tsx`): **12 passed**, exit 0 — empty-disabled + sends `{golden_input}`; 200-judge-block (block-not-success, per-criterion rows + summary, no enabled override, Fix & re-publish present); 200-success-with-run-link; pre-stage-3 no-run-note; the 4 distinct HTTP outcomes; mixed named_failures key-detection (lint lowercase code + bare-string → block); unrecognized shape → block; the 8 server-fixed stages; + 4 source-grep guards (key-detection literals, publishWorkflow call, struck-through-only override, golden_run_id != null run-link gate).
- **`tsc -b`:** exits with the documented 44 pre-existing rot errors (SEED-056) in 17 untouched files; **ZERO errors in either Plan-05 file** (`PublishGauntlet.tsx`/`.test.tsx` absent from the error list — the `?raw` source-grep keeps the test typecheck-clean under `vite/client`).
- **Net-new vitest failures = 0 (additive-only + base-checkout proven):**
  - Plan 05 ADDED 2 files and MODIFIED **zero** pre-existing files (`git diff --name-status HEAD` = empty; both files untracked-then-added), so no pre-existing test's behavior can change by construction.
  - Empirically: **HEAD** = **17 failed / 699 total** (7 files); the prior base (Plan 04 HEAD) = **17 failed / 687**. Delta = **0 new failures, +12 passing** (all mine, all GREEN).
  - The 17 failures live in 7 untouched files (MessageItem, the coincidentally-named `Plan04.frontend.test.tsx` from Phase **095**, useMessages, StreamsProvider×3, model-info) — documented pre-existing rot, NOT this plan's files.
- **Sketch contract honored (sketch-020-B "Publish Gauntlet Honesty"):** verbatim 5-field verdict (never re-derived), 8 server-fixed stages, the 4-outcome HTTP distinction, judge hard wall with the struck-through override + only Fix & re-publish, the golden-run-id-gated run link + the no-run note, the un-producible-verdict fails-closed line — all test-asserted; the operator-approved sketch-020 mockup is the acceptance bar.

## Self-Check: PASSED

- Both created files exist on disk: `frontend/src/components/workflows/PublishGauntlet.tsx`, `frontend/src/components/workflows/PublishGauntlet.test.tsx` (verified).
- The task commit exists in git history: `17d9a166` (verified; no file deletions in the commit).
- Plan target suite GREEN (12/12); `tsc -b` clean on the new files; net-new failures = 0 (additive-only, 17 = 17 base-vs-HEAD); the 4 honesty contracts (verbatim verdict / key-detection named_failures / judge hard-wall no-override / server-fixed stages) all honored and test-asserted; mounts into the Plan-04 `renderPublish?` seam.

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
