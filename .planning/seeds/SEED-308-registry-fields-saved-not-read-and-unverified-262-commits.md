---
seed_id: SEED-308
title: Model Registry fields are saved but not read at runtime, and ~3,000 lines tagged (262) were never planned or verified
created: 2026-09-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The operator rules on the (262) renumber (the BUS item cited in 265-TRIAGE.md), OR any phase touches config.py get_model_capability, openai_service.py apply_tool_budget, thread_title.py, provider_gateway/**, expert_authoring.py, or migration 190's columns.
trigger_paths: ["backend/app/config.py", "backend/app/services/openai_service.py", "backend/app/services/thread_title.py", "backend/app/services/provider_gateway/**", "backend/app/services/expert_authoring.py", "frontend/src/components/admin/ModelAdvancedCapabilities.tsx"]
trigger_surfaces: [provider, admin, settings]
migration_note:
relates_to: ["262", "263", R265-262-01, R265-262-02, UAT-265-263-R9-OBS]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-308: Registry fields saved but not read, and unverified (262) commits

## The finding

- R265-262-01 (major): migration 190 and the Model Registry UI let an operator set `max_tools` and `reasoning_off`, but nothing reads either field at runtime. `apply_tool_budget` and the title call both read only the static `MODEL_CAPABILITIES`.
- UAT-265-263-R9-OBS: `author_skill_body` resolves the model through the synchronous `get_model_capability`, which never reads DB overrides. All four DB-registry ids resolved `capability_source = inferred` with no `emit_tier`. This is the same class of defect.
- R265-262-02 (major): commits 16b4d41d5, 45adc0e3c and 5e91fc649 carry the `(262)` tag but have no 262 plan. They add about 3,000 lines, including migration 190 and `openai_responses.py`. 262-VERIFICATION measured a commit range that starts after them.

## Why it matters

CLAUDE.md says a model's capabilities are DATA, not code. The operator-facing half of that is saved and then ignored, so the UI misstates what it controls. The unverified commits include a DB migration and a new provider adapter.

## When to surface

See `trigger_when`.

## Scope estimate

Medium. Runtime needs one async-aware capability read that every caller uses. The unverified commits need either a review round or a renumber followed by verification.

## Breadcrumbs

265-REVIEW-262.md · 263-UAT.md § Re-drive post-WR-08 (the R-9 board).
