---
status: complete
phase: 186-concurrency-autosave
source: [186-VERIFICATION.md]
started: 2026-08-01T21:20:00Z
updated: 2026-08-01T21:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Two tabs — same draft open in A and B; edit in A (let it autosave), then edit in B
expected: B shows the honest banner, stops writing, offers Reload (default) then Overwrite. A's content intact.
result: pass
evidence: Chrome-driven 2026-08-01 (draft compliance-gap-report-y2o5gu). Banner verbatim "This draft changed somewhere else. Reload to get the newer version, or overwrite it with what's on screen." Reload + Overwrite both present, save bar flipped to "Not saved yet", Tab A's save intact.

### 2. Stale tab — leave B open, edit + save in A, return to B minutes later and type
expected: Same honest outcome. No silent overwrite, no retry storm.
result: pass
evidence: Same token mechanism exercised live (B held pre-save token, edited later, got the banner). Network log watched 6s post-conflict: zero requests — halted loop is genuinely halted, no retry storm.

### 3. Publish race — start a publish in A, edit in B mid-gauntlet
expected: Publish refuses with the worded `draft_changed` verdict; the golden-run receipt still browsable; the spine shows a block, not 8 green pips.
result: pass
evidence: Third attempt landed the real thing (draft meridian-risk-summary-good-cc99c1b7 / row ce604671, after removing the fixture's broken Google-routed llm_single step): gauntlet ran all stages green including a real golden run + judge, then refused at the LAST stage with headline "Blocked at the last step — the draft changed while it was being checked", named failure verbatim "the draft changed while it was being checked — re-publish to check the new version", golden-run receipt browsable (0e60d534…), publish-anyway struck out. DB row still status='draft' after the refusal. Earlier attempts also blocked honestly (structural_gate; golden-run 404 from fixture-pinned model gpt-5.4 routed to Google v1beta — filed as observation, not a 186 defect). Bonus: stale editor on a just-published row got the worded terminal refusal "This version is published and can't be edited — use Tweak to start a new draft" (CR-02 already_published path, live).

### 4. Publish hold, both halves of the flag — start a publish in A, then edit in A; repeat once with `visual_workflow_canvas` ON and once OFF
expected: Flag ON: "Publishing — changes will save when it finishes", edit flushes on resolution. Flag OFF: the manual sentence is on screen while the gauntlet runs and is GONE from the header once it ends, without ever having written anything. (Live observation point for WR-19/WR-20 residual honesty gaps.)
result: skipped
reason: "The mid-publish in-tab edit this row describes is UNREACHABLE by design on both flag states: the publish modal pins the Builder until the verdict (X and Escape both refuse — observed live, 'It blocks until the verdict is ready'), so no edit can occur in the publishing tab; the hold protects only the pre-publish debounce window, which is invisible behind the pinned modal. The row's observable core — the worded wait sentence occupying the header while a write is outstanding, then leaving without a phantom write — was observed live in Test 8's cycle. The hold-release micro-states remain unit-proven (WR-12/13 REDs, F19-F21 rows); WR-19/WR-20 are the recorded residuals."

### 5. Conflict-exit failure — reach the conflict banner (test 1), then go offline and press Reload
expected: The banner stays on screen with BOTH exits present and pressable, plus the extra line "We couldn't reach the server to reload...". Restoring the network and pressing Reload again succeeds and clears the banner.
result: pass
evidence: Operator stopped uvicorn; Reload pressed → banner stayed with both exits + verbatim "We couldn't reach the server to reload — nothing has changed, and both options above still work." Backend restarted → Reload cleared the banner and B showed the server truth (A's order).

### 6. KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork
expected: The chip is a picker in all three; unbound reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload.
result: pass
evidence: All three paths driven live. (a) NL-generated (weekly-sop-change-summary-8c9225c5): AI seed auto-bound SOPs from the description; chip is a full picker; re-bound to Weekly reports → "Saved · just now" and DB-confirmed project_folder_id=Weekly reports; validator honestly flagged the step folder_scope/KB mismatch. (b) Forked starter (compliance-gap-report-gsgcwp): opened unbound with the plain invitation ("No knowledge base · searches everything", no error row), bound to SOPs, saved. (c) Tweak fork (compliance-gap-report-1u9vcs v2): inherited unbound invitation, bound to DBA, saved. NOTE: first NL compose attempt failed honestly ("Couldn't generate — model_failed_to_emit, nothing was saved") and succeeded on retry — flakiness observation, not a binding defect.

### 7. Force a 422 mid-edit (invalid shape) and observe the save state
expected: "Not saved — ..."; the draft stays dirty; the leave guard fires on navigate-away.
result: skipped
reason: "A live 422 cannot be produced through the UI: deleting every step yields a VALID empty draft (saved 200; Publish correctly dims to the empty-draft invitation 'Add a step to get started'), and even a nonsense field value (Max steps -3) was accepted by the draft PATCH with a 200 and persisted (DB-verified, then restored to 12). Draft saves are permissive by design — the gauntlet is the enforcement point. The 422 rendering path ('Not saved — …', dirty stays true) is covered by the F8 unit row with a mocked 422. OBSERVATION for a later phase: the draft PATCH accepts negative max_steps; worth a server-side sanity clamp (not a 186 defect — draft PATCH validation shipped in 183/184)."

### 8. Chosen save then publish, flag OFF — with `visual_workflow_canvas` off, edit, press Save draft, then within that round trip open Publish and click the inner Publish button
expected: Both the outer trigger and the inner Publish button are disabled and show "Saving your last change — Publish will be ready in a moment" while the PATCH is outstanding. No golden run spent. Both controls re-enable the instant the save lands. (Live confirmation of CR-03's fix.)
result: pass
evidence: Flag toggled OFF via Control Room feature-visibility map (flag-off Builder confirmed = classic surface: no Spine/Canvas tabs, static KB badge, manual Save draft). With a 12s network delay injected on the PATCH (page-level fetch wrapper, removed afterwards): edit → Save draft → Save shows "⟳ Saving...", the Publish… trigger DISABLED, header reads verbatim "Saving your last change — Publish will be ready in a moment"; clicking Publish did nothing (no modal, no golden run spent). When the save landed: sentence gone, "Saved · still a draft", Publish re-enabled. Flag restored to ON afterwards. CR-03 confirmed live.

## Summary

total: 8
passed: 6
issues: 0
pending: 0
skipped: 2
blocked: 0

Method note: Chrome-driven by the agent (operator logged in and handled backend stop/start); test data = fixture workflow rows (free to mutate per project record). Side effects during the session: GOOD fixtures 07aedc33 and (in an earlier env-blocked attempt) its sibling had their Google-routed `llm_single` step removed; 07aedc33 was published by a passing gauntlet; two throwaway forks + one NL draft created. Environment observations filed (not 186 defects): fixture-pinned model `gpt-5.4` routed to Google v1beta 404s golden runs; NL compose failed once with model_failed_to_emit then succeeded; draft PATCH accepts negative max_steps.

## Gaps
