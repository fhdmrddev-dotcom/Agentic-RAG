---
gsd_state_version: 1.0
milestone: "v3.7"
milestone_name: "Workflow Product Completion"
status: executing
last_updated: 2026-08-11T02:10:00.000Z
last_activity: "2026-08-10 — **v3.7 Workflow Product Completion OPENED** (Phases 192-198, 13 requirements; 191 reserved). Prior: 2026-08-09 — **v3.6 Visual / No-Code Workflow Studio CLOSED and TAGGED.** 13 phases (CORE 181-189 + STRETCH 190 + inserts 184.1/188.1/188.2), 151 plans, 1,064 commits over 18 days, migrations 114-118. Closed on a FRESH audit re-run at HEAD `bdd3e54b` (`41ae2618`) after the on-disk one was found to predate Phases 189 and 190 entirely. **CORE closed 19/21 satisfied with ZERO unsatisfied — every CORE requirement wired in shipped source, confirmed file:line.** The one unsatisfied requirement is STRETCH **CONN-02**: only 1 of 3 connectors is drivable from a workflow, and Slack works by coincidence. STRETCH 191 deferred, never built."
stopped_at: "v3.7 Workflow Product Completion OPENED 2026-08-10 — requirements + roadmap written, no phase started. Nothing is mid-flight. Since the v3.6 close: BUG-260809-02 CLOSED (owed reload+publish UAT row driven against local via Chrome DevTools MCP — publish 200, `blocked_stage: null`); D-klo-DEF-01 closed (the block copy now has one home in `grounding.py` and says what to do); v3.6 phase dirs archived to `.planning/milestones/v3.6-phases/`; the missing v2.9 STRETCH carry-forward guide written (105-108); SEED-147..150 planted. Production is at `7dc53ffa` — the canvas `business_requirement` control and the copy fix are LIVE. 2026-08-10: ROADMAP v3.7 repaired (`2313329c`) — its phase details were bold labels, not `#### Phase NNN:` headings, so every SDK phase op for 192-198 returned `phase_found: false`; all seven now resolve. G-2 fired on 192 and was HONORED, then SATISFIED the same day — sketches 157/158/159 built, operator picked 157-B (one list, shelves become filters) · 158-A (always-on page search; CmdK indexing deferred with a 3-condition trigger) · 159-C (one verb, consequence as real DOM text). G-5 also fired on `WorkflowsPage.tsx` (21 commits / 10 phases / 1407 L; the file was missing from the ledger entirely) and was **HONORED at discuss-phase 192** (`514c8e64`) — no override, no waiver: the seam is split by what survives 192 (`RunModal` + the WFIN-03 delete Sheet verbatim-move with baselines captured FIRST; the three cards rewritten as new code under `components/workflows/library/`, because 188.2 measured a pure extraction grows the subtree +67% and three of the six components are being replaced). 192-CONTEXT.md written — 16 decisions. ⚠ **D-04: 192 is NOT frontend-only** — the `Yours` chip needs an ownership field `PublishedWorkflow` does not carry (`api.ts:1349`), so the phase touches `backend/app/api/workflows.py`, the `list_published_workflows` query and `api.ts`. ⚠ **D-12 CORRECTS the sketch MANIFEST**: `onTweak` and `onUseStarter` are siblings, NOT twins — merging the handlers would break the global `UNIQUE(slug, version)` constraint; they share one WORD, never one FUNCTION. **2026-08-10 (later): Phase 192 PLANNED — 12 plans / 8 waves (`8090971f`), checker fixes `1d077bbb`; RESEARCH `7d73a53e`, VALIDATION+D-17/D-18 `6bf1b4ab`, PATTERNS `c172c403`.** Plan-checker: **0 blockers, 2 warnings, both closed surgically.** Research corrected SIX CONTEXT.md line numbers at `HEAD = a0795512` (notably the starter-fork `title=` cited as `:155`, which is actually a race-guard `useRef` — the real site is `:1044`), and found that **the vitest count gate covers NEITHER this phase's own test file NOR the three `src/pages/__tests__/` suites — 74 of 123 covering tests invisible, the EIGHTH two-knob occurrence**; `192-01` is therefore commit 1. Two operator decisions added at plan time: **D-17** (project filter holds starters out and SAYS so — silence is a UAT fail) and **D-18** (draft Delete ships as WIRING: `delete_draft` + `deleteWorkflowDraft` already exist and are tested with zero UI callers; never the cascade path). **2026-08-10 (later still): Phase 192 EXECUTING — wave 1 of 8 merged at `5178100e`, 2 of 12 plans complete (`192-01` count-gate adoption + `192-02` D-04 ownership). Post-merge gate green: tsc 33 unmoved, count gate exit 0, backend ownership suite 17/17.** **Wave 2 merged `3d1a9567` — 5 of 12 plans done.** NEXT = wave 3 (`192-06` ∥ `192-07`)."
resume_file: ".planning/phases/192-workflow-library-ia/192-06-PLAN.md"
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
**Phase:** 192 Workflow Library IA — **EXECUTING: 5 of 12 plans complete, waves 1-2 of 8 merged**
**Plan:** waves 1-2 done (`192-01`∥`192-02`; `192-03`∥`192-04`∥`192-05`); wave 3 next (`192-06` ∥ `192-07`)
**Status:** In progress
**Next action:** continue `/gsd:execute-phase 192` at **wave 3**. Downstream MUST read `192-CONTEXT.md` (**18** decisions) and `192-RESEARCH.md`, which **corrects six CONTEXT.md line numbers** measured at `HEAD = a0795512` — re-derive every line number, HEAD has moved.
**Last activity:** 2026-08-10 — **Phase 192 wave 1 executed and merged** (`5178100e`). `192-01`: five `WorkflowsPage`-covering suites adopted into BOTH count-gate knobs (pinned files 51 → 56, pinned total 2838 → 2910), zero source changed. `192-02`: D-04 ownership — `is_mine` + `is_system_global` computed server-side on `/published` and `/starters`, raw `created_by` fenced off the wire. Post-merge gate green: `tsc -p tsconfig.app.json` unmoved at **33**, count gate exit 0 / `failed 0`, new backend suite 17/17.

### Wave 1 — three measured findings not to re-derive

1. **Claude Code's worktree isolation did NOT fork from the orchestrator's HEAD.** `192-02`'s
   worktree came up at `fda79214` (a `master` merge commit), not the dispatched base `17c30d4f`.
   The prompt's `git merge-base` assertion caught it and `reset --hard`-ed to the correct base;
   both branches merged from `17c30d4f` cleanly. **Keep the base assertion in every executor
   prompt — it is load-bearing here, not ceremony.**
2. **The count-gate marker was stale by 63 at HEAD** — it read `2775 (190-15)` while the reduce
   computed **2838** on an unmodified tree. Ninth staleness event; corrected in place. Two NEW
   drifted pins were found and deliberately left alone (`WorkflowBuilderPage.canvas.test.tsx` +5,
   `builderStore.test.ts` +6), joining the two owed since 190-12 (`ExternalActionSection` +9,
   `PhaseTimeline` +4) — **24 cases are deletable with the gate green today**, all outside 192's
   blast radius. Re-pinning them inside 192 would fold unrelated drift into a commit that did not
   cause it.
3. **One degradation claim in `192-02` was measured FALSE and scoped rather than shipped.** A
   malformed caller id does NOT yield `is_mine=False` on `/published`; it raises, because a
   **pre-existing** `UUID(user_id)` coercion at `workflows.py:252` fires first. The claim is true
   of the helper and of `/starters` only. The shipped coercion was left alone (out of scope) and
   the measurement recorded in the test docstring, so no later reader concludes 192 either
   introduced or removed a 500 path.

### Wave 2 — what it measured (merged `3d1a9567`)

`192-03` RunModal baseline (8 captured strings + 6 focus/dialog assertions, two dumps byte-identical
at 20,065 B) · `192-04` delete-Sheet baseline (7 states + both graded-guard invariants, three RED
plants each reddening only their own cases) · `192-05` the four library leaves + four subtree fences.
Post-merge: count gate exit 0 / `failed 0` / total 2910 → 3060 all-growth, `tsc` 33, eslint clean.

1. **The wrong-base bug is SYSTEMATIC, not incidental — 3 of 3 wave-2 worktrees hit it**, plus
   `192-02` in wave 1. Every one came up at `fda79214` (a `master` merge commit) instead of the
   dispatched base. Claude Code's `isolation="worktree"` does not fork from the orchestrator's HEAD
   here. The `git merge-base` assertion in the executor prompt is the only thing catching it —
   **keep it in every prompt**; a baseline captured on the wrong base proves nothing.
2. **`GSD_VITEST_MAX_WORKERS=4` is calibrated for TWO concurrent runs, not three.** At three agents
   `192-05` measured the count gate non-deterministic on ONE commit: `failed 6 → 0 → 1 → 3`. The
   failures were read from the gate's own JSON (session suite, canvas suite, two `WorkflowCanvas`
   axe assertions) — **none under `library/`**, and one run was `failed 0` with all code present.
   Re-run serially by the orchestrator it was green first try. **Amends CLAUDE.md's parallel-run
   rule: the cap holds at 2 concurrent vitest runs; at 3 it is still oversubscribed on 16 cores.**
3. **F1 (192-03): the mid-launch Escape guard is DOUBLE and the baseline can only see the outer
   half.** Deleting the modal's own `if (!submitting)` left the assertion GREEN — the page's
   `onCancel` still refuses; only deleting both reddens. D-01 moves the modal and LEAVES `onCancel`
   on the page, so nothing in the baseline would catch `192-06` dropping the inner guard. Closing it
   requires testing `RunModal` in isolation, which is only possible once it has its own module.
4. **RESEARCH's "≈169 L" delete-Sheet extent was 165 by its own span list** (192-04). The missing 4
   are the `onDeleted` prop + docblock — the re-fetch seam the no-optimistic-vanish invariant runs
   through, which cannot stay behind. Spans, not a number, are recorded in the test.
5. **Three plan-text corrections from 192-05, each of which would have cost a downstream plan:**
   the plan's `soulDeliverable` paraphrase is wrong (the real `chat` variant has **no `label`** —
   code written against it does not compile); `UNBOUND` could not be "reused" (module-private in
   `WorkflowsPage.tsx:67`, and fence F4 forbids the subtree importing the page) so it is re-homed in
   `libraryFilter.ts` at an identical value — **two identical declarations exist until 192-10
   deletes the page's copy**; and F1 must be parsed, not grepped, or the file documenting the rule
   trips it.

**Owed to `192-12`** (the pinning sweep): `RunModal.test.tsx` 11 → **27**, `RunModal.a11y.test.tsx`
8 → **16**, `PublishedCardDelete.test.tsx` 7 → **26**, plus first pins for `libraryFilter.test.ts`
(36) and `librarySubtree.fences.test.ts` (47), plus RED plants for the four subtree modules.
⚠ **If `192-06` moves tests into a new `library/RunModal.test.tsx`, the old files' counts DECREASE —
the one thing this gate fails on. 192-06 and 192-12 must settle those pins together.**
⚠ **F1 will fire on the moved code in 192-06/07** — `RunModal` and the delete Sheet carry `title=`
today. That is D-14 working; the `aria-describedby` conversion belongs with the move.

**Owed to a later plan** (raised by `192-02`, from RESEARCH): an integration assertion that
`is_mine === (provenance !== "starter")` over the merged list — the cross-check that makes feed
provenance and the new server bit agree. `192-10` or `192-11` is its home. And `?scope=mine` must
stay: D-16's dedupe-free property depends on it.

### Phase 192 planning — the four things a later reader should not have to re-derive

1. **The count gate does not cover this phase's own file.** `WorkflowsPage.test.tsx` and the three
   `src/pages/__tests__/` suites are in **neither `TARGETS` nor `BASELINE`** of
   `scripts/vitest-count-gate.cjs` — **74 of the 123 covering tests are invisible to it**, so a
   deleted `it()` during the restructure leaves it green. **Eighth recorded occurrence of the
   two-knob trap.** `192-01` is therefore commit 1 of the phase, before any source change.
2. **`/drafts` IS feature-gated; `/published` and `/starters` are the documented RUN CARVE-OUT and
   are not** (`workflows.py:171`). A naive `Promise.all` on the merged fetch re-introduces the gate
   client-side and **empties the entire library** for any user without the authoring capability. The
   merge uses `allSettled`, and dedupes by **`id`, never `slug`** (`onTweak` deliberately mints a
   same-slug row).
3. **D-04 does NOT block D-12 — the waves genuinely parallelize.** Provenance is already available
   three ways (feed origin, `definition.category`, and after D-04 `is_system_global`). This is the
   dependency everyone assumes exists; it is not encoded, on purpose.
4. **Four testids must survive the card rewrite verbatim** — `published-run` (`:864`),
   `published-tweak` (`:855`), `use-starter` (`:1042`) and **`draft-open` (`:722`)**. 22 references
   across five suites; three of those suites are pinned by `192-01` in wave 1, so a renamed id lands
   as a **gate red**. `draft-open` reaches `WorkflowBuilderPage.header.test.tsx`, which asserts its
   band by **byte-exact `innerHTML`** at a pinned 32. `draft-publish` is the one id that dies (D-10).

**Two decisions the operator made at plan time**, both on measured findings rather than taste:

- **D-17** — the project filter **holds starters out and says so** in the toolbar. `?project_folder_id=`
  narrows only `/published` (`db/workflows.py:291–293`) and mig 094 seeds starters with no project at
  all. Under three shelves that read as scoping; under one flat list it reads as a broken filter.
  **Silence is a FAIL** (UAT row U6).
- **D-18** — draft `Delete` **ships as wiring, not new capability**: `delete_draft` (204) and
  `deleteWorkflowDraft` (`api.ts:3525`) already exist and are tested, with **zero UI callers**.
  Never the cascade path — that resolves a *slug* and destroys every version under it.

### Guardrail activity

| Date | Rule | Phase | Outcome |
|---|---|---|---|
| 2026-08-10 | **G-2** (sketch before discuss/spec on visual scope) | 192 | **HONORED → SATISFIED same day.** `/gsd:discuss-phase 192` was requested; the ROADMAP itself flags 192 *G-2 fires (visual)*, and SEED-136 re-open trigger #3 independently says *"do the IA question FIRST, do not restyle underneath it."* No existing sketch covered this IA — sketch 021 (Phase 103) designed the very card-grid + project rail that SEED-136 now calls unbrowsable. Routed to `/gsd:sketch 192` → sketches **157/158/159** built and driven; operator picked **157-B · 158-A · 159-C** (2026-08-10). The approved mockup is now the acceptance bar. **Not an override — no waiver recorded.** |
| 2026-08-10 | **G-5** (refactor between feature waves) | 192 | **FIRED → HONORED at discuss-phase** (`514c8e64`). **Not an override — no waiver recorded.** The refactor question was asked FIRST, before the feature, per the orchestrator protocol. Answer: **split the seam by what survives 192**, rather than a uniform 188.2-style verbatim cut. `RunModal` (`:1054–1407`) and the WFIN-03 delete Sheet (`:872–1003`, currently trapped inside `PublishedCard`) survive unchanged → **verbatim move with the characterization baseline captured BEFORE the move** (the 188.1 rule: a baseline only proves something if it PREDATES the change). `DraftCard`/`PublishedCard`/`StarterCard` are **replaced** by 159-C's single card → rewritten as new code under `components/workflows/library/` (which does not exist today), never extracted-then-rewritten, because 188.2 measured that a pure extraction grows the subtree **+67 %** and paying that on code the phase deletes is waste. Target end state: the page is composition — the 188.2 shape, without the 188.2 tax. *Original firing evidence retained below.* |
| 2026-08-10 | **UI-SPEC gate** (workflow gate, not a G-rule) | 192 | **SKIPPED BY OPERATOR DECISION — audited, not silent.** `/gsd:plan-phase` detected frontend indicators and no `192-UI-SPEC.md`, whose default is to stop and route to `/gsd:ui-phase 192`. Skipped because the design contract already exists in a stronger form: **G-2 was satisfied the same day** (sketches 157/158/159 driven, operator picked 157-B · 158-A · 159-C) and CONTEXT.md fixes the frame (D-02/03/05), search scope (D-06/07/08), verb table (D-09/10/12) and a11y mechanism (D-14) at higher fidelity than a generated UI-SPEC would. Recorded so a later reviewer does not read the absent artifact as an oversight. |
| 2026-08-10 | **G-7** (gap-closure round cap) | 192 | **NOT APPLICABLE** — first planning pass, no `--gaps`. Recorded so the absence of a check is distinguishable from a skipped one. |
| 2026-08-10 | **G-5** — original firing evidence | 192 | **FIRES.** Measured during the sketch: `frontend/src/pages/WorkflowsPage.tsx` = **21 commits across 10 phases** (103/124/143/152/155/165/184/184.1/186/188), **1407 lines** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, so ten phases touched it without the guardrail ever firing, because the audit step scans against that table and a file missing from it is invisible to its own guardrail. Ledger row added 2026-08-10 (`d0c76525`). 157-B is a structural rewrite of this file's library view (not a 185-style mount point), so **`/gsd:discuss-phase 192` MUST produce a refactor recommendation as its FIRST option.** Named seam: three card components → `components/workflows/library/`; `RunModal` + the WFIN-03 delete Sheet → their own modules; page becomes composition (the 188.2 shape). |

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
