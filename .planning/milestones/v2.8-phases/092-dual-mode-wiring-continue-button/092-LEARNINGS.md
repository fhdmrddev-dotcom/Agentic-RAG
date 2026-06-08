---
phase: 092-dual-mode-wiring-continue-button
extracted: 2026-06-01
verdict: passed_with_overrides
---

# Phase 092 — Extracted Learnings

> Dual-Mode Wiring + Continue Button. Shipped 7 plans (4 base + 3 gap-closure 092-05/06/07) over a UAT-driven defect cascade F1→F10. Closed passed_with_overrides; F9/F10 → Phase 093.

## Decisions

- **D-092-UX (composer consolidation A+C):** Deep/Harness ⊥ General/Explorer are orthogonal axes (a 2×2), not 4 sibling modes — rendering them as identical pills was the confusion. Fold Provider into Model; move workflow-START into the Phase 087 panel ("▶ Run workflow"). Workflows stay THREAD-bound (shared run SSE/anchor/lock), not a separate `/workflows` route. → Phase 094 (G-2 sketch-first).
- **D-092-AUTHOR:** Workflow authoring = NL-describe → strict-parse → form-edit → lint-on-publish; NOT a visual drag-canvas (the "squeezed dead middle"). Authoring Phase A (draft/edit/publish API, reuses 091's validator+lint) is a small late-v2.8 add; NL-generate + guided editor → v2.9.
- **Harness id-routing rule (the F4 root fix):** the `workflow_run` id is the user-facing / audit / SSE / resume identity; a SEPARATE producer `runs` row is the FK anchor for sub-agent `runs.parent_run_id`. Never conflate them. Carried on the engine ctx as `ctx.run_id` vs `ctx.producer_run_id`.
- **Close with overrides over piecemeal fixing (operator directive, UPDATE 5):** when live UAT surfaces an architectural-class defect (F9 cross-provider), STOP the single-domino fixes and route to a comprehensive phase with a proper substrate (092.5 gateway → 093), rather than bolting a 3rd provider-branch copy onto the harness.

## Lessons

- **Only live UAT caught the F1→F8 cascade — mocks + the structural-skeleton SSE proof passed straight through all of them.** Each fix peeled one layer (F1 audit user_id → F2 wedged lock → F4 FK → F5 ctx → F6 surfacing → F7 visibility → F8 kickoff threading). The harness path had NEVER been exercised live before 092; every layer that was mock-only hid a real break. **Implication:** any "substrate the user never ran live" needs a live end-to-end UAT before it's trusted, no matter how green the unit/structural proofs are. (Reinforces `feedback_uat_lived_experience_gap`.)
- **"Deep's intent without Deep's substrate" is the anti-pattern.** The harness re-implemented Deep's LLM loop (funneling every phase call through the OpenAI-SDK-only `create_adaptive_streaming_chat`) instead of CONSUMING Deep's proven per-provider boundary. Result: works on OpenAI, breaks on the other 6 (F9) — while Deep is robust on all 7. The fix is structural (092.5 extracts the shared gateway; 093 makes the harness consume it), not more patches. (Reinforces `feedback_no_cross_provider_regressions` + `feedback_cross_provider_always_top_of_mind`.)
- **A second OpenAI-shaped accumulator (`task_service._consume_sync_stream`) was the smell that predicted F9.** When the same provider-dispatch logic exists in 2 places, the 2nd copy is silently OpenAI-only. This is exactly why 092.5 (one shared gateway) is the right next move.
- **Live evidence beats inference for "is this a provider problem or a harness problem":** the UPDATE 6 Deep-on-7-providers table (all ✅) instantly localized F9 to the harness, not the providers. Run the differential test before theorizing root cause. (Reinforces `feedback_investigate_with_tools_first`.)
- **Reconciled-not-trusted client lock (D-v2.5-03) held up:** the per-thread workflow lock seeded at kickoff + reconciled on mount (GET /threads/{id}/workflow authoritative, stale anchor = unlocked) self-heals; no global boolean (BUG-260523-01 avoided).

## Surprises

- **The phase goal was met while 2 binding success-criteria rows were deferred** — because the deferred rows (native-7 parity, ask_user round-trip) turned out to be a SEPARATE architectural concern (harness substrate), not part of "dual-mode wiring." Recognizing that boundary is what let 092 close cleanly instead of absorbing 093's whole scope.
- **F8 looked like prompt-quality, was actually a wiring gap:** a run produced a clarifying question despite finding 5 sources. First read "seed-workflow prompt tuning"; real cause was `kickoff_prompt` (SEED-047) being stored but never consumed by any phase. Threading it in fixed it. Lesson: "inconsistent LLM behavior" on a new path is wiring-until-proven-otherwise.
- **The F4 FK violation was Phase 091's parked execution path** — invisible until F1 let a run advance past the first audit write. Earlier phases' "deferred/mock-only" seams surface as the next phase's blockers.

## Patterns Established

- **Two run identities on one ctx** (`run_id` = identity/audit/SSE/resume; `producer_run_id` = FK anchor) — reusable for any future sub-agent-spawning runtime.
- **UAT-finding → gap-plan cascade** (092-04 UAT fail → 092-05/06/07): each gap-plan is scoped to one defect family with its own UAT gate; the binding rows blocked by a deeper defect become the next gap-plan's gate.
- **passed_with_overrides close**: name each override, route it to a named phase with evidence, record it in VERIFICATION frontmatter `deferred` + the gap-closure ledger. Not a silent pass.

## Forward Hooks

- **Phase 092.5** (Provider Gateway Extraction) — the shared boundary; planned 2026-06-01.
- **Phase 093** (Harness Cross-Provider Parity) — closes F9 (per-run model resolution + native-7 dispatch via the gateway) + F10 (ask_user round-trip: `runs` vs `workflow_runs` id namespace + draft surfacing).
- **Phase 094** (Workflow Legibility + Mode Clarity) — D-092-UX composer consolidation + live phase timeline (G-2 sketch-first).
- **Phase 096** (Eval + Verify) — owns the restart-mid-workflow + parallel-thread proof gate that re-exercises 092's accepted-as-code-verified single-provider rows (F3 lock-during-run, SC#3, SC#5).
