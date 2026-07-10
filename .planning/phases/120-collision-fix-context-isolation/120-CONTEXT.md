# Phase 120: Collision Fix + Context Isolation - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the live, root-caused workflow↔skill collision and isolate Deep/Harness
history when they share a thread. Two independent backend seams:

1. **COLL-01 (the confirmed live bug)** — run-scope the sandbox-output harvest so a
   skill `execute_code` turn emits **only the file(s) it actually created**. Today a
   prior workflow's leftover `/sandbox/output/` artifact is re-emitted (the confirmed
   2-files bug). No schema change.
2. **CTX-01** — add `messages.origin` (`deep | harness`) and filter
   `_reconstruct_history` so a Deep turn never replays a workflow's rows and a
   workflow phase never replays Deep rows. One numbered migration (**076**).

**In scope:** the harvest baseline fix (COLL-01) + the `origin` column/tag/filter
(CTX-01) + a faithful end-to-end regression test + SC#10 4-axis verification.

**Out of scope (this phase):** IA-01 composer change (Phase 121); COLL-02
`template_input`/`render_template` resolver run-scope (STRETCH Phase 130 — Mechanism B
did NOT fire in the live evidence); any provider/honesty work (Phase 122).

**Red line:** Deep Mode stays byte-identical on the native-7; provider differences (if
any touched) stay at the gateway/adapter boundary; no shared-path fork.
</domain>

<decisions>
## Implementation Decisions

### COLL-01 — Harvest run-scope (the 2-files bug)
- **D-120-01:** **Per-turn baseline-filter only, no clearing.** Each Deep agent-turn
  (one `agent_runner` run) seeds `harvest_output_files`' `previous_files` baseline from
  the **actual `/sandbox/output/` listing at run start** (today `_previous_files_in_run`
  starts empty at `agent_loop.py:1316`). Only files the turn newly created enter the
  emitted delta; pre-existing files (e.g. a prior workflow's leftover `.docx`) are
  excluded. Scope is **per run, not per cell** — a multi-cell run keeps its own
  intermediates.
- **D-120-02:** **Do NOT proactively clear `/sandbox/output/`** at the Harness→Deep
  boundary or workflow-run end. Stale files stay on disk (never re-emitted) so a file
  the user may still want to download is never destroyed. Smallest blast radius
  (matches the COLL-03 evidence recommendation). No schema change for COLL-01.
- **D-120-03:** Apply the same baseline-at-run-start seeding to the **Harness run**
  path so a workflow run only emits its own outputs (defense symmetry), without
  excluding the workflow's own legitimate deliverable from its own run.

### CTX-01 — `messages.origin` + history isolation
- **D-120-04:** **New column `messages.origin`** in migration **076**, type text,
  `DEFAULT 'deep'`, `CHECK (origin IN ('deep','harness'))`. Default `'deep'` is the
  *safe* failure direction (a mistagged row appearing in Deep is the status quo; the
  dangerous direction — a Deep row polluting a workflow — is blocked by strict harness
  replay).
- **D-120-05:** **No backfill of existing rows.** Pre-migration rows are `NULL` (or take
  the `DEFAULT 'deep'` on existing-row fill — planner to confirm exact column-add
  semantics; the intent is "legacy rows behave as Deep"). Treat legacy rows as Deep.
  Back-tagging historical harness rows via workflow-run joins (the accurate-but-fragile
  option) was **rejected** as not worth the complexity for a small, shrinking set of
  pre-migration mixed threads.
- **D-120-06:** **Filter semantics — asymmetric:** a **Deep** turn's history
  reconstruction replays `origin <> 'harness'` (i.e. `deep` OR legacy/`NULL`); a
  **Harness** phase replays `origin = 'harness'` strictly. This preserves all existing
  Deep chats (legacy rows still replay) while preventing go-forward bleed in both
  directions.
- **D-120-07:** **Tag origin explicitly at every message-insert site**, not just rely on
  the default — Deep sites (`agent_loop.py:209`, `agent_loop.py:1269`,
  `threads.py:1020`, and any tool/`runs.py` Deep-path inserts) write `'deep'`; Harness
  sites (`harness/phase_types.py:629`, `harness_engine.py:889`) write `'harness'`. The
  filter lives in the history query at `agent_loop.py:1024` (NOT in `threads.py`).

### Acceptance / verification
- **D-120-08:** **Faithful live-repro regression test is the headline bar.** Mirror the
  confirmed live scenario (thread `99af24d5`): a workflow render writes a leftover
  `.docx` into the shared `/sandbox/output/` → a Deep skill `execute_code` saves
  **exactly one** file → assert the emitted `output_files` contains **exactly that one**
  file and the stale leftover is excluded. The test must **fail before** the fix and
  pass after.
- **D-120-09:** **SC#10 4-axis is mandatory** (this phase touches streaming / agent loop
  / provider routing / UI state): cross-provider (native-7 representative) × multi-tool ×
  parallel-thread × long (≥50-message) history. Deep Mode proven byte-identical. The live
  thread `99af24d5` may be re-run as a manual UAT confirmation.

### Claude's Discretion
- Exact mechanism for seeding the baseline (snapshot the directory listing + hash vs.
  mtime-filter against turn-start) — researcher/planner picks; the contract is "only
  emit files this run created." The evidence notes both are viable.
- Exact column-add SQL semantics for existing rows (NULL vs DEFAULT-fill) — planner to
  confirm against Postgres `ADD COLUMN ... DEFAULT` behavior; the *intent* (legacy =
  Deep) is locked by D-120-05/06.
- Whether `tool` / `ask_user` / sub-agent message rows need explicit origin tagging or
  inherit their insert-site's mode — planner to enumerate the full insert-site set
  against the two modes (D-120-07 lists the known sites; verify exhaustiveness).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked scope + live evidence (read first)
- `.planning/research/v3.1-skills-eval/COLL-03-EVIDENCE.md` — **the live root-cause** of
  the collision (Mechanism A confirmed on thread `99af24d5`), the exact smoking-gun
  signature, and the prescribed COLL-01 fix. This is the technical heart of the phase.
- `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` — LOCKED v3.1 scope;
  COLL-01/CTX-01/IA-01 split rationale (IA-01 does NOT fix the collision); confirmed facts.
- `.planning/research/v3.1-skills-eval/ADVISORY.md` + `WAVE2-ADVISORY.md` — Wave 1/2
  research bundle (skills model, collision analysis, context isolation).
- `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md` — operator pressures behind the scope.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — COLL-01 (line 15), CTX-01 (line 16); traceability table.
- `.planning/ROADMAP.md` §"Phase 120" — the 4 Success Criteria (what must be TRUE).

### Code seams (read to ground the plan)
- `backend/app/services/sandbox_service.py:201` — `harvest_output_files(...)` — the
  `previous_files` content-hash dedup baseline (the COLL-01 seam).
- `backend/app/services/tool_dispatcher.py:864-1146` — `execute_code` handler;
  `_previous_files_in_run` wiring + `harvest_output_files` call (`:1139`).
- `backend/app/services/agent_loop.py:1316` — `_previous_files_in_run = {}` (the empty
  baseline init — the bug origin); `:723` `_reconstruct_history`; `:1024` history query
  (where the origin filter goes); `:209` / `:1269` Deep message inserts.
- `backend/app/services/harness/phase_types.py:629` + `backend/app/services/harness_engine.py:889`
  — Harness message inserts (tag `origin='harness'`).
- `backend/app/api/threads.py:1020` — Deep message insert (G-5 hot file — add the
  one-line `origin` tag only; do NOT grow this file; filter stays in `agent_loop.py`).
- `supabase/migrations/` — latest is `075_*`; **next migration = `076_*`** (CTX-01 column).
  Apply per CLAUDE.md (paste into Supabase SQL editor, never `db push/reset`), then
  `bash scripts/regenerate-full-schema.sh`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`harvest_output_files` per-run dedup baseline already exists** (Phase 075.4
  D-075.4-D1/D2: content-hash keyed `previous_files` dict + `supersedes` detection). The
  COLL-01 fix is *seeding* that baseline at run start, not building new machinery.
- **`_reconstruct_history(history_rows, active_provider)`** (`agent_loop.py:723`) already
  centralizes history rebuild; CTX-01 filters the rows feeding it (at the `:1024` query)
  rather than rewriting reconstruction.

### Established Patterns
- Migrations are numbered, applied by hand to the live DB, then `full-schema.sql` is
  regenerated via `scripts/regenerate-full-schema.sh` (never hand-edited).
- Deep/Harness already share the `messages` table keyed by `thread_id`; both modes
  insert through distinct code sites (enables per-site origin tagging).
- Red line / G-5: `threads.py` and `agent_loop.py` are firing hot files — touch
  minimally (one-line origin tag in `threads.py`), no extraction triggered by a tag add.

### Integration Points
- COLL-01: the baseline seed sits at the `execute_code`/`agent_runner` run boundary; it
  must NOT change the per-cell intermediate accumulation within a run.
- CTX-01: column add (migration 076) → tag at ~6 insert sites → filter at one query site.

</code_context>

<specifics>
## Specific Ideas

- The acceptance test must reproduce the **exact** confirmed signature: a single
  `execute_code` emitting MORE `output_files` than the code wrote (including a file the
  code never created) — NOT the rejected "same filename across two execution_ids"
  heuristic (both files shared one Deep execution_id in the live case).
- Live evidence anchor: thread `99af24d5-39a2-4f3c-a355-c65b43f73eb0`, leftover
  `weekly-status-report.docx` (37,328 B, was tagged `is_hero:true`) vs. the skill's real
  `Weekly_Report_2026-06-20.docx` (11,545 B).
</specifics>

<deferred>
## Deferred Ideas

- **COLL-02 — `template_input` / `render_template` resolver run-scope** → STRETCH **Phase
  130** (as roadmapped). Mechanism B did not fire in the live evidence (skill used
  `execute_code`, not `render_template`); keep it as defense-in-depth for the
  render_template path, sequenced after 120 on the same collision surface.
- **Proactive `/sandbox/output/` cleanup at mode boundary** — considered and rejected
  for 120 (D-120-02); could revisit if a future leak path needs belt-and-suspenders.
- **IA-01 composer 2-pill simplification** → Phase 121 (clarity, not the collision fix).

None of the open `surface: Agentic-RAG` reported bugs fold into this phase — the
mandatory cross-check found no overlap with the harvest / `messages.origin` /
`_reconstruct_history` domain (open ones route to Phase 122/124/127/129).

</deferred>

---

*Phase: 120-Collision Fix + Context Isolation*
*Context gathered: 2026-06-22*
