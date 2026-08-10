---
gsd_state_version: 1.0
milestone: "v3.7"
milestone_name: "Workflow Product Completion"
status: planning
last_updated: 2026-08-10T14:30:00.000Z
last_activity: "2026-08-10 — **v3.7 Workflow Product Completion OPENED** (Phases 192-198, 13 requirements; 191 reserved). Prior: 2026-08-09 — **v3.6 Visual / No-Code Workflow Studio CLOSED and TAGGED.** 13 phases (CORE 181-189 + STRETCH 190 + inserts 184.1/188.1/188.2), 151 plans, 1,064 commits over 18 days, migrations 114-118. Closed on a FRESH audit re-run at HEAD `bdd3e54b` (`41ae2618`) after the on-disk one was found to predate Phases 189 and 190 entirely. **CORE closed 19/21 satisfied with ZERO unsatisfied — every CORE requirement wired in shipped source, confirmed file:line.** The one unsatisfied requirement is STRETCH **CONN-02**: only 1 of 3 connectors is drivable from a workflow, and Slack works by coincidence. STRETCH 191 deferred, never built."
stopped_at: "v3.7 Workflow Product Completion OPENED 2026-08-10 — requirements + roadmap written, no phase started. Nothing is mid-flight. Since the v3.6 close: BUG-260809-02 CLOSED (owed reload+publish UAT row driven against local via Chrome DevTools MCP — publish 200, `blocked_stage: null`); D-klo-DEF-01 closed (the block copy now has one home in `grounding.py` and says what to do); v3.6 phase dirs archived to `.planning/milestones/v3.6-phases/`; the missing v2.9 STRETCH carry-forward guide written (105-108); SEED-147..150 planted. Production is at `7dc53ffa` — the canvas `business_requirement` control and the copy fix are LIVE. 2026-08-10: ROADMAP v3.7 repaired (`2313329c`) — its phase details were bold labels, not `#### Phase NNN:` headings, so every SDK phase op for 192-198 returned `phase_found: false`; all seven now resolve. G-2 fired on 192 and was HONORED, then SATISFIED the same day — sketches 157/158/159 built, operator picked 157-B (one list, shelves become filters) · 158-A (always-on page search; CmdK indexing deferred with a 3-condition trigger) · 159-C (one verb, consequence as real DOM text). G-5 also fires on `WorkflowsPage.tsx` (21 commits / 10 phases / 1407 L; the file was missing from the ledger entirely) and is OWED at discuss-phase. NEXT = `/gsd:discuss-phase 192`, opening with the G-5 refactor question."
resume_file: null
---

# Project State

> ⚠ **This file was RESET at the v3.6 close (2026-08-09).** The previous STATE.md had ballooned to
> **562 KB** and its YAML frontmatter was corrupted — unquoted multi-line strings had been parsed
> as top-level keys (`recorded:`, `carrying:`, `change:`, `measured:`, `inherited:`, `verbatim:` …),
> which is exactly the damage the GSD SDK `state.*` verbs did five times during Phase 190 alone
> while reporting success. **Nothing was deleted:** the full 562 KB file is archived verbatim at
> `.planning/milestones/v3.6-STATE-at-close.md`, including every Decisions entry, Performance
> Metrics table and Roadmap-shape block back to v2.9.
>
> **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-09)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** *No milestone active.* Planning the next one.

## Current Position

**Milestone:** v3.7 Workflow Product Completion — **opened 2026-08-10**
**Phase:** Not started (requirements + roadmap written)
**Plan:** —
**Status:** Planning
**Next action:** `/gsd:discuss-phase 192` — **G-2 SATISFIED** (sketches 157/158/159 built, winners picked by the operator 2026-08-10). ⚠ **Open discuss-phase with the G-5 refactor question on `WorkflowsPage.tsx`, not with the feature.**
**Last activity:** 2026-08-10 — v3.7 opened; v3.6 phases archived; SEED-147..150 planted; v2.9 STRETCH carry-forward guide written; **ROADMAP v3.7 repaired** (`2313329c`) so the SDK can resolve 192-198

### Guardrail activity

| Date | Rule | Phase | Outcome |
|---|---|---|---|
| 2026-08-10 | **G-2** (sketch before discuss/spec on visual scope) | 192 | **HONORED → SATISFIED same day.** `/gsd:discuss-phase 192` was requested; the ROADMAP itself flags 192 *G-2 fires (visual)*, and SEED-136 re-open trigger #3 independently says *"do the IA question FIRST, do not restyle underneath it."* No existing sketch covered this IA — sketch 021 (Phase 103) designed the very card-grid + project rail that SEED-136 now calls unbrowsable. Routed to `/gsd:sketch 192` → sketches **157/158/159** built and driven; operator picked **157-B · 158-A · 159-C** (2026-08-10). The approved mockup is now the acceptance bar. **Not an override — no waiver recorded.** |
| 2026-08-10 | **G-5** (refactor between feature waves) | 192 | **FIRES — OWED AT DISCUSS-PHASE, not yet honored.** Measured during the sketch: `frontend/src/pages/WorkflowsPage.tsx` = **21 commits across 10 phases** (103/124/143/152/155/165/184/184.1/186/188), **1407 lines** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, so ten phases touched it without the guardrail ever firing, because the audit step scans against that table and a file missing from it is invisible to its own guardrail. Ledger row added 2026-08-10 (`d0c76525`). 157-B is a structural rewrite of this file's library view (not a 185-style mount point), so **`/gsd:discuss-phase 192` MUST produce a refactor recommendation as its FIRST option.** Named seam: three card components → `components/workflows/library/`; `RunModal` + the WFIN-03 delete Sheet → their own modules; page becomes composition (the 188.2 shape). |

> Phase numbering continues from 190 and **starts at 192** — **191 is reserved** for the deferred
> canvas-scale phase (`.planning/v3.6-STRETCH-CARRYFORWARD.md`). Do not reuse it.

---

<details>
<summary>Previous milestone — v3.6, shipped 2026-08-09</summary>

**v3.6 Visual / No-Code Workflow Studio — ✅ SHIPPED 2026-08-09, git tag `v3.6`.**

| | |
|---|---|
| Phases | 13 (CORE 181-189 + STRETCH 190 + inserts 184.1 / 188.1 / 188.2) |
| Plans | **151** (150 summaries — `184-14` has none) |
| Commits | 1,064 over 18 days (`7c85f9ec` 2026-07-23 → `bdd3e54b` 2026-08-09) |
| Migrations | 114, 115, 116, 117, 118 |
| Requirements | **20/24 satisfied · 2 partial · 1 unsatisfied · 1 deferred** — CORE **19/21 with zero unsatisfied** |
| Security | **zero debt** — 9/9 threat-modelled phases at `threats_open: 0` |
| Archives | `milestones/v3.6-ROADMAP.md` · `-REQUIREMENTS.md` · `-MILESTONE-AUDIT.md` · `-MILESTONE-AUDIT-midflight-260806.md` · `-STATE-at-close.md` |

**What shipped:** a drag-and-drop visual authoring + non-technical live-run-observability layer over
the existing governed harness engine. **The differentiator is graded per-node governance** — strict
when KB-grounded, flexible when open, enforced at RUN time so it is not author-loosenable-away; the
Beam / Glean / n8n deep crawl found none of them grade strictness by grounding. **The D-14 red line
held across all 13 phases: 7 harness executors at close, exactly as at open.**

</details>

## ⚠ Open at close — read before starting anything

**1. CONN-02 — the one unsatisfied requirement, and the reason the audit reads `gaps_found`.**
A real Slack message DOES send through the full governed path (approval gate → six ordered guards →
send → `external_action_sent` audit receipt, `6379787c`). But `_adapter_args`
(`phase_types.py:1985-2005`) fills exactly one field, the capability's `body_arg`. Slack requires
only `["text"]`, which IS that arg — **so Slack works by coincidence**. Jira requires `summary`
(`jira_adapter.py:422`) and SMTP requires `to`/`subject` (`smtp_adapter.py:296`), and none of those
has an author-facing field in `ExternalActionPhaseConfig` (`harness.py:242`). Both raise at
`phase_types.py:2318-2332`, are caught, and report `failed`. **`D-190-DEF-17` — a phase, not a
patch** → connections milestone.

**2. ⚠ CLOUD PARITY IS SECURITY-BEARING. This is the loudest operational item in the repo.**
Migrations **104 → 118** are owed at the next production push, and **118 closes a real credential
exposure** (both `anon` and `authenticated` held column-level SELECT on
`connector_connections.secret_ciphertext`). **Until 118 is applied, cloud still has that defect.**
Migration 118 and the `connector_service.py` deploy **must land in the same operation** — the grant
without the code breaks every connector read with `42501`; the code without the grant leaves the
hole open. Re-derive with `bash scripts/pending-cloud-migrations.sh`; never quote a prose number.

**3. Verification debt — nine requirements ride on three missing `VERIFICATION.md` files.**
Phase 184 (CANVAS-02/03/04 + VALID-02/03), Phase 188 (RUNVIZ-01/02/03), Phase 189 (**CONN-01**, the
CORE half of operator HARD gate #3). All nine are wired in shipped source and carry passing UAT.
**Documentation debt, not engineering debt** — the cheapest outstanding item in the project.
⚠ Phase 184 carries a standing instruction **not** to route to `/gsd:verify-work 184`; close it by
retroactive documentation from the existing UAT results.

**4. Two records that asserted more than happened.** SEED-133's binding re-open trigger — *"Phase
189's discuss-phase MUST surface this row"* — **fired and was not honoured, for the second
consecutive phase** (it also missed at 187). And seven Phase-190 summaries mark CONN-02/CONN-03
complete against that phase's own `D-190-DEF-02` convention; for CONN-02 that claim is measurably
false.

**5. Accepted risks, both still `open`:** SEED-133 (NL generation ignores `bundle.degraded` → a
folder-blind draft presented as `ok:true` during a registry outage) · SEED-134 (the two flag-gated
single-segment `/workflows/<x>` paths are the only ones answering 404 — an enumeration oracle).

**6. Nyquist:** 4 phases at `nyquist_compliant: false` — 181, 182, 183, 184. Phase 188.1 showed such
a file can often be closed by measurement alone, without generating a single test.

**7. G-5 hot files firing:** `backend/app/services/harness/phase_types.py` (35 commits / 14 phases /
1918 L — **the CONN-02 fix will touch it**), `backend/app/api/threads.py`,
`backend/app/services/anthropic_service.py`. `PhaseNodeCard.tsx` was PAID DOWN by Phase 188.2
(797 → 274 L).

## Next milestone — the sequenced slot

**Connections / integrations.** Not a fresh idea — a debt with four converging records.
**Read `SEED-146` first (the umbrella).** Inputs: `SEED-144` (connections should be
**provider-shaped**, not action-shaped) · `SEED-145` (connections are **platform assets usable in
CHAT**, not workflow-only assets) · `SEED-142` (two-way — read / pull / auto-ingest, which would
amend CLAUDE.md's manual-upload-only rule) · `D-190-DEF-17` (the concrete unfinished edge).

⚠ **Two standing warnings recorded with those seeds:** **every capability shipped so far is a
WRITE — no read / search / list exists at all**, and **no outbound capability may be added to
`_TOOL_REGISTRY` before the approval model exists.** Sequence with SEED-142 or Google gets connected
twice.

Also unclaimed: v3.4 STRETCH 169-173 · v3.5 STRETCH 178-180 (**180 agent-loop honesty = priority
revive**) · 11 dormant seeds.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-08-09. **46 total.** None belongs to
v3.6 — the 25 quick tasks are legacy stubs (all `status: missing`, dating from 2026-03 onward) and
the 11 seeds are intentionally dormant.

| Category | Item | Status |
|---|---|---|
| quick_task | 260322-26g-improve-tool-call-display-for-ls-tree-gr | missing |
| quick_task | 260328-v6n-investigate-and-plan-fixes-for-duplicate | missing |
| quick_task | 260328-wqj-fix-folder-scoped-chat-returning-results | missing |
| quick_task | 260328-x6n-fix-bug-folder-not-created-when-pressing | missing |
| quick_task | 260404-vel-fix-streaming-cursor-bug-and-add-meaning | missing |
| quick_task | 260405-rgy-fix-folder-public-visibility-files-and-s | missing |
| quick_task | 260405-s1e-hide-toggle-global-from-non-owners-and-b | missing |
| quick_task | 260405-stg-add-chat-references-cascade-deletions-an | missing |
| quick_task | 260407-vqw-review-and-fix-context-window-management | missing |
| quick_task | 260411-wj5-fix-skill-file-upload-bug-files-not-save | missing |
| quick_task | 260412-dqu-fix-four-issues-in-backend-app-api-skill | missing |
| quick_task | 260412-jnc-import-skill-return-202-backgroundtask-f | missing |
| quick_task | 260522-gdg-google-15-iter-loop-diagnostic | missing |
| quick_task | 260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t | missing |
| quick_task | 260529-1wb-fix-bug-260529-01-write-todos-crashes-on | missing |
| quick_task | 260530-wjp-infer-native-tools-for-deepseek-moonshot | missing |
| quick_task | 260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th | missing |
| quick_task | 260531-00x-add-reportlab-to-sandbox-image-pdf-writi | missing |
| quick_task | 260611-irx-worker-log-rotation-pid | missing |
| quick_task | 260630-226-chat-tool-card-live-state-de-duplication | missing |
| quick_task | 260705-hz1-fix-seed-102-reverse-the-name-collision- | missing |
| quick_task | 260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip- | missing |
| quick_task | 260731-3y4-armed-approval-allow-list | missing |
| quick_task | 260807-x9p-bound-steptypepicker-height-to-measured- | missing |
| quick_task | 260808-148-steptypepicker-keyboard-navigation-rovin | missing |
| seed | SEED-003-deployment-flexibility-install-ux | dormant |
| seed | SEED-004-org-multi-tenancy | dormant |
| seed | SEED-040-model-registry-self-service | dormant |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-042-chat-input-modalities | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-045-ui-ux-polish-pass | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-084-starter-workflow-library | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| seed | SEED-128-collapsible-reasoning-run-timeline | dormant |
| todo | spike-nl-workflow-authoring | high — largely satisfied by shipped work |
| uat_gap | 184 — 184-UAT-RESULTS.md | unknown (0 open scenarios) |
| uat_gap | 187 — 187-UAT.md | testing (7 open scenarios) |
| uat_gap | 188 — 188-UAT.md | complete (16 pass / 0 fail / 1 blocked) |
| uat_gap | 188.2 — 188.2-UAT.md | partial — 4 driven / 1 blocked |
| verification_gap | 182 — 182-VERIFICATION-round1.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION-round2.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION.md | gaps_found (⚠ its recorded regression is FIXED at `api/workflows.py:852`; the file is stale) |
| verification_gap | 188.2 — 188.2-VERIFICATION.md | human_needed |
| verification_gap | 190 — 190-VERIFICATION.md | human_needed (⚠ frontmatter says `3/5` + "no SECURITY.md"; its own body addendum says `4/5` and `190-SECURITY.md` exists at `threats_open: 0`) |

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260809-klo | fix BUG-260809-02 — add a `business_requirement` input to the canvas Builder | 2026-08-09 | `da668c96` + `1c58a3fb` | [260809-klo-…](./quick/260809-klo-fix-bug-260809-02-add-a-business-require/) |

⚠ **`BUG-260809-02` is deliberately still `open`.** The unit suite proves the typed sentence reaches
the recorded `updateWorkflowDraft` argument; it cannot prove the live gauntlet accepts it. The plan
gates closure on a live reload + publish row that **was not driven** — no browser automation was
available in the executor session. **Owed manual UAT (run this first):** on the canvas door, type a
requirement, reload, confirm it survived, then Publish and confirm stage 1 "Goal" passes. Local
`feature_visibility.visual_workflow_canvas.audience` is `"everyone"`, so the control is visible.

## Guardrail overrides

None recorded during the v3.6 close. G-7 did not fire — no gap-closure round was opened; CONN-02
was routed to a future milestone precisely because closing it here would have added a user-facing
capability inside a closure round, which G-7 forbids.

## Accumulated Context

Cleared at the v3.6 close — the full decision log lives in `.planning/PROJECT.md` (`## Key
Decisions`) and the pre-close snapshot in `.planning/milestones/v3.6-STATE-at-close.md`. Open
blockers carried forward are the seven items under *Open at close* above.
