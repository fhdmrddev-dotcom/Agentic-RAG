---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: "Ship It & Feel It"
status: roadmapped
last_updated: "2026-09-11T03:30:00.000Z"
last_activity: 2026-09-11
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
  percent: 0
requirements:
  total: 19
  delivered: 0
---

# Project State

> ⚠ **This file was RESET at the v4.0 close (2026-09-10)** — the fourth reset, and the reason is the
> same each time. The previous STATE.md had reached **1,893 lines**. **Nothing was deleted:** the
> full v4.0 file is archived verbatim at `.planning/milestones/v4.0-STATE-at-close.md`, including
> every per-phase position entry, the Phase 240 and 241 debt banners, the *Inherited from v3.9*
> section, the register-integrity sweep, the Deferred Items table and both guardrail overrides.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records
> and corrupted this file five times during Phase 190 alone while reporting success.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-10)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** **v4.1 Ship It & Feel It** — started 2026-09-11, a deliberate CONSOLIDATION
milestone (not v5.0: it opens no new capability axis). Ship v4.0 to production, then fix the chat
surface the operator uses daily. Phase numbering continues at **242**.

## Current Position

Phase: 242 — Ship It (in discussion, separate session) · **243 — The Thinking Block and the Follow-Scroll Seam (IN EXECUTION — 1 / 5 plans done)**
Plan: 243 — 5 plans, 5 serial waves (243-01 … 243-05). **243-01 DONE** (wave 1) → next: 243-02
Status: **243-01 EXECUTED** — the thinking block's pre-extraction net (17 cases, `a17955cc3`) + both gate knobs (`f9bd3ccc7`). Driven RED against two planted defects; `RunCard.tsx` restored md5-identical (`2cac66602c974161bf2fd3725dbd9a6f`). ⚠ **The base's 2 inherited `sketchComposition` failures did NOT reproduce** — both full gate runs read `failed 0`, `count gate OK`, pinned total 7170 → 7187 (+17, this suite alone), 249 → 250 pinned files. That is ONE GREEN SAMPLE of a `SEED-171` flake, not a fix; `243-BASELINE.md` stands and no plan may still use `count gate OK` as a criterion. ⚠ `/gsd:discuss-phase 243` was NOT run — CONTEXT.md is synthesized and says so. **G-2 is DISCHARGED** (sketches 234 V1 / 235 B, operator 2026-09-11).
Progress: 0 / 5 phases · 0 / 19 requirements · `[░░░░░░░░░░] 0%`
Last activity: 2026-09-11 — 243-01 executed (wave 1 of 5): the characterization net exists before anything moves

**Phases:** 242 Ship It · 243 Thinking block + follow-scroll seam (⚠ sketch first) ·
244 Chat shell + composer · 245 The verification debt · 246 The recall cliff.
Full detail: [`ROADMAP.md`](ROADMAP.md).

### ⚠⚠ THE FORCED ORDER WAS RESOLVED BY EVENTS — the original is kept below, never overwritten

This section read, at scoping:

> ⚠ **Order is FORCED at the front of this milestone and cannot be re-sequenced for convenience:**
> `BUG-260910-03` (blocking, Settings→Search unsaveable) → **241 UAT row 5 on CLOUD** → migrations
> `153-156, 166-176` in numeric order → production push. Row 5 proves an arm that becomes
> **unreproducible forever** once migration 176 reaches cloud.

⛔ **Every clause after the first is already spent, measured at HEAD on 2026-09-11 while writing the roadmap:**

- **The production push already landed** — `1f313670b` *"Merge master into production — deploy v4.0 Connected Knowledge"* (2026-09-10), plus `e65610ac2` for the `app.<domain>` routing half. `git log --oneline production..develop` returns **2 commits, both v4.1 planning docs**.
- **Row 5's cloud window is CLOSED, and its loss is already written down.** `241-HUMAN-UAT.md` reads `status: complete`, 6/6 driven; row 5 ran on a **local substitute** and its closing section states the fifteen migrations — 176 included — went to cloud as one batch during the production prep. Retired in writing at `dbd63864b`. **`SHIP-02` is not re-plannable.**
- **The migrations are therefore CLAIMED applied**, by a record rather than by a measurement. Phase 242 runs `scripts/verify-v40-cloud-migrations.sql` **against cloud**.
- **`SHIP-01` is genuinely open** — but only its structural half: `settings.py:466-467`'s bound, `SettingsPage.tsx:888`'s all-or-nothing payload, and the missing CHECK constraint are all still live at HEAD. The `1001 → 1000` data fix landed **locally** and was left in place, so the bug no longer reproduces there. ⚠⚠ **The value cloud holds is UNMEASURED, and cloud is what production serves.**

⭐ **This is the milestone's own method rule paying for itself on day one:** *a register knows only the register below it, and the code is the bottom.* Two sections of this file and four requirement statements were true when written and false within twenty-four hours. **`STATE.md` and `REQUIREMENTS.md` both still say "v4.0 has never deployed" elsewhere; those sentences are stale and are corrected here rather than deleted there.**

⚠ **What STILL stands, unchanged:** `RECALL-01` depends on `SHIP-01` (Phase 246 after Phase 242, and its plans assert the tab saves rather than assuming it) · `CHAT-02` and `CHAT-03` are one mechanism and share Phase 243 · G-2 fires on Phase 243 with the operator-approved mockup as the acceptance bar · `retrieval_service.py`'s extraction, owed since Phase 231, is **proposed first** at Phase 246.

### ⚠ Two phases can be blocked on something that is not engineering

| Phase | Blocked on | Deliverable without it |
|---|---|---|
| **242** | a read-capable **cloud DSN** | SC#2 + SC#3 — the CHECK migration, the changed-fields-only payload, the worded refusal. Sequence these first so the phase is never idle |
| **245** | **one Azure app registration** — ⚠ **run row M-1 first, it unblocks the other 8** | `DEBT-02` and `DEBT-03` in full, plus `DEBT-01`'s retirement arm |

### ⚠ G-8 is the governor on this milestone

Plan targets: **242 → 3-4 · 243 → 4-5 · 244 → 4-5 · 245 → 2-3 · 246 → 3-4.** A phase above **6** must name in CONTEXT.md what genuinely cannot share a worktree. A fix that is ≤ 1 file / ≤ 10 lines with no schema or API surface is **`/gsd:fast` under G-3, never a plan**. The named failure mode is Phase 235's **17 plans for 4-6 plans of substance** — and a consolidation milestone has no natural stopping point.

⚠ **`OV-SOLO-01` was RULED ON at this milestone's scoping (2026-09-11, operator), not left to
lapse.** Solo running continues. The substitute for the independent gate: the dispatched
code-review subagent is **MANDATORY** on any phase touching a trust boundary, and every phase closed
under it reads **"self-verified"** in its own VERIFICATION.md — never "reviewed".

⚠ **`SURF-03` was RULED ON at the same moment** — its home is the **app shell**, landing in the
chat-shell phase. It is no longer an open scoping question.

---

## Carried into v4.1 from the v4.0 close

The nine sections below were written at the v4.0 close. **They are the input to this milestone, not
history** — items 1, 2, 3, 4, 5 and 6 are now scoped into v4.1 phases; items 7, 8 and 9 remain live
constraints on how it is built.

---

## ✅ v4.0 CONNECTED KNOWLEDGE — CLOSED 2026-09-10

**The premise came true.** A source is connected once and then read by itself: Google Drive,
OneDrive/SharePoint via Microsoft Graph, **any** MCP file server, and mail — four families over ONE
`browse / list / read / check` contract, with connection-scoped visibility enforced at all four RLS
sites and a durable queue underneath.

**Record:** [`MILESTONES.md`](MILESTONES.md) · roadmap archive
[`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) · requirements
[`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) · audit
[`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md) · state at close
[`milestones/v4.0-STATE-at-close.md`](milestones/v4.0-STATE-at-close.md).

⚠ **All fourteen phase directories moved to `.planning/milestones/v4.0-phases/` at this close**, so every `NNN-*.md` named below lives there — e.g. `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-UAT.md`. `.planning/phases/` is now empty of v4.0 work. ⚠ One stray remains there: `206-mcp-connector-client-workflow-scoped/206-01-PLAN.md`, an **older draft** of a file already archived complete under `milestones/v3.8-phases/` (it reappeared at `ba59d36b0`, after the v3.8 archive). Left in place rather than deleted — it is not this milestone's to remove.

---

## ⛔ CARRIED PAST THE CLOSE — decisions, not oversights

Each of these was **stated at the close rather than absorbed into it.** A closing milestone that
lists only what passed is not a record.

### 1. ⚠⚠ ONE OWED ITEM HAS AN EXPIRY DATE — read this before any production push

**Phase 241's UAT row 5 must run on CLOUD *before* migration 176 is applied there.** After 176
lands, the "no columns" arm it exists to prove is unreproducible **forever**. Five of 241's six rows
are driven and passed; row 5 is the one that dies. File: `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-HUMAN-UAT.md`.

⚠ It collides with the item directly below: **applying the pending migrations is exactly what kills
it.** Row 5 first, then the migrations — in that order, or not at all.

### 2. ⛔ Cloud is 15 migrations behind

`153, 154, 155, 156, 166..176` are all pending; **v4.0 has not deployed.** Operator decision
2026-09-10: they are applied immediately **before** the next push, not now. Run
`bash scripts/pending-cloud-migrations.sh` and apply the printed set in NUMERIC ORDER, once each,
by pasting into the cloud Supabase SQL editor.

### 3. ⛔ Three phases owe an independent §6.3 review — 238, 240, 241

No independent reviewer exists: Gemini has been unavailable since 2026-09-09 and the operator has
ruled out `/code-review ultra` on cost. **Their verdicts are the builder's own, and the v4.0
milestone audit is a self-audit for the same reason.** What that does not weaken is the mechanical
evidence — a hash, a byte-identical file, a driven function. What it weakens is every judgement call
about whether an owed item was acceptable. ⚠ See `OV-SOLO-01` below: **its re-arm trigger has now
fired and the condition it described is still true.**

### 4. ⛔ Two UAT sets are credential-blocked

| Phase | Rows | Blocked on |
|---|---|---|
| 238 | **9** | one Azure app registration (`MICROSOFT_OAUTH_CLIENT_ID/SECRET`) — **run M-1 first, it unblocks the other 8**; SharePoint rows S-1/S-2 separately on `SEED-256` (no work/school tenant) |
| 241 | **1** (row 5 of 6) | a read-capable cloud DSN — ⚠ **and it expires, see item 1** |

Also owed from earlier in the milestone and never driven: **233's five G-4 rows**, **236's live
SC#1 was driven** (2026-09-06, 8/8 providers — this one is DONE), **237's rule-builder surface was
never manually clicked** (owed by decision).

### 5. ⛔ `QUEUE-06` is not met out of the box

241 measured the defect and shipped the remedy, but **the default is unchanged**: at
`hnsw.ef_search = 40` a tenant owning 0.2% of a 100k-chunk corpus scores `recall@20` **0.040**.
`ef_search = 200` restores **1.000**. ⚠ The degradation is a **cliff, not a slope** — an install can
cross it with **no deploy and no setting change**. `D-v4.0-EF-DEFAULT` records why the default was
left alone; the cost is that the requirement is honestly unticked.

### 6. ⛔ `SURF-03`'s home is an open SCOPING decision, not a build

There is no in-app notification surface in this product. The recommendation is an app-shell signal
**plus** the Health-tab row; **closing it against the Health tab alone does not satisfy it.** This
is a product question for the operator at the next `/gsd:new-milestone`.

### 7. ⚠ `retrieval_service.py`'s G-5 extraction, owed since 231

241 was the deliberate **second** landing (11 non-comment lines, fence driven RED at 13).
**A third landing must propose the extraction FIRST.**

### 8. ⚠ Register debt that the next milestone opens against

| | |
|---|---|
| Planted seeds | **161** of 275 — ⚠ CLAUDE.md's sweep rule says `/gsd:new-milestone` reads every `trigger_when`. **At 161 that sweep is a phase of work, not a step in a command**, and a `trigger_when` nobody reads is a deferral with no re-open, which is a deletion that looks like a decision |
| Open reported bugs (`surface: Agentic-RAG`) | **34** |
| New seeds from 241 | `SEED-265` (connection-by-id / saved-View recall axes were never built) · `SEED-266` (`full-schema.sql` ACL + `row_security`) · `SEED-267` / `SEED-268` (WR-02/03/04/06, and the harness's unproven exact arm) |
| ⚠ `SEED-177` | still reads `status: planted` while its retire-the-egress-fence trigger **already fired** |
| Plans with no SUMMARY.md | `232-04` (landed `1ae6defbb`) and `235-17` (landed `29858f01f`) — in git, absent from the phase record |
| `BUS-171` | the operator-queue triage (23 items `--to operator`) is **parked, not dropped** |
| `SEED-242` | still armed — `app.<domain>` at the next production push |

### 9. ⭐ The method finding worth carrying into the next milestone

**A review is a CLAIM about code, not the code.** Measured three times in one hour by the audit
written to catch it: the audit asked *"is a VERIFICATION file present?"* and never opened the review
that was there; the correction opened the review and escalated its two CRITICALs to *"open, data
loss"* and never opened the code — they had been fixed two days earlier, in an ancestor of the
auditing commit. **Each register only knows the one below it, and the code is the bottom. Drive it,
or do not report it.**

---

## Deferred Items

Acknowledged and deferred at the v4.0 close (`gsd-sdk query audit-open` → **48 open items**). None
is engineering; **the verification debt listed above is the part that matters.** Full item-level
table: `.planning/milestones/v4.0-STATE-at-close.md` is the pre-close snapshot; the live list is
re-derivable at any time with `gsd-sdk query audit-open`.

| Category | Count | Detail |
|---|---|---|
| quick_tasks | **29** | 28 `missing` + 1 `unknown` — historical records whose files no longer exist (was 28 at the v3.9 close; one added) |
| seeds | **14** | all `dormant`: 003, 004, 040, 041, 042, 043, 045, 046, 084, 127, 163, 164, 165, 166 — ⚠ unchanged for two milestones running |
| todos | **1** | `spike-nl-workflow-authoring.md` — largely satisfied by the Phase 097 spike answer |
| uat_gaps | **2** | 233 (`unknown`, 5 rows) · 241 (`partial`, 5/6 driven) |
| verification_gaps | **2** | 239 (`human_needed`, **no code defects** — its 2 CRITICALs and 4 HIGHs are closed and were independently re-driven) · 241 (`human_needed`) |
| debug_sessions / threads / context_questions | **0** | clear |

## Guardrail overrides

Both v4.0 overrides are preserved verbatim in `.planning/milestones/v4.0-STATE-at-close.md` →
*Guardrail overrides*. Record every new override here, per the CLAUDE.md orchestrator protocol.

### ⭐ OV-SOLO-01 — RULED ON 2026-09-11 BY THE OPERATOR. It did NOT lapse.

**Ruling (operator, 2026-09-11, at v4.1 scoping):** **solo running continues.** The substitute for the
independent gate is the **dispatched code-review subagent**, which is **MANDATORY** on any phase
touching a trust boundary. ⛔ **It is NOT an independent gate**, and every phase closed under it must
read **"self-verified"** in its own VERIFICATION.md — never "reviewed". `/code-review ultra` stays
**ruled out on cost**.

⭐ **It is also not worthless, and that is measured rather than assumed:** on Phase 239 exactly this
arrangement returned **19 findings including 2 Criticals**, one being a destructive tool bindable as
the file *reader* and then called by the watch loop on every file, unattended.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled. Baselines
are still captured before source work. RED-first still holds. The mechanical gates — backend ceiling,
count gate, hot-file ledger, CLAUDE.md size — are unaffected by who is at the keyboard and remain the
honest floor.

**Re-arm trigger:** Gemini's quota returns, **or the v4.1 close, whichever is first.** ⚠ The previous
version of this override carried a date-based trigger that arrived and was not acted on for a day —
which is precisely how a self-verification comes to read like a review. **`DEBT-03` (Phase 245) exists
to close that gap in writing**, on phases 238, 240 and 241.

**Applies to:** every phase in v4.1 (242-246).

---

#### ⚠ The original entry, preserved — OV-SOLO-01 before the ruling

`OV-SOLO-01` (operator, 2026-09-08) set aside `AGENTS.md` §3 / §6.3 — the two-agent separation
itself — for 2026-09-08 and 2026-09-09, with the re-arm trigger *"Gemini's quota returns, or
**2026-09-10**, whichever is first."*

⛔ **2026-09-10 has arrived and Gemini is still unavailable.** The override is therefore **neither
expired-and-honoured nor silently extended** — it is recorded here as an **open operator decision**,
because letting it lapse unnoticed is exactly how a self-verification comes to read like a review.
Three phases (238, 240, 241) already closed under it.

**The operator's ruling is needed on one question:** does solo running continue into the next
milestone, and if so, what stands in for the independent gate? `/code-review ultra` is ruled out on
cost, and a code-review subagent that claude dispatches is claude's own work checking itself —
⭐ **though not worthless: on Phase 239 exactly that arrangement returned 19 findings including 2
Criticals**, one of which (a destructive tool bindable as the file *reader*, then called by the
watch loop on every file, unattended) would otherwise have shipped.

**What does NOT lapse either way:** decisions still go to the operator, never self-settled.
Baselines are still captured before source work. RED-first still holds. The mechanical gates —
backend ceiling, count gate, ledger, CLAUDE.md size — are unaffected by who is at the keyboard and
remain the honest floor.

## Gates at the v4.0 close

| Gate | Reading |
|---|---|
| Backend unit | **71 failed / 4491 passed** — the project ceiling **exactly**, and the failing **SET** diffed identical in both directions, not merely an equal count |
| Vitest count gate | RED on 3-4 **provably-unmodified** `SEED-171` flakes — captured before any re-run, per the triage procedure |
| Hot-file ledger · CLAUDE.md size · G-7 | all clear |

## Accumulated Context

Cleared at the v4.0 close. The decision log lives in `.planning/PROJECT.md` (`## Key Decisions`) —
eight v4.0 decisions were added there at this close. The pre-reset snapshot is
`.planning/milestones/v4.0-STATE-at-close.md`. **Open items carried forward are the nine sections
above — nothing else survives the reset silently.**
