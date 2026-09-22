---
phase: 262-an-expert-you-can-discover
type: seeds-routing
swept: 2026-09-22 (planner, after all five PLAN.md files existed)
command: node scripts/check-seeds-register.cjs --phase 262
fired: 8
---

# Phase 262 — seeds register sweep

⚠ **A sweep run before `files_modified` exists matches on nothing and must not be read as clean.**
This sweep was run after all five plans were written. Eight seeds fire.

⛔ **These are PROPOSED routings, made by the planner.** A seed is answered by editing the seed —
plan 05 task 3 re-runs the sweep at close and writes the final routing into each seed's own
frontmatter, because a seed that shipped and still reads `planted` is re-proposed forever, and one
consciously rejected must say so rather than staying silent.

| Seed | Status now | Why it fired | Proposed routing |
|---|---|---|---|
| **SEED-303** — an Expert must ADD scope and capability | `partially-answered` | `trigger_paths` names `InviteExpertDialog.tsx`, `ExpertSpotlightCard.tsx`, `lib/api/experts.ts` — plan 02 edits the first two | **LEAVE partially-answered.** ⛔ S8 (Clone & Customise) is explicitly DEFERRED by CONTEXT — a write on a read surface, re-open trigger *"the first phase that gives system templates a tenant-editable path"*. S6 (tool floor) is not this phase: the modal NAMES bound skills and connections but adds no runtime semantic. At close, append what 262 answered (the four presentation fields now reach a normal user) and what it did not |
| **SEED-185** — no client-side router, zero addressable URLs | `planted` | `frontend/src/**` breadth; also `App.tsx` by name | **LEAVE OPEN, and grow the count.** This phase's modal exists BECAUSE there is no router (ROADMAP: *"a per-Expert URL stays owed and belongs to the routing phase, not here"*). ⚠ At close, update the seed: the app now has **thirteen** views, zero addressable — a catalog and a per-Expert detail view are both unlinkable |
| **SEED-296** — Evaluation has no front door | `planted` | `nav-items.ts` and `App.tsx` | **LEAVE OPEN, with a useful note.** ⭐ 262 is the worked example of what a new top-level home costs and how it is made safe: the triad in one commit, plus `activeViewReachability.ts`, which did not exist when this seed was planted. The next home is cheaper and its most dangerous leg is now fenced. Append that to the seed |
| **SEED-287** — TARGETS names files in some directories and whole directories in others | `planted` | `scripts/vitest-count-gate.cjs` | **STRENGTHEN, do not close.** ⚠ 262 pays the cost a FOURTH time: three separate plans each hand-add entries to both knobs because `src/components/experts/__tests__/` has no directory entry. Append 262 as a data point with the exact suite names |
| **SEED-280** — five suites run by the count gate and guarded by nothing | `planted` | `scripts/vitest-count-gate.cjs` | **CHECK AND PARTIALLY ANSWER.** Plan 01 adopts `lib/nav-items.test.ts` and `lib/__tests__/navItemsConnections.test.ts` into BOTH knobs; plans 03/04 adopt every new suite into both in the commit that creates it. ⛔ At close, check whether either of those two was among the seed's named five and update accordingly — do not assume |
| **SEED-286** — a thread's KB folder scope can only be set on the empty state | `planted` | `ChatArea.tsx`, `MessageInput.tsx` | **LEAVE OPEN.** Adjacent — an Expert changes what a thread reads — but CONTEXT's boundary is explicit: *"no change to what an Expert DOES"*, and `PACK-01`'s manifest-not-a-runtime rule must not start leaking through the catalog |
| **SEED-188** — the anti-prompt-injection discipline is asserted in prose and verified by nobody | `open` | `backend/tests/**` matched plan 02's new API test | **LEAVE OPEN, and widen the surface note.** ⚠ Plan 04 makes `example_output` the longest author-controlled string this app renders to other members (T-262-13: text child, no markdown pass, no `dangerouslySetInnerHTML`). That is a new member-to-member content channel and belongs in the seed's inventory |
| **SEED-284** — three file-local elapsed formatters, one home owed | `planted` | `docs/HOT-FILE-LEDGER.md` only | **LEAVE — PATH-ONLY MATCH, no domain overlap.** It fired because this phase edits the ledger, not because it touches an elapsed formatter. ⛔ Recorded rather than silently skipped: a match dismissed without a reason is indistinguishable from one nobody looked at |
