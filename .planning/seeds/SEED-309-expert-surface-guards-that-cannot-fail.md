---
seed_id: SEED-309
title: Expert catalog and Expert API guards that cannot fail, plus start-chat and role-picker robustness
created: 2026-09-24
surface: Agentic-RAG
status: deferred
partial: false
status_note: "Phase 266 plan-phase (2026-09-24): operator deferred to Phase 267. 266 is already 5 plans (G-8 ceiling) and most items (ChatLayout wiring, rename_thread, chat-send refusal, role picker) sit outside 266 install scope."
trigger_when: Any phase touching the Expert catalog, startScopedChat, ChatLayout's onStartChat wiring, api/experts.py, api/threads.py rename_thread, the entitlement refusal helpers, or the authoring route fence. Phases 266 and 267 fire on it.
trigger_paths: ["frontend/src/components/experts/**", "frontend/src/components/layout/ChatLayout.tsx", "backend/app/api/experts.py", "backend/app/api/threads.py", "backend/tests/unit/test_262_expert_list_grants_api.py", "backend/tests/unit/test_258_every_authoring_write_is_tier_gated.py", "frontend/src/lib/api/threads.ts"]
trigger_surfaces: [chat, admin, workflow]
migration_note:
relates_to: ["258", "261", "262", R265-262-03, R265-262-04, R265-262-06, R265-audit-fixes-03, R265-audit-fixes-06, R265-audit-fixes-10, R265-audit-fixes-13]
folded_into: "267"
renumbered_from: null
renumbered_because: null
---

# SEED-309: Expert-surface guards that cannot fail

## The finding

Several tests stay green even when the behaviour they name is removed. There are also robustness gaps:

- R265-262-03: no test covers ChatLayout's real `onStartChat` wiring; only the injected fakes are tested.
- R265-262-04: Start Chat has no in-flight guard, so a double click creates two scoped threads. The fix spans 3 files.
- R265-262-06: the role half of the grant-aware list test cannot fail, because `resolve_caller_role` falls back to `member`.
- R265-audit-fixes-03: the `rename_thread` org-role fix has no test.
- R265-audit-fixes-06: the chat-send entitlement refusal message has no test.
- R265-audit-fixes-10: the grant role picker leaves out `super-admin`, which the CHECK allows.
- R265-audit-fixes-13 (PLAUSIBLE): the authoring route fence skips a write that has no `require_visible`, so a new route that has neither dependency passes.

## Why it matters

A guard that cannot fail gives false confidence. This register has recorded that failure mode many times before.

## When to surface

See `trigger_when`.

## Scope estimate

Small to Medium. Most of it is tests, plus a UI pending-state change across three files.

## Breadcrumbs

265-REVIEW-262.md · 265-REVIEW-audit-fixes.md.
