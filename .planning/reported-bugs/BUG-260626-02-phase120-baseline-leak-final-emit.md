---
id: BUG-260626-02
title: Phase-120 sandbox baseline files leak into the live final_output_files emit (dead "Download unavailable" cards on a reused sandbox)
reported: 2026-06-26
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [backend/sandbox, backend/streaming, frontend/chat-render]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: "Any phase re-touching agent_loop.py final_output_files emission (~2239 _emit_metas), OR a user reports dead 'Download unavailable' cards on a reused sandbox / second run in a thread. Promote via SEED-094 at /gsd:new-milestone."
reproduces_on:
  branch: develop
  commit: 06ae19dc
  date: 2026-06-26
---

# BUG-260626-02: Phase-120 baseline leak into final_output_files live emit

## What we observed

Separate, latent bug found while root-causing BUG-260626-01 (the git-blame agent surfaced it; the adversarial verifier confirmed it is **real but distinct** from the duplicate-card symptom).

Phase 120 (COLL-01, commit `a56ad2ea`) run-scopes the sandbox harvest by SHA-256-snapshotting every file already in `/sandbox/output/` at run start and seeding them into `_previous_files_in_run` with `iteration: -1`, `url: None` (`tool_dispatcher.py:~907-910`, `sandbox_service.py:~362-428`). The per-cell **delta** correctly skips these baseline hashes — that path is clean and is what the reload reconstruction (`lib/api.ts:132-153`) sums.

**But the live FINAL EMIT is unfiltered:** `agent_loop.py:~2239` builds the `final_output_files` SSE from `_emit_metas = list(_previous_files_in_run.values())` — the **entire** dict, including the seeded `iteration:-1` baseline entries. There is no `iteration != -1` filter on that emit path. Because the sandbox container is cached per `thread_id`, a later turn's baseline includes prior turns' files; they get re-emitted as **url-empty** entries.

## Why it matters

On a thread that reuses its sandbox container, the live "GENERATED FILES" panel of a later turn can show spurious entries for pre-existing files. Since these carry `url: ""`, `OutputFileCard` (`if (!file.url)`, ~line 91) routes them to the **dead "Download unavailable"** branch — visible clutter, not a working download. Lower severity than BUG-260626-01: it produces dead cards, not the url-present duplicated cards that were actually observed, and it self-corrects on reload (reconstruction uses deltas).

## Hypothesized cause

**FINDING.** Phase 120 fixed the per-cell delta but did not reconcile that the **same `_previous_files_in_run` dict also feeds the final emit aggregation**. Phase 120's tests (`test_120_collision_regression.py`) asserted only on `harvest_output_files`'s `delta` return value; the `agent_loop` final-emit aggregation was never covered → the cross-run leak was half-closed.

## Surface classification

`Agentic-RAG` — backend emit + frontend render. Routing candidate.

## Suggested routing

- **Fold into in-flight phase:** pair with BUG-260626-01 in a chat-output-files fix.
- **Defer:** n/a
- **Plant as seed:** n/a
- **External — note only:** no

## Proposed fix (backend, shared-path-safe)

Filter baseline entries out of the live emit: exclude `meta.get("iteration") == -1` from `_emit_metas` (and any hero re-stamp / persist that reads the same dict) at `agent_loop.py:~2239`. Do NOT touch the per-cell delta (already correct) or the SSE shape. Add a test covering the final-emit aggregation (not just the delta) so Phase-120's coverage gap is closed. NOTE per the verifier: this fix will NOT remove the duplicate url-present cards from BUG-260626-01 — that is the separate frontend key bug. Fix both.

## Workarounds

Reload — reconstruction uses clean per-cell deltas.

## Reference / evidence links

- Root-cause workflow `wf_cf429301-479` (locate:blame + verify:dup SECONDARY finding).
- `agent_loop.py:~2239` unfiltered `_emit_metas`; `tool_dispatcher.py:~907-910` baseline seed; `sandbox_service.py:~362-428` snapshot baseline.
