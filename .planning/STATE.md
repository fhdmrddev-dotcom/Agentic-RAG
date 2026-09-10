---
gsd_state_version: 1.0
milestone: none
milestone_name: "between milestones — v4.0 closed 2026-09-10"
status: milestone_complete
last_updated: "2026-09-10T14:00:00.000Z"
last_activity: 2026-09-10
progress:
  total_phases: 14
  completed_phases: 14
  total_plans: 62
  completed_plans: 62
  percent: 100
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

**Current focus:** **No milestone active.** v4.0 Connected Knowledge **SHIPPED 2026-09-10** (git tag
`v4.0`; 14 phases 228-241, 62 plans, 571 commits, 6 days; 33/38 requirements). Next:
`/gsd:new-milestone`. Phase numbering continues at **242**.

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

### ⚠ OV-SOLO-01 — ITS RE-ARM TRIGGER HAS FIRED, AND THE CONDITION IS STILL TRUE

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
