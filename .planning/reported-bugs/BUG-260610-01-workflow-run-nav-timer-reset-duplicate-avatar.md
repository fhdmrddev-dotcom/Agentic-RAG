---
id: BUG-260610-01
title: Navigating away/back during a streaming workflow run resets the run timer and shows a duplicated empty assistant avatar
reported: 2026-06-10
surface: Agentic-RAG
severity: minor
status: open     # STAYS OPEN DELIBERATELY: Phase 200 folds the TIMER half only; the DUPLICATE-AVATAR half is live and a folded status would hide it from the routing scan. # ⚠⚠ RE-OPENED 2026-08-16 (LATE THE SAME DAY) — the 194.1 fold claim below was
                 # OBSERVED FAILING by the operator during 194.1 UAT, on the very path it claimed
                 # to have made impossible. `status: folded` would have hidden a live defect from
                 # the routing scan for a second time in this one report's history. The whole
                 # `folded` reasoning is kept verbatim below rather than deleted, because a claim
                 # that failed is evidence and deleting it destroys the trail. See the
                 # `## 2026-08-16 (late) — THE 194.1 FOLD CLAIM DID NOT HOLD` section at the foot.
                 # Prior value, superseded not overwritten:
                 # folded   # ⚠ CORRECTED 2026-08-16 then FOLDED into Phase 194.1 the same day at
                 # discuss-phase. ⚠ PARTIAL FOLD — the DUPLICATE-AVATAR half only, and even that
                 # is claimed as SURFACE REMOVAL, not repair: R5 suppresses the harness kickoff
                 # assistant placeholder, so the artefact has nothing to draw on. The double-mount
                 # RACE ITSELF IS NOT FIXED and returns if it ever reaches a content-bearing
                 # message. The TIMER half is NOT claimed (see re_open_trigger). Prior note:
                 # was `folded` / folded_into 174, but this report's OWN
               # re_open_trigger says the DUPLICATE-AVATAR half was "NOT folded … Stays OPEN".
               # The frontmatter and the body disagreed for two months and the frontmatter is what
               # the routing scan reads. Re-observed live 2026-08-16 (Phase 194 UAT) — see the
               # 2026-08-16 update at the foot of this file. The TIMER half may well be closed by
               # 174/128; nobody has verified it (verified_closed_by is still null).
affected_areas: [frontend/streaming, frontend/run-honesty, harness/workflow-ui]
folded_into: 200       # PARTIAL -- TIMER HALF ONLY (discuss-phase 200, 2026-08-19). The duplicate-avatar half is NOT folded and is why status stays open. # ⚠ CLEARED 2026-08-16 (late) — the 194.1 fold claim was observed failing.
                       # Superseded values, kept not overwritten: "194.1" (duplicate-avatar half,
                       # claimed at discuss-phase 194.1 and REFUTED by UAT the same day), and
                       # before that "174". A `folded_into` naming a phase that did not close it
                       # is worse than null: it tells every later scan the work is done.
verified_closed_by: null
related_seeds: []
re_open_trigger: "Reviewed at /gsd:discuss-phase 124 (2026-06-26) — left OPEN, NOT folded: live-run timer/reconcile mechanics, not the soul/door chrome Phase 124 re-skins. Re-check after the 124 run-header soul re-skin lands — if the soul header touches the run strip, this timer-reseed + duplicate-avatar bug may then be in-scope to fix. | Reviewed at /gsd:discuss-phase 128 (2026-06-27) — CONDITIONAL fold (CONTEXT D-04): CTC-03 makes the header RunStatusStrip the SOLE timer, so the timer-reseed fix (seed elapsed from run started_at, not mount) is folded into 128 ONLY IF the planner confirms the reseed is in that same canonical Deep RunStatusStrip (vs the 095.1-fixed Deep run-card, vs the harness/workflow strip = Phase 127's surface); else leave open. The duplicate-avatar symptom (StreamsProvider/MessageList double-mount race) is NOT folded — deferred to the run-honesty cluster slot. Stays OPEN. | Folded at /gsd:discuss-phase 194.1 (2026-08-16) — PARTIAL, DUPLICATE-AVATAR HALF ONLY, and claimed as SURFACE REMOVAL rather than repair: R5 suppresses the harness kickoff assistant placeholder (StreamsProvider.tsx:1926-1936) via a harness-scoped gate inside sendMessage, so at harness kickoff there is no assistant node for the artefact to be drawn on. THE DOUBLE-MOUNT RACE ITSELF IS NOT FIXED — 194-MEASUREMENTS.md still lists three live candidate mechanisms with no verdict. Re-open the duplicate-avatar half if the artefact is seen on a CONTENT-BEARING message, or anywhere on the Deep / plain-chat path (which 194.1 does not touch, per 174 D-14). | Folded at /gsd:discuss-phase 200 (2026-08-19) -- PARTIAL, TIMER HALF ONLY, and this time by REMOVING THE CAUSE rather than the surface: the timer resets because it starts at component mount, and Phase 200 CONTEXT D-05 adds workflow_phases.started_at written at the six existing transition sites, so a duration derived from a server timestamp CANNOT reset on navigation. Measured basis: all phases are batch-INSERTed at run creation (db/workflows.py:334) and every transition overwrites updated_at, so no existing column could have carried this. THE DUPLICATE-AVATAR HALF IS STILL NOT FOLDED and 194.1 own three candidate mechanisms still carry no verdict -- re-open that half if the artefact is seen on a content-bearing message or anywhere on the Deep / plain-chat path. Verify the timer half by navigating away from a running workflow and back, and confirming the elapsed reading continues rather than restarting. The TIMER half is NOT claimed by 194.1 and stays unverified — verified_closed_by is still null after 174 and 128."
reproduces_on:
  branch: develop
  commit: 66dca2d8
  date: 2026-06-22
---

# BUG-260610-01: Workflow-run nav glitch — timer resets + duplicated empty assistant avatar

## What we observed

During Phase 099 live UAT (L3 Google row, gemini-3.5-flash, workflow `skill_compose_099uat`): with a workflow run streaming in Thread A, the operator navigated to another thread and back (repeatedly). Each time:

1. **The run-strip timer reset** — e.g., a run several minutes in showed `28s · Step 0 · working...` after nav-back; the elapsed timer reseeds from component mount instead of the run's `started_at`.
2. **A duplicated empty assistant avatar** rendered in the message list — one bare avatar with no content directly above the real streaming placeholder ("Starting workflow..."). Screenshot: `screenshots/Screenshot 2026-06-10 122214.png`.

The run itself completed correctly (output intact, phase completed, no data loss) — these are display-honesty defects only.

**Cross-provider confirmation:** the same two symptoms reproduced on the OpenRouter run (L4 row, same UAT session) — provider-agnostic frontend reconcile behavior, not a provider-specific path.

**Also reproduced on DeepSeek (L9 row)** — now confirmed on Google, OpenRouter, Moonshot, and DeepSeek runs: fully provider-agnostic.

**Related symptom (L8 row, Deep mode):** on slow providers (OpenRouter llama-3.3-70b, Moonshot kimi-k2.6) a blank assistant avatar renders with no placeholder text until the first tool call arrives, then the thread loads correctly (screenshot `Screenshot 2026-06-10 125236.png`). Same empty-bubble family in plain Deep mode — the placeholder gap scales with provider first-token latency.

**Worse variant (L6 row, kimi-k2.6/Moonshot, screenshot `Screenshot 2026-06-10 123038.png`):** TWO bare assistant avatars with NO "Setting up agent..."/"Starting workflow..." placeholder text at all — the streaming placeholder text vanished entirely on a slow-provider run, leaving only empty avatar shells. Timer reset reproduced across BOTH parallel threads (the Deep thread's tool panel stayed correct).

## Update — reproduced + DB-confirmed render-only during Phase 102 UAT (2026-06-13)

Re-observed during Phase 102 freshness `ask_user` live UAT (DeepSeek `deepseek-v4-flash`, workflow `fresh-pause-102uat`):
- **At KICKOFF (flow start), not just on nav:** an orphan empty assistant avatar (no content) appears, and is sometimes **duplicated at start — one orphan avatar + one showing "starting workflow"**. This pins a second trigger beyond nav-back: the run-kickoff optimistic placeholder + the first SSE event double-mount (the S3 MessageList key-mismatch / S4 optimistic+reconcile-race seams).
- **CONFIRMED render-only (not a data dup):** the backend has exactly **1 assistant message row** per run (`messages` where role='assistant' = 1 for both the Proceed run ccec4354 and the Abort run 146a3bc2). The duplicate/orphan is purely a frontend render artifact — no duplicated message, no data loss. The freshness pause itself worked correctly (Proceed → completed + `validator_ask_user_approved` receipt; Abort → honest fail).
- **NOT a Phase 102 regression:** Phase 102 changed zero frontend files (all fixes were backend: publish_service / forced_emit / validator_kinds). This is the same pre-existing chat-surface bug; DeepSeek's first-token latency amplifies the empty-avatar window.

## Update — reproduced at KICKOFF on a FAST provider during Phase 121 demo (2026-06-22, HEAD 66dca2d8 / develop)

Re-observed live while demoing the Phase 121 2-pill composer: launched the published `Doc Q&A` workflow from the Workflows page into a fresh thread (OpenAI `gpt-5.4-mini`, the operator's default — **a fast provider**, not the slow OpenRouter/Moonshot/DeepSeek/Google runs all prior evidence came from).

- **At KICKOFF, the duplicated empty assistant avatar flashed for ~1–2 s, then reconciled away** once the first content arrived. Operator-observed in real time; the orchestrator's discrete a11y snapshots/screenshots only froze a single empty avatar (the transient double-mount is too brief to reliably catch in a point-in-time capture — noting this so future repro attempts use video/rapid frames, not single snapshots).
- **New signal — provider speed is NOT a precondition:** all prior evidence (Google/OpenRouter/Moonshot/DeepSeek) framed the empty-avatar window as *amplified by slow first-token latency*. This repro on fast OpenAI `gpt-5.4-mini` shows the double-mount still fires even when first-token latency is low — consistent with the root cause being the **kickoff optimistic-placeholder + first-SSE-event double-mount race** (S3/S4 seams), with provider latency only widening the *visible* window, not causing it.
- **NOT a Phase 121 regression:** Phase 121 (IA-01, 2-pill composer removal) touched **zero** render-path files — `git diff 131584b6^..66dca2d8` over `MessageItem.tsx` / `MessageList.tsx` / `useMessages.ts` / `StreamsProvider.tsx` is empty (composer-only edits to `MessageInput.tsx` + `ChatArea.tsx`). The avatar double-mount path is untouched; this is the same pre-existing artifact. Phase 121 decision **D-07** had already routed this report to Phase 124 (kept open, in the SC#10 must-not-regress set, not folded into 121).
- **Sibling cluster confirmed same session:** the run timeline still rendered the placeholder phase slug **`phase-0`** ("Phase 1 of 3, phase-0, started") — i.e. `BUG-260609-04` reproduced alongside, reinforcing the "close the workflow-run-display cluster together" routing below.

## Why it matters

The run timer is the operator's primary "is this stuck?" signal during long workflow runs; a timer that restarts on every navigation makes a 5-minute run look like it just started, defeating run honesty (Phase 094/095 design goals). The duplicate empty avatar reads as a broken/phantom message. Both erode trust in the live-execution surface, especially during slow provider runs (Google) where the operator is most likely to navigate away.

## Hypothesized cause

HYPOTHESIS (unverified): same family as the Phase 095 reload-timer finding (fixed in 095.1 for Deep run cards) — the workflow/harness run strip seeds its elapsed timer from local mount time instead of the run row's `started_at`/`created_at`, so a remount on thread nav restarts it. The duplicate avatar is likely the known 1-2s empty-bubble reconcile artifact (open since 098) surfacing persistently during workflow streaming: reconcile-on-nav inserts an empty assistant message shell alongside the streaming placeholder. Both are StreamsProvider/MessageList reconcile-on-remount paths, not backend issues (backend state was correct; run completed).

## Surface classification

`Agentic-RAG` — frontend chat-surface behavior of this app's workflow-mode run UI.

## Suggested routing

- **Fold into in-flight phase:** n/a (099 is functionally complete; this is not a skill-composition defect)
- **Defer to future phase / milestone:** candidate for the next chat-surface/run-honesty polish slot (alongside open BUG-260609-02 SUB-RESULTS desc loss, BUG-260609-04 phase-card placeholder slug, and the 1-2s empty-bubble — all four share the workflow-run display surface and could close together)
- **Plant as seed:** no — concrete bug, not a cross-milestone concern
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Stay on the running thread for an accurate timer; the glitch is display-only — refreshing after run completion shows the correct final state. Run completion/output are unaffected.

## Reference / evidence links

- `screenshots/Screenshot 2026-06-10 122214.png` (duplicate avatar + reset timer at 28s mid-run)
- `screenshots/Screenshot 2026-06-10 122245.png` / `122304.png` (run completed correctly despite the glitch)
- Phase 099 UAT session: `.planning/phases/099-workflow-skill-composition/099-UAT.md` Test 3
- Prior family: 095 reload-timer (fixed 095.1 for Deep), 098 open run-honesty trio (BUG-260609-02 / BUG-260609-04 / 1-2s empty-bubble)

---

## Update — RE-OBSERVED 2026-08-16 (Phase 194 UAT), and the frontmatter was corrected

Operator report while watching live workflow runs being stopped during Phase 194 UAT, verbatim:

> *"if you notice the duplicated avatar — which is the case not only [in] the workflow, it is in the
> chat area I think. And it is a documented bug."*

The operator is right that it is documented: **this report.** Two things follow.

### 1. ⚠ The frontmatter said `folded` while this report's own body said the avatar half stays OPEN

`status: folded` / `folded_into: "174"` has been the machine-readable state since Phase 174, while
the `re_open_trigger` on the same record ends:

> *"The duplicate-avatar symptom (StreamsProvider/MessageList double-mount race) is **NOT folded** —
> deferred to the run-honesty cluster slot. **Stays OPEN**."*

**The routing scan reads the frontmatter, not the prose.** `CLAUDE.md`'s reported-bugs touchpoints
filter on `status: open`, so for two months this bug was invisible to every `/gsd:discuss-phase`
sweep **despite its own text saying it was open** — the same class of failure as a hot file being
absent from the G-5 ledger: *a guardrail cannot see what is absent from its list.* Corrected to
`status: open` 2026-08-16; the original values are recorded in the inline comment rather than
overwritten silently.

`verified_closed_by` is still `null`, so nothing has ever confirmed the timer half either.

### 2. It reproduces on a surface this report had not yet named

Prior confirmations: Google, OpenRouter, Moonshot, DeepSeek — all *workflow* runs plus a Deep-mode
sibling. The 2026-08-16 sighting adds the operator's own observation that it is **"not only [in] the
workflow, it is in the chat area"** — i.e. the plain chat surface, at `045a83dc`, ten weeks and
several run-honesty phases (128, 174) after the last recorded sighting.

⚠ **Not independently measured in this session.** The Phase 194 UAT was driven against the database
and the wire, and a duplicated avatar is a pure render artifact that neither instrument can see —
which is exactly why the operator's eye caught something seven driven rows did not. Recorded as an
operator observation, not as a measurement, and it needs a DOM-level repro before anyone claims a
cause.

### Routing

- Still `Agentic-RAG`; still the run-honesty cluster.
- Now a natural companion to `BUG-260816-01` and `BUG-260816-02` (the Stop-feedback and
  stopped-thread-honesty reports from the same session) — all three are *"what the message list
  renders during and after an interrupted run"*.
- ⚠ **G-2 fires** — avatar/placeholder render is visual; `/gsd:sketch` before spec/discuss if it is
  fixed alongside the other two.
- Phase 194 recorded an adjacent, deliberately-unresolved measurement of its own: see
  `194-MEASUREMENTS.md` (plan `194-01` Task 2, the duplicate-icon sample), which **disqualified its
  own sample on two measured grounds** and recorded what was and was not established rather than
  drawing a verdict. Start there — it is the most recent honest attempt to pin this.

---

## 2026-08-16 (late) — THE 194.1 FOLD CLAIM DID NOT HOLD

**Observed by the operator during Phase 194.1 UAT, hours after the fold was recorded, on the exact path the
fold claimed to have made impossible.** Evidence: `screenshots/Screenshot 2026-08-16 213715.png`, a harness
kickoff.

Three stacked elements on the assistant side of the transcript:

1. a **bare avatar with no content**,
2. a **second avatar reading `Starting workflow… •••`**,
3. the new Phase-194.1 run line `◆ Starting workflow… · Step 1 of 5 · 24s`.

Items 1 and 2 are this report's originally recorded shape, verbatim: *"one bare avatar with no content directly
above the real streaming placeholder."* ⚠ **`Starting workflow…` now renders TWICE on one kickoff** — so on
this path Phase 194.1 added a third run indicator without removing either of the two it claimed to remove.

### Why the claim failed — hypothesis, NOT finding

The fold's reasoning was: *"R5 suppresses the harness kickoff assistant placeholder … so at harness kickoff
there is no assistant node for the artefact to be drawn on."*

R5's shipped gate is `if (!opts?.workflowDefinitionId)` (`StreamsProvider.tsx:2147`, Phase 194.1 plan 03). It
suppresses the optimistic insert **only on the `sendMessage` path, and only when that call carries a workflow
definition id.** The observed run was a **workflow-LOCKED composer kickoff** (composer placeholder read
`Workflow running — Cancel to switch back`).

**Two things must be established before any re-fold, and neither is established now:**
1. **Does the workflow-locked composer kickoff reach `sendMessage` with `workflowDefinitionId` set at all?**
   If it does not, R5's gate is simply never consulted on this path and the fold was scoped to a path the
   operator does not use.
2. **`REQUIREMENTS.md` A-1 names a SECOND placeholder source that R5 does not touch** — the reconcile loop
   stamping a `runStatus:"streaming"` placeholder per run (`StreamsProvider.tsx:1607-1638`). If that is the
   source of the bare avatar, R5 could never have removed it, and the two avatars have two different origins.

⚠ **Do not re-fold this report on a code-reading.** It has now been folded twice (174, then 194.1) and
survived both. The next fold must be accompanied by an operator observation of a harness kickoff with **zero**
bare avatars, or it is a third claim of the same kind.

### What this report demonstrates about the process, and why the note stays

`status:` frontmatter **is** the routing index — the `/gsd:discuss-phase` scan reads it and nothing else.
This report has now been mis-indexed twice in its life:

- **2026-06 → 2026-08:** `status: folded` / `folded_into: 174` while the report's own `re_open_trigger` prose
  said the duplicate-avatar half *"Stays OPEN"*. Frontmatter and body disagreed for **two months** and the
  frontmatter won every scan.
- **2026-08-16:** `status: folded` / `folded_into: 194.1` for roughly **six hours**, on a claim the operator
  refuted the same day.

Both times the failure was identical: **a claim recorded as an outcome.** The lesson is not "check more
carefully" — it is that a fold asserting *surface removal* is a claim about rendered output and can only be
discharged by looking at rendered output.

### Status of the two halves, restated

| half | status | claimed by | verified |
|---|---|---|---|
| duplicate empty assistant avatar | **OPEN** — re-observed 2026-08-16 | 174 (failed), 194.1 (failed) | never |
| run timer resets on nav | **OPEN, unverified** | 128 conditionally, 174 | never — `verified_closed_by` is still null |
