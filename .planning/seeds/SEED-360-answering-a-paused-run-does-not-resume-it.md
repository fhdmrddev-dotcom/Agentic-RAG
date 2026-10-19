---
seed_id: SEED-360
title: Answering a paused run returns 200 but the run never completes (and the expired card offers no answer control)
created: 2026-10-19
surface: Agentic-RAG
status: folded
partial: true
status_note: "F-1 + F-3 (+288 WR-01) folded into Phase 289 as D-11..D-13 (2026-10-19, operator instruction). F-2 (judge) and F-4 (auto_answered note unmounts) deferred: publish-surface, not run page."
trigger_when: Next phase touching run resume, ask_user_response, or the pending-ask card; or Phase 289 (run page) if a paused run is to be answerable. Do not ship copy promising resume until fixed.
trigger_paths: ["backend/app/api/runs.py", "backend/app/services/run_lifecycle.py", "backend/app/services/harness_engine.py", "frontend/src/components/panel/PendingAskCard.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["SEED-164", "SEED-159", ".planning/phases/288-drafts-that-survive-pauses-that-publish/288-REVIEW.md"]
folded_into: "289"
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
