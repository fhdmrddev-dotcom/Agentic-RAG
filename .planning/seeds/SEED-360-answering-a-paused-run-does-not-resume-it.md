---
seed_id: SEED-360
title: Answering a paused run returns 200 but the run never completes (and the expired card offers no answer control)
created: 2026-10-19
surface: Agentic-RAG
status: answered
partial: false
status_note: "ANSWERED IN FULL by Phase 296 (2026-10-27). F-4 (the auto_answered note unmounts on a successful publish) = 296-INVENTORY 288-F-4, fixed in 296-07 (RED e074515f5, GREEN ef2832f46: the note is carried to the library publish line). The residue BUG-261025-03 (several EXPIRED ask cards while the run still waits) was fixed in 296-02 (backend: a boot pauses a waiting run and never re-asks, bf8a4467b) and 296-04 (UI: one ask per live workflow run, fd59d0f19); its live check is 296-HUMAN-UAT G-4 scenario 4. Earlier notes, kept: F-1 + F-3 (+288 WR-01) folded into Phase 289 as D-11..D-13 (2026-10-19, operator instruction). F-2 (judge) and F-4 (auto_answered note unmounts) deferred: publish-surface, not run page. PARTIALLY ANSWERED by Phase 289 (2026-10-19): F-3 fixed (ask_user SQL cast, 289-01) and F-1 fixed on the run page (paused card keeps its answer control); S5 drove a paused run to completed and the paused sentence was restored (dd863ca5a). STILL OPEN: F-4; the chat panel stack case is SEED-361. F-2 (judge blocks the pause workflow) FOLDED into Phase 295 (2026-10-20, discuss) with RUN-03: the judge is told what each non-producing step type is designed to produce. F-2 ANSWERED by Phase 295 (295-07, 2026-10-21, D-47): with D-10 merged, the 288 pause plant published 4 of 4 and no judge summary cited the auto-answered step, so the _golden_run_mock note was NOT added (295-VALIDATION.md D-47 table). STILL OPEN: F-4."
trigger_when: Next phase touching run resume, ask_user_response, or the pending-ask card; or Phase 289 (run page) if a paused run is to be answerable. Do not ship copy promising resume until fixed.
trigger_paths: ["backend/app/api/runs.py", "backend/app/services/run_lifecycle.py", "backend/app/services/harness_engine.py", "frontend/src/components/panel/PendingAskCard.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["SEED-164", "SEED-159", ".planning/phases/288-drafts-that-survive-pauses-that-publish/288-REVIEW.md"]
folded_into: "289, 295 (F-2), 296 (F-4 + BUG-261025-03)"
renumbered_from: null
renumbered_because: null
---

# SEED-360

Found in 288 plan-04 live drive (F-1, F-3) and 288-REVIEW (CR-01, WR-01). Not checked at base.
- F-3: `ask_user_response` on a PAUSED run returns 200, run goes `active`, phase `approve` stays `active`, never completes (one stuck 17+ min). Look for `ask_user_response: re-drive failed` / `re-drive skipped` in backend log. `resume_run` flips paused->active before `_wake`; `_wake` swallows `_resume_run` errors (api/runs.py ~651-664), leaving active with no producer.
- F-1: after the window the card reads "EXPIRED ... agent stopped" with no answer control (PendingAskCard.tsx:576).
- F-4: publish success unmounts the gauntlet, so the `auto_answered` note is never seen.
- F-2: independent judge blocks the planted pause workflow most attempts.
288 softened its paused sentence to "Still waiting on X." until this is fixed.
