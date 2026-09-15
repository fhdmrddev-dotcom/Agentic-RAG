---
seed_id: SEED-277
title: Timeout settings UI with tier presets
status: planted
planted: 2026-05-25
planted_by: Phase 075.11 close-by-quickfix
parent_phase: 075.11
re_open_trigger: |
  Operator wants to tune per-LLM-call / consumer timeouts WITHOUT editing
  backend/.env + restarting uvicorn. Examples: switching between snappy/
  deep modes for the same task; A/B-comparing timeout ceilings; sharing
  configs across team members; CI/cloud deployments where .env is locked.
target_milestone: Settings-overhaul (v3.x)
surface: Agentic-RAG
trigger_when: unset
renumbered_from: SEED-022
renumbered_because: >
  D-07/D-20: the OLDEST seed keeps the id, by the `created`-else-`planted` date. This file reads
  `planted: 2026-05-25`; `SEED-022-camelot-pdf-table-precision-audit.md` reads `planted:
  2026-05-16` and is 9 days older, so it keeps id 022 and this seed moved to 277. ⚠ The
  FRONTMATTER date is authoritative: git records this file as ADDED 2026-05-24, a day before its
  own `planted:` line, and that disagreement does not flip the verdict. ⛔ Not chosen by reference
  weight — D-07 rejects that rule by name.
---

# SEED-022 — Timeout Settings UI with Tier Presets

## Context

Phase 075.11 was originally scoped as a 3-layer timeout audit + Settings UI
with tier presets matching public chat-app benchmarks. Investigation showed
the timeout layers are already correctly architected (D-066-01) — the
operator-observed "wall" was just L1 (`LLM_CALL_TIMEOUT_OVERRIDES`) firing
at Sonnet's 240s default. A 2-line `.env` tweak resolved the immediate
need, so 075.11 closed by quickfix instead of running the full ceremony.

The Settings-UI scope is preserved here because it remains a real DX gap:
right now, tuning timeouts requires editing `backend/.env` and restarting
uvicorn — operator only.

## Scope (when re-opened)

| Layer | Today | Future UI knob |
|---|---|---|
| L1 per-LLM-call SDK timeout | `MODEL_CAPABILITIES.llm_call_timeout_seconds` + `LLM_CALL_TIMEOUT_OVERRIDES` env var | Settings → Advanced → per-model timeout matrix with provider tier defaults |
| L2 agent loop iteration cap | `threads.py:1445-1452 max_iterations` (15 default / 8 explorer, hardcoded) | Settings → Advanced → max iterations per agent mode |
| L3 SSE consumer timeout | `consumer_timeout_seconds` (610s default) | Auto-computed as `max(L1) × max_iterations + 10s` slack |

### Tier presets (public-benchmark sweep)

| Tier | Per-call | Loop | Total ceiling | Matches |
|---|---|---|---|---|
| Snappy | 60s | 5 | 5 min | ChatGPT 4o |
| Default | 240s | 8 | ~32 min | Claude.ai normal |
| Heavy | 600s | 12 | ~2 hr | Cursor multi-step refactor |
| Extended-thinking | 1800s | 15 | ~7.5 hr | Claude.ai extended thinking, o3-pro |

## Why deferred

- The `.env`-based path WORKS for the operator's current need
- A Settings UI without persistence-to-`app_settings` + RLS scoping would
  be cosmetic. Doing it RIGHT means schema migration + Settings UI + reload
  semantics + RLS — that's the original 075.11 scope
- The bigger Settings UI overhaul (covering Skills, audit log, memory,
  etc.) is queued for v3.x per `project_settings_design_guidance` memory
- No current pain — operator can edit `.env` in <60s

## How to recognize the re-open trigger

- Multiple "I want to tune timeouts" asks in a single milestone cycle
- A non-operator user (e.g., team member) needs timeout control
- A cloud/managed deployment where `.env` is frozen
- The Settings UI overhaul milestone starts and this is a natural rider

## Related

- `feedback_user_starts_backend.md` — the `.env`-edit + restart loop the operator already manages
- `project_settings_design_guidance.md` — broader Settings UI direction
- Phase 066 D-066-01 — rationale for "no hard total cap on agent loop"
- Phase 075.11 close-by-quickfix commit (`d6b6ef1`)
