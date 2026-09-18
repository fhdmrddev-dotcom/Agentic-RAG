---
seed_id: SEED-039
title: Workspace Panel — Reliability (fast-switch race) + Interaction Polish Bundle
status: planted
planted: 2026-05-29
planted_by: orchestrator (087 scenario-matrix round-3 testing)
trigger_when: A user hits the "No preview available / Could not load versions" stuck state at human pace — OR confusion over the two-click diff picker / a failed-write chat link — OR any future workspace-panel refactor phase (good time to batch these)
priority: low
tags: [frontend/panel, reliability, race-condition, ux-polish, diff, ask_user, phase-087, phase-086]
surface: Agentic-RAG
---

# SEED-039: Workspace Panel Reliability + Interaction Polish Bundle

## Context

Phase 087 round-3 scenario testing (2026-05-29) verified every panel scenario and **found + fixed one crash** (free-text `ask_user` → `null.length` → blank app, fixed as BUG-260529-03, commit `0df4b048`). It also surfaced a cluster of **minor, non-blocking** issues worth batching into one polish pass:

1. **Fast-interaction race (matrix gap #3) — reproduced ~4× under automation.** Rapid *separate* interactions (select a file → expand VERSIONS → read, back-to-back) reliably wedge `FilePreview` + `VersionDiff` into `"No preview available"` / `"Could not load versions"` **while the backend returns HTTP 200** for both content and versions. It **self-heals on reload**, and the same steps done in one deliberate sequence (with waits) render fine — so it's an abort/settle race in the keyed fetch effects, not a backend fault. Did not reproduce at human pace in earlier rounds, but reproduces easily under fast/scripted interaction. Adjacent to the deferred **Phase 086 reconcile-abort** work.
2. **Failed `workspace_write` mislabeled in the chat seam.** A write that the backend rejects (e.g. invalid path → `"Path must start with /"`) still emits a quiet chat pointer **"wrote {path} · see panel →"** — the seam keys off the tool *call*, not its *result*, so a failure reads as success and the "see panel →" link points at a file that was never created.
3. **`ask_user` countdown resets on reload.** `PendingAskCard` inits `remaining` from `timeout_seconds` on mount, ignoring elapsed time, so after a reload the displayed clock jumps back near-full (e.g. shows 9:52 for a 10:00 ask created minutes ago). Cosmetic — real expiry is enforced server-side — but misleading. Fix: compute from `created_at + timeout_seconds − now` (note `created_at` is GET-only, absent on the pure-SSE path).
4. **Two-click diff picker has no first-click feedback.** `VersionDiff.pickVersion` is a 2-click endpoint picker: the first pill click only arms `lastClicked` with **no visible change**, the second sets the pair. Correct behavior, but undiscoverable — a user clicking once sees "nothing happened." Needs an affordance ("pick two versions to compare" / highlight the armed endpoint).
5. **Empty diff has no explicit "No changes" affordance.** Two identical versions render `"+0 −0"` with a blank diff body — honest but bare; a "No changes between these versions" line would read better.

## Why deferred

All five are minor/cosmetic or only reproduce under automation-pace interaction; none block normal use, and the one true crash was already fixed. Batching them into a single polish pass (ideally alongside a panel refactor or the Phase 086 reconcile-abort hardening) is cheaper than five micro-fixes.

## Re-open trigger

Promote to a phase (or fold into a panel refactor) when **any** of:
1. A user reports the "No preview / Could not load" stuck state during normal (human-pace) use.
2. Operator/users are confused by the two-click diff picker or by a failed-write "see panel →" dead link.
3. Phase 086 reconcile-abort work is scheduled (do #1 together — same abort/settle family).
4. Any workspace-panel refactor phase opens (batch all five then per guardrail G-5).

## Likely shape if promoted

- **#1 race:** debounce file/version selection or guard the keyed fetch effects so a superseded fetch's abort doesn't leave a sticky error; retry-on-mount instead of latching `error=true`. Co-design with Phase 086 reconcile-abort.
- **#2:** render the seam pointer from the tool *result* (success vs error), and suppress/relabel the "see panel →" link for failed writes.
- **#3:** derive countdown from `created_at`; fall back to `timeout_seconds` only when `created_at` is absent.
- **#4:** add an "armed endpoint" highlight + hint text on first pill click.
- **#5:** explicit "No changes between v{a} and v{b}" empty-state line.

## Related

- `.planning/phases/087-panel-ui/087-SCENARIO-MATRIX.md` — round-3 sections (fast-interaction race; minor findings)
- `.planning/reported-bugs/BUG-260529-03.md` — the free-text ask_user crash (already fixed; this seed is the *remaining* polish)
- Phase 086 — reconcile-abort (deferred); #1 belongs to the same family
- `VersionDiff.tsx` (#4/#5), `PendingAskCard.tsx` (#3), `FilePreview.tsx`/`VersionDiff.tsx` keyed fetch effects (#1), chat seam pointer rendering (#2)
- Hot-file ledger (CLAUDE.md): a panel refactor would also satisfy G-5 for these files.
