# 022 Run-Surface Audit — sketch 022 (workflow-run-in-thread) vs. the shipped run surface

**Scope:** Does sketch `022-workflow-run-in-thread` align with the app's REAL run surface (workspace panel + harness phase timeline + chat tool-card seam), and does it meet the meaningful-step clarity bar? Evidence drawn from 4 investigation findings, re-verified against the live files cited below.

**Sources audited:** `.planning/sketches/022-workflow-run-in-thread/index.html` (only file — no README), `frontend/src/components/panel/WorkspacePanel.tsx`, `PhaseTimeline.tsx`, `PhaseCard.tsx`, `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/index.ts`, `backend/app/models/harness.py`, `backend/app/services/harness_engine.py`, `backend/app/services/harness/phase_types.py`, `frontend/src/components/chat/{MessageItem,RunCard,ToolCallPanel,RunStatusStrip}.tsx`, `frontend/src/lib/stepCount.ts`, `frontend/src/components/panel/BatchResultList.tsx`, and bugs `BUG-260609-02`, `BUG-260609-04`, `BUG-260610-01`.

---

## 1. VERDICT

**PARTIAL ALIGN — REVISE BEFORE BUILD. Sketch 022 reuses the right VOCABULARY but places it on the WRONG SURFACE, and it does NOT meet the meaningful-step bar — it fakes the meaning instead of fixing it.**

Two findings net out:

- **(a) Run-surface alignment — CONTRADICTS on placement.** 022 renders the full 6-phase harness spine *inside the chat transcript* as a `.run-frame` episode card (`index.html:383-447` `runEpisode()`, injected into `#chatScroll` at `:657`). The shipped app locks that spine to the **right-side workspace panel** — the "Workflow" `PanelSection` mounting `<PhaseTimeline/>` (`WorkspacePanel.tsx:187-190`), gated on `isHarness`. 022 demotes the panel to a passive note + FILES list (`index.html:259-266`, `:804-821`). This re-litigates the signed-off 008-D / 009-C seam ("panel = what's true now, chat = what happened") and would create a **third run-frame** on the hottest surface — alongside the existing chat `RunCard` rail and the panel `PhaseTimeline`. This is exactly the dual-surface "eyes bounce, nothing is clearly the live thing" failure that sketch 004 explicitly warns against.

- **(b) Meaningful steps — FABRICATED, not solved.** 022 hardcodes a human `name` per phase (`Load portfolio`, `Gather evidence`, …, `index.html:308-313`), a per-phase `gate` chip, and PH_SUM activity summaries (`31 sources · 9 calls`, `index.html:343-346`). NONE of these exist on the real wire. `PhaseSpec` carries only `{slug, phase_index, config, validators}` (`harness.py:189-193`) — **no name/title/description**. The durable `WorkflowPhaseState` stores only `{slug, phase_index, status}` (`api.ts:1108-1112`) — **no phase_type, no args**. And per-phase activity counts are *deliberately suppressed* by D-03 ("SUPPRESS-DON'T-FAKE", `PhaseTimeline.tsx:24-26`). So 022 paints the END STATE the operator wants on top of data the app does not emit — papering over the real "phases not meaningful" defect rather than designing the wire change that closes it.

**What IS right:** the *atoms* are honest reuse — the never-vanishes status strip (015-C ↔ `RunStatusStrip.tsx`), the 006-C ask_user dual-surface pause (↔ `llm_human_input` executor `phase_types.py:594-720`), the 011-A locked composer, the three-way terminal run-honesty (`index.html:331-340,410-430` ↔ `PhaseCard` `EMIT_FAILURE_COPY`), and the phase-TYPE labels/glyphs which match `PHASE_TYPE_LABEL` byte-for-byte (`PhaseCard.tsx:41-48`). And the composer-during-a-run exploration (variant A locked / B alongside / C dedicated) is genuinely additive — the shipped surface has not resolved it.

**Bottom line:** 022 is a useful *target-state* mock for the meaningful-step bar and a correct atom inventory, but as a *build brief* it is not buildable as drawn — the spine placement contradicts the shipped seam, and the meaning it shows requires backend/wire work the sketch never names. It must be revised to (i) move the spine to the panel and keep a thin chat receipt, and (ii) expose the real data gap rather than fake past it.

---

## 2. ALIGNMENT MAP — reuse vs. contradict/invent

### MUST REUSE (real surfaces 022 should bind to, not re-skin)

| 022 element | Real component to reuse | Evidence |
|---|---|---|
| Panel shell geometry (52px rail \| chat \| `clamp(320px,33%,430px)`) | `WorkspacePanel.tsx` + `ChatLayout` grid (`1fr` + open?`clamp(300px,30%,420px)`:`52px`) — push/split, collapse-to-rail w/ pending dot, mobile bottom-sheet | `WorkspacePanel.tsx:57,233-256,273-283`; `ChatLayout.tsx:230-254` |
| The phase spine (cards-on-a-spine, nodes, status atoms) | `PhaseTimeline.tsx` (`<ol>` of `PhaseCard` rows) — **mounted in the panel** | `PhaseTimeline.tsx:168-202`; `WorkspacePanel.tsx:187-190` |
| Phase-TYPE labels + glyphs (5 + emit) | `PHASE_TYPE_LABEL` — `programmatic⚙ / llm_single✎ / llm_agent🤖 / llm_batch_agents⛓ / llm_human_input☺` + `llm_emit◆`, `UNKNOWN→"Step"` | `PhaseCard.tsx:41-48`; `phase_types.py:9-16` |
| Never-vanishes status strip (`⏱ time · phase · activity`, stable start-ts, freeze on true terminal) | `RunStatusStrip.tsx` (placement variants header/header-bare/floating) | `RunStatusStrip.tsx:42-116`; `RunCard.tsx:121-176,308-320` |
| Single step/phase counter | `lib/stepCount.ts` `unifiedStepCount` (one source feeds header/strip/collapsed-row) | `stepCount.ts:78-82`; `RunCard.tsx:205` |
| ask_user pause (008-D/006-C) | `PendingAskCard` / `PendingAskStack` (pinned top, D-03) + the `_exec_llm_human_input` executor | `WorkspacePanel.tsx:143-146`; `phase_types.py:594-720` |
| In-chat run receipt / live pointer | The shipped 007-C seam — `SeamPointer` (live) + `SeamCard` (reload) used today ONLY for `write_todos`/`workspace_write`/`ask_user` | `MessageItem.tsx:42-47,349-363,568-583` |
| Deep tool rail (when a Deep tool runs in the same thread) | `RunCard` → `ToolCallPanel` status-node rail; `MessageItem` mounts it for any turn with `tool_calls` | `MessageItem.tsx:339-341`; `ToolCallPanel.tsx` `StepRow:373-427` |
| Files/Versions drill-in (005-A winner) | `FilesSection` / `VersionDiff` panel sections | `WorkspacePanel.tsx:170-182` |

### CURRENTLY CONTRADICTS / INVENTS (must be resolved in revision)

| 022 invention | Conflict with shipped reality | Evidence |
|---|---|---|
| **Full 6-phase spine rendered IN the chat transcript** (`.run-frame > ol.tl`) | Shipped app routes the spine to the **panel** (008-D/009-C). 022's episode card *duplicates* the panel's canonical view → third run-frame, dual-surface sync anti-pattern 004 warns against. | `index.html:383-447,657` vs `WorkspacePanel.tsx:187-190`, `PhaseTimeline.tsx:2-3` |
| **Per-phase human `name`** (`Load portfolio`, etc.) | No `name` on `PhaseSpec` (`slug/phase_index/config/validators` only) or on the `Phase` TS type (`slug/phaseIndex/phaseType/status`). Wire carries `slug` only; real PhaseCard renders the bare slug. | `index.html:308-313` vs `harness.py:189-193`, `types/index.ts:402-417`, `PhaseCard.tsx:325` |
| **Per-phase `gate` chip** (`freshness ≤90d`, `cited · structure`) | Gate/validator data is not emitted per-phase to the row; D-03 suppresses per-phase chips. Validators live in `PhaseSpec.validators` server-side, never streamed as a phase-row chip. | `index.html:309-313,392` vs `PhaseTimeline.tsx:24-26` |
| **Per-phase activity summaries** (PH_SUM `31 sources · 9 calls`, `14 agents · scoring…`) | Explicitly suppressed by D-03 — these fire on the *invisible* sub-stream and are NOT shown. This is 022's most reassuring signal and the one the shipped design forbids. | `index.html:343-346,393` vs `PhaseTimeline.tsx:24-26`, `PhaseCard.tsx:9-11` |
| **Variant C dedicated full-screen run view** that HIDES the panel | No such surface exists; 022's own trade-off card admits it "breaks mode of a thread" and "duplicates the run/stream/lock/resume plumbing". Variant A (★) is the winner. | `index.html:202-217,643-647,752-759` |
| **Panel demoted to note + FILES only** | Inverts the shipped panel, which OWNS Todos/Files/Versions/Workflow/Sub-results as a stacked accordion. | `index.html:259-266` vs `WorkspacePanel.tsx:140-208` |
| **No README / Build-Handover (reuse-vs-net-new) section** | Breaks the 095/103 sketch-session convention; rationale lives only in HTML comments → build phase can't inherit an honest contract. | Glob returns only `index.html` |

### ORTHOGONAL / GENUINELY NEW (keep)

- **Composer-during-a-run** (locked-in-thread A / chat-alongside B / dedicated C). The shipped surface hasn't decided this. It does not conflict with the panel and is the legitimately decision-worthy part of 022. Route ONLY this to a fresh design decision.

---

## 3. MEANINGFUL-STEPS FIX

### Diagnosis: this is ~90% RENDER + a real DATA-PERSISTENCE hole, NOT "the meaning doesn't exist"

The authored slugs are already meaningful verbs (`research / summarize / plan / execute / verify / split / review / merge / draft / confirm / finalize / readonly_probe` — `conftest.py:745-822`), and the LIVE `phase_started` + `sub_agent_start` events DO carry the real slug, `phase_type`, and a rich sub-agent task description. Three defects drop or generic-ize that signal:

1. **`phase-0` placeholder clobber (BUG-260609-04, OPEN).** `reconcilePhases` seeds the live skeleton with synthetic `slug: phase-${i}` and `phaseType:"unknown"` for non-current rows (`StreamsProvider.tsx:2738-2741`). `replacePhasesForThread` overwrites the store with that skeleton; if reconcile fires *after* `phase_started` (fresh kickoff / thread-change) it clobbers the real-slug row, and a single-phase run gets no later `phase_started` to repair it → "Step phase-0" sticks while the DB slug is e.g. `readonly_probe`. **Render bug.**

2. **`phase_type` lost on reload → generic "Step".** The durable reconcile shape `WorkflowPhaseState` is `{slug, phase_index, status}` only (`api.ts:1108-1112`), so the terminal reconcile hardcodes `phaseType:"unknown"` for every row (`StreamsProvider.tsx:2763`). On any reload/nav-back, every phase collapses to the generic `UNKNOWN→"Step"` label (`PhaseCard.tsx:48`) — even though live `phase_started` carried the real type (`harness_engine.py:1128-1133`). **Data-persistence hole** (the one real gap): `phase_type` is never landed durably.

3. **`Sub-task` degradation (BUG-260609-02).** Live, each `llm_agent` phase runs as a task sub-agent with a meaningful description (`Phase: research\n\n<question>` / `Overall topic: …\n\nSub-question: …`, `phase_types.py:471-472,547-549`) streamed via `sub_agent_start`. But `tasksByThread` isn't reconciled from a durable source, so `BatchResultList.cleanDescription()` falls back to the literal `"Sub-task"` on nav (`BatchResultList.tsx:40-41`). Live = rich, post-nav = bare. **Render/persistence.**

**Plus a design ceiling (D-03):** even when everything renders, the slug is a one-word machine ID and per-phase tool/search/source activity is *intentionally suppressed*. So `research — running` is today's ceiling of meaning — the operator can't see WHICH folder was searched, WHICH file is being filled, or WHAT the sub-agent was told, even though `tool_call` args and `sub_agent_start.description` carry exactly that on the wire.

**Why the operator "feels" it as generic:** the bare-slug ceiling + the three render defects bleed through an otherwise-correct surface. (Separately, the duplicate-empty-avatar + timer-reset glitch the operator also saw on runs is pre-existing render-only **BUG-260610-01** — NOT a phase-label defect; keep it a separate workstream, seed the timer from the run row's `started_at`.)

### Design: what a MEANINGFUL phase/step shows (simple AND comprehensive)

Honor calm + 3-second-read (primary line readable at a glance) while making depth available on demand. Each phase row carries up to four honest layers, sourced from REAL fields:

```
[node]  Phase 2 of 6 · AI agent step                         ← ordinal + type (exists today: position + PHASE_TYPE_LABEL)
        Gather evidence from the vendor KB                    ← AUTHORED TITLE  (NET-NEW wire field: phase.name)
        Searching "Risk" for "Q3 breach thresholds"          ← LIVE ACTIVITY   (RUNNING phase only; from tool_call args)
        ↳ freshness ≤ 90d                                     ← GATE chip       (from PhaseSpec.validators, when present)
```

Layer-by-layer contract:

- **Identity line (primary, always):** the **authored phase title** (`name`), NOT the slug. "Gather evidence from the vendor KB" instead of `research`. Demote the slug to secondary/monospace for power users. — *requires NET-NEW `name` on `PhaseSpec` → `workflow_phases` → `WorkflowPhaseState` → `Phase` TS type; emitted on `phase_started`.*
- **Type + ordinal (always):** `Phase i of N · {PHASE_TYPE_LABEL}` — already exists and survives reload **once** `phase_type` is persisted (fix #2).
- **Live activity verb+object (RUNNING phase only):** a single honest line sourced from the live stream — `Searching <folder> for "<query>"` (search_documents args) / `Filling <template>.docx` (workspace_write target) / `<N> agents scoring vendors` (batch fan-out tally). For an `llm_agent` phase, surface the **sub-agent task** (`sub_agent_start.description`); for `llm_human_input`, "Waiting for your answer". This is the single biggest jump in "I can tell what it's doing" and the data is already on the wire — it just needs to be un-suppressed for the ACTIVE phase only, within D-03's honesty bar (no fabricated counts on idle/finished phases).
- **Gate chip (when the phase has a validator):** render `PhaseSpec.validators` as a small chip (`freshness ≤90d`, `cited · structure`). Honest because it's an authored constraint, not a fabricated count.
- **Resting state (finished/queued):** primary title + status atom only. No PH_SUM-style invented counts. Run-level end-of-run sources stay (already allowed by D-03).

**Simplicity guard:** default row = title + type + status (one calm line, 3-sec read). Activity line appears ONLY on the running phase; gate chip ONLY when a validator exists; sub-agent depth lives in the Sub-results section (don't inline a fan-out into the spine). This keeps the resting timeline calm and reserves density for the live moment — the opposite of 022's "every phase shows a count" density that fights the calm bar.

**Authoring guarantee (Phase 103):** the NL builder / publish gauntlet must REQUIRE every phase to carry a human `name` + one-line intent and REJECT terse auto-IDs (`p0`/`p1` — provably derivable per `test_harness_reachability.py:134`). Meaning is authored IN, not reverse-engineered from a slug at render time. Define the per-phase "activity contract" (what verb+object each phase type surfaces live) as a 103 acceptance bar. G-2 sketch already fires for 103 — fold these label contracts into that sketch's acceptance criteria.

---

## 4. 022 REVISION PLAN

1. **Move the spine to the panel; make the chat a thin bracket.** Revise `runEpisode()` so the in-chat `.run-frame` is a *compact* run receipt/live-pointer (mode badge + the 015-C status strip + the deliverable receipt), NOT a 6-row timeline. The full `ol.tl` spine renders in the panel column (which must stay VISIBLE — never hidden as variant C does), mirroring `WorkspacePanel`'s "Workflow" section. This honors the shipped 009-C "live-status → resolves" seam and kills the third-run-frame duplication.
2. **Stop faking meaning — show the real data gap, then design the fix on top.** Either (a) render what the app shows TODAY (bare slug + generic type label) so the sketch becomes the brief that *exposes* the defect, OR (b) keep the rich phase rows but annotate every fabricated field (`name`, `gate`, PH_SUM) as **NET-NEW WIRE SURFACE** in the sketch, with a callout naming the backend change each one requires (see §3). No silent assumptions of data the app doesn't emit.
3. **Resolve the per-phase activity question explicitly.** Drop PH_SUM counts (D-03 suppresses them), OR make 022 the deliberate proposal to un-suppress a *curated, honest, RUNNING-phase-only* activity line (verb+object from live tool args / sub-agent description). Flag exactly which signals are real-now vs. require un-suppression.
4. **Down-rank variant C to an explicitly-rejected exploration.** Keep it labeled as the losing branch (it hides the panel + duplicates plumbing, by its own trade-off card). The revised winner is "in-thread episode + panel-owns-the-spine".
5. **Promote the composer exploration to the sketch's real thesis.** Variant A (locked-in-thread) vs B (chat-alongside) is the genuinely-new, decision-worthy question — center the sketch on it, since the panel-vs-chat-placement and slug-meaningfulness items route to a phase/bug fix, not a fresh design call.
6. **Add a README with a Build-Handover (reuse-vs-net-new) map.** Match the 095/103 convention: map each 022 element to its real component (`RunStatusStrip`, `PhaseTimeline`, `PhaseCard`, `PendingAskCard`, `RunCard`/`ToolCallPanel`, `ChatLayout` grid) and flag the net-new bits (the `phase.name` wire field, any un-suppressed activity line) so the build phase inherits an honest contract.
7. **Re-validate against the calm + 3-sec-read bar after the seam fix:** chat run-frame reads in ~3s (name + status strip + deliverable); panel carries depth-on-demand (008-D accordion). Confirm the inline density is gone.

**Routing note (do these as wire/bug fixes, NOT inside the sketch):**
- Close **BUG-260609-04** — use real `wf.phases` slugs for the LIVE skeleton (not just terminal), and refuse to overwrite a real slug with `phase-${i}` (`StreamsProvider.tsx:2737-2741,2304-2322`).
- Add durable `phase_type` (+ the new `name`) to `workflow_phases` / `WorkflowPhaseState` (`api.ts:1108-1112`) and stop hardcoding `phaseType:"unknown"` in `reconcilePhases` (`StreamsProvider.tsx:2760-2767`).
- Reconcile `tasksByThread` from a durable source so the sub-agent description/summary survives nav (BUG-260609-02; `BatchResultList.tsx:40-41`).
- Keep **BUG-260610-01** (dup-avatar/timer-reset) a SEPARATE render-only workstream — do not conflate with the label fix.

---

## 5. OPEN QUESTIONS FOR THE OPERATOR

1. **Spine placement — is the panel the single home for the live phase timeline (shipped 009-C), and the chat gets only a thin receipt/pointer?** Or do you intend Phase 103 to deliberately MOVE the spine into the chat (a migration, not an addition)? Building 022 as drawn requires answering this — the app cannot have both without re-creating the dual-surface bounce 004 warns against.
2. **Is `phase.name` approved as a new wire field?** Adding an authored human title to `PhaseSpec → workflow_phases → WorkflowPhaseState → Phase` is the load-bearing change that makes every "meaningful step" sketch real. Confirm it's in scope (it's a natural Phase 103 NL-authoring output).
3. **D-03 un-suppression — may the RUNNING phase show a single honest activity line (verb + object from live tool args / sub-agent description)?** This is the biggest legibility jump but it relaxes the "SUPPRESS-DON'T-FAKE" decision for the active phase only. Approve, scope, or hold?
4. **Gate chips on phase rows — surface `PhaseSpec.validators` per phase (`freshness ≤90d`, `cited · structure`)?** It's honest authored data, but it adds density to the spine. In or out for v1?
5. **Composer-during-a-run — which variant?** A (locked-in-thread, run owns the composer) vs B (chat-alongside, type a new message while the run streams). This is the genuinely-undecided design call; everything else routes to bug/wire fixes.
6. **Do the three render/persistence bugs (BUG-260609-04, -02, -01) get fixed BEFORE or as PART OF Phase 103?** They're independent of any sketch and would make the *current* surface meaningful without new UI — worth sequencing first so 103 builds on a clean base.
