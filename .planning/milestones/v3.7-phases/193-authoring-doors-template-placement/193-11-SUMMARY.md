---
plan: 193-11
phase: 193-authoring-doors-template-placement
title: "Drive the eight owed G-4 rows and record what a person actually saw"
status: part-done
completed_tasks: 2.5
total_tasks: 3
autonomous: false
executed_at: 2026-08-14
executed_at_sha: cd94618b
executed_by: orchestrator inline (NOT an executor agent — see § Why this plan was not delegated)
key_files:
  modified:
    - .planning/phases/193-authoring-doors-template-placement/193-UAT.md
    - .planning/STATE.md
---

# 193-11 — the operator UAT checkpoint: PART-DONE, and honestly so

## ⚠ Read this first: this plan is NOT complete, and it cannot be completed by an agent

**Task 2 is `The operator drives the eight rows`. Six were driven; two cannot be.**

U1 and U2 ask *a person who has never used the Builder* to predict what each door does and to count
the choices they perceive, **recorded verbatim**. An agent that has read every line of this codebase
is the worst possible subject. Scoring them would be exactly the
check-that-cannot-fail `193-UAT.md` was written to prevent, and would convert the phase's headline
evidence into a fabrication. **They remain owed, and they are the two rows the phase most wants.**

## The finding that matters more than the tally

**Two of the three ROADMAP success criteria are decided by the two owed rows.**

| SC | What must be TRUE | Decided by | Status |
|---|---|---|---|
| SC#1 | a person who has not seen the Builder can predict what each door does before clicking | **U1** | ⏸ **NOT VERIFIED** |
| SC#2 | the number of perceived choices does not increase | **U2** | ⏸ **NOT VERIFIED** |
| SC#3 | a user with a template to fill can find where to supply it | **U4** pass (+U5) | ✅ **VERIFIED** |

**One of three.** SC#1 and SC#2 are, by their own wording, properties of a person's prediction and a
person's count; the 3557 passing frontend cases cannot stand in for either. The phase's headline
claim — *the two doors are tellable apart* — **is not yet evidenced**. Six other rows passing does
not change that, and this SUMMARY says so rather than letting a green gate wall imply otherwise.

## What was done

### Task 1 — stage the drive ✅

Preconditions recorded with **observed** values, not assumed ones: frontend `200`; backend `200`
(the first probe read `000` racing a cold start and was re-probed rather than reported);
Supabase `200`; **`ephemeral-template-fill-101uat` present and `published`** in
`workflow_definitions` (the table is `workflow_definitions`, not `workflows`); **145 published /
78 draft**, which matches the denominator D-21's live scoring quotes; base commit recorded as
`eb7f7e5e`, later than the authored `67b8d049` and noted as such.

### Task 2 — six of eight rows driven ◐

`6 driven · 5 pass · 1 partial · 0 fail · 2 owed`. Commits `18404fe5`, `cd94618b`.
Driven in Chrome against the operator's **real** library (107 identity lines rendered), located by
**reading the screen** — typing into the visible search box — never by id, UUID or element picker
(D-27).

- **U3 ✅ — driven at BOTH `visual_workflow_canvas` values, and this is the result worth keeping.**
  D-05's conditional is proved in **both directions**: `ml-auto` is **absent** on the judge badge in
  the merged row and **present** in the standalone band (gap label→badge **95 px vs 937 px**; badge
  right edge 1520 of a 1536 viewport). Driving one value would have reported a pass while half the
  shipped behaviour went unmeasured — precisely what the row's own note warned.
  Method: the flag was flipped through the **Control Room UI, not SQL**, because this repo has a
  settings sync-cache with no staleness check and a direct DB write could have left the client
  serving the stale value — the row would have returned a verdict while measuring nothing. Confirmed
  `audience: "off"` in the DB before driving, and **restored afterwards to its exact recorded
  pre-test value** `{"roles": [], "groups": [], "audience": "everyone"}`, compared against the value
  captured beforehand rather than from memory.
- **U3b ✅** — the describe band's escape classes are **byte-identical** to the govern band's;
  `dividerCount: 0`, `judgeBadgeCount: 0` — no divider where there is no third peer.
- **U4 ✅ both halves** — the provenance sentence matched **byte-for-byte** against
  `RunModal.tsx:429`; it is a security claim and was read as one. The non-admitting modal has
  `fileInputCount: 0` and `orphanSeparators: 0`: **shorter, not damaged**, so D-17's claim holds at
  the surface. Comparison row was *Multi-tool Risk Register Fill* — a workflow that binds a library
  template and so correctly never asks for one, the sharpest available contrast.
- **U5 ◐** — structure, placement and treatment pass and are **proved**: the node is
  `<span>needs a template</span>` with **no class attribute at all** (background `rgba(0,0,0,0)`,
  border `0px`, radius `0px`), at segment index **2** per D-14, on **5 of 107** rendered rows. No
  chip — SEED-155 is not repeated. ⚠ **A cruder first check reported `hasBorderOrChip: true`; that
  was the `Yours` ownership pill, not the mark. Recorded because the wrong answer came first.**
  The verdict turns on whether it reads as *a requirement of you*, which is a reader's property.
- **U6 ✅** — card `Build it myself` → strip `Build it myself`. The 🔧/⚡ asymmetry (Residual 3) was
  judged by looking: no gap, no placeholder, no misalignment; it reads as deliberately plainer.
- **U7 ✅** — a blocked `POST /threads` produced a **visible `role="alert"`** on a workflow with **no
  template control at all**. The WR-03 class defect Phase 192 had to repair on this very surface.
  `fetch` was restored immediately; **the single blocked POST created no run**, so no operator data
  was touched.

### Task 3 — recorded honestly, and everything routed ✅

- **`193-UAT.md` tally corrected** to the true `6 driven · 5 pass · 1 partial · 0 fail · 2 owed`,
  with a `## Routing & triage` section that reports **success-criteria status FIRST**, before any
  routing, as the plan requires.
- **Fails to triage: NONE.** `0 fail`, so the date/size/route ladder had no input. The one partial is
  recorded with the condition that would make it a fail, rather than being quietly upgraded to a pass.
- **G-7 check run, output pasted verbatim** (never eyeballed):
  `plans: 11 total · 0 gap-closure` → **G-7 clear**, exit `0`. **No gap-closure round is warranted
  and none was opened** — there is nothing to close.
- **`.planning/STATE.md` hand-edited.** ⚠ **No `state.*` SDK verb was called** — seven of them write
  false records and corrupted this file five times in Phase 190 alone. The edit was backed up first
  and diffed after: **exactly 2 hunks, 4 lines removed**, and the frontmatter still parses as YAML
  with its correct 8 top-level keys (the corruption shape that once ballooned this file to 562 KB is
  absent).
- **All four deferred triggers checked and recorded fired/not fired** — two fired:
  `WorkflowCard.tsx`'s refactor trigger (**8 commits / 3 phases / 818 L — G-5 now fires**, armed for
  the next phase) and D-10's vocabulary merge, where `doorVocabulary.ts` is confirmed by `ls` to be
  the **fourth** `*Vocabulary` module (`door`, `library`, `phase`, `run`). D-10 **stays deferred with
  its trigger marked SPENT** — merging mid-phase would have put a shared module under a words-only
  proof.

## Why this plan was not delegated to an executor agent

Deliberate. Task 2 is a human gate, and handing a checkpoint plan to an agent invites it to "drive"
U1/U2 itself and manufacture verdicts — the precise failure this file exists to prevent. The
evidence for the six driven rows lived in the orchestrator's context; an executor would have had to
re-drive or trust a summary. Recorded here so the choice is auditable rather than implicit.

## What is owed, and what to do next

1. **Drive U1, then U2**, with someone who has not used the Builder. They are the only evidence SC#1
   and SC#2 can ever have, and they take minutes.
2. `/gsd:code-review 193` — **the mid-phase fast-fix `294a2ac8` is the least-reviewed code in the
   phase**: 5 files, 63 insertions, into a file no plan owned and no plan-checker saw.
3. `/gsd:verify-work 193` → `/gsd:secure-phase 193` (no `193-SECURITY.md` exists and enforcement
   defaults on) → mark complete.

**If the phase is closed before U1/U2 run, it closes with 1 of 3 success criteria verified** — which
is legitimate, but only as a recorded DECISION naming U1 as the first row to run, never as a claim
that the phase demonstrated its own goal.
