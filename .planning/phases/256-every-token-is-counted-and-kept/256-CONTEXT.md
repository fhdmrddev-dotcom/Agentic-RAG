# Phase 256: Every Token Is Counted And Kept - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Base SHA:** `772f53354` on `develop`
**Role (BUS-264):** BUILDER is **claude**; REVIEWER is **gemini**. Whoever built it does not verify it
(AGENTS.md 6.3). ⛔ No source work until gemini confirms its baselines are captured (AGENTS.md 6.1);
docs-only work is safe meanwhile.

<domain>
## Phase Boundary

**No run loses its token count.** Three counting paths that already MEASURE tokens are made to
**keep** them: the harness run (persist), the sub-agent tree (roll up with one non-overlapping sum),
and the producer shells of paused / continued / resumed / scheduled / published runs (stop writing
`input_tokens=None`). The one remaining uncounted call — `llm_emit` / `forced_emit` — is counted.
Any hole that survives is **named in a register with a concrete re-open trigger**, never left silent.

⛔ **THE COUNTING EXISTS. DO NOT REBUILD IT.** `task_service._stream_one_iteration` has summed every
turn's usage into a caller-supplied box since Phase 093 (D-17); `harness_engine.py:1844` sets
`ctx.run_usage_box`; `phase_types.py:768 _record_run_usage` already sums each sub-agent into it;
`harness_engine.py:1875` already absorbs it into the `CircuitBreaker` after every phase.
**This phase adds PERSISTENCE, ROLLUP SEMANTICS and the last unwired leg — not measurement.**

⛔ **OUT OF SCOPE — belongs to Phase 257:** any rate table, any `cost_usd`, any token→USD
conversion, any operator-facing spend view. This phase produces **numbers**, not money.

</domain>

<decisions>
## Implementation Decisions

### Rollup semantics (METER-04)

- **D-256-01: A producer run's persisted number is INCLUSIVE of every descendant.** This is what
  `ctx.run_usage_box` already produces (`_record_run_usage` sums children in), so nothing is undone.
  ⛔ The "exactly one place" guarantee of SC#2 becomes a **READ rule**, not a write rule: any
  org-level or thread-level total sums **only rows `WHERE parent_run_id IS NULL`**. That narrowing is
  not new — `backend/app/api/workflows.py:1772` and `backend/app/api/runs.py:1563` already use it.

- **D-256-02: SC#2's "exactly one place" is discharged as a HIERARCHY, and the guard is driven RED.**
  A child row plus an inclusive parent row is a tree, not a double count; what SC#2 forbids is more
  than one **non-overlapping** sum. ⛔ A fence must fail on a summing site that omits the
  `parent_run_id IS NULL` narrowing, and it must be **driven RED against a planted un-narrowed SUM**
  before it is trusted. CLAUDE.md records two occasions where a green fence coexisted with the defect
  it named; a guard nobody has seen fire is not a guard.

- **D-256-03: `workflow_runs` is AUTHORITATIVE for a harness run; the producer shell in `runs`
  carries ITS SEGMENT only.** They are different grains and both are honest at their own grain.
  ⛔ **Never sum across the two tables** — pick the grain. This rule is documented beside the columns
  and carried into Phase 257's `METER-07` view.

### Durability and the write seam (METER-03)

- **D-256-04: Totals are persisted AFTER EVERY PHASE, at the existing breaker absorb point**
  (`harness_engine.py:1875`, inside `_enforce_budget`). This is the only option that satisfies SC#1's
  *"re-reading the run after the process restarts"* literally: a `kill -9`, an OOM, a worker restart
  and a **breaker trip** all keep everything spent up to the last completed phase. ⭐ A
  breaker-tripped run — killed **for** overspending — is precisely the run whose spend matters most,
  and at finalize-only it would persist zero.

- **D-256-05: The write lands in a NEW one-home writer, `persist_run_usage(pool, run_id, delta)`, in
  `backend/app/db/workflows.py`.** ⛔ `finish_run` is left **byte-unchanged**: it has 7 call sites
  across 4 files, **3 of which (cancel paths, delete cascade) have no usage box at all**, and its
  docstring records a cross-worker interleave contract that holds by value-identity. Widening it
  would make 3 callers pass `None` forever, re-introducing exactly the `None`-vs-`0` ambiguity
  CLAUDE.md says is deliberately preserved. ⛔ No inline SQL in `harness_engine.py`.

- **D-256-06: Migration 182 adds `input_tokens integer NULL` and `output_tokens integer NULL` to
  `workflow_runs`**, mirroring `runs` exactly so one grain reads the same in both tables.
  ⛔ **NOT `NOT NULL DEFAULT 0`.** `NULL` = never measured; `0` = measured as zero. CLAUDE.md:
  *"a provider that emitted no usage is a DIFFERENT fact from one that used zero tokens — do not
  coalesce."* Collapsing them would make an uninstrumented run indistinguishable from a free one,
  which is the exact defect Phase 257 exists to prevent (`$0.00` for an unrated model).

- **D-256-07: SC#4's "discoverable from the run's own totals, not from someone's memory" is
  discharged by a COVERAGE MARKER COLUMN on `workflow_runs`** recording what the total includes
  (e.g. `agent,single,batch,emit`). A run persisted before emit counting shipped reads honestly as
  not covering it, **forever**, with no date arithmetic and no memory. ⛔ Inferring coverage from
  `created_at` vs a ship date IS "someone's memory" encoded as a comparison — SC#4 forbids it.
  ⭐ Phase 257's `METER-07` *"what it cannot see"* view reads **this column**, not hand-written prose.

### Reach and accumulation (METER-05)

- **D-256-08: METER-05 covers FIVE producer-shell sites, not the two the requirement names.**
  ⚠ **MEASURED, and it corrects both the requirement text and `256-PREFLIGHT.md` (which said two).**
  `grep -rn "input_tokens=None" backend/app` returns **seven** argument sites plus one default
  parameter:

  | # | Site | Named by METER-05 | Disposition |
  |---|---|---|---|
  | 1 | `backend/app/api/runs.py:677` | ✅ | **FIX** — ask_user re-drive shell; `ctx` in scope |
  | 2 | `backend/app/api/runs.py:1331` | ✅ | **FIX** — continuation shell |
  | 3 | `backend/app/services/harness_engine.py:3051` | ⛔ | **FIX** — resume re-drive shell, same `ctx` |
  | 4 | `backend/app/services/harness/publish_service.py:1671` | ⛔ | **FIX** — publish-gauntlet shell |
  | 5 | `backend/app/services/scheduler_service.py:296` | ⛔ | **FIX** — scheduled-run shell |
  | 6 | `backend/app/services/eval_runner_service.py:946` | ⛔ | **MEASURE at plan time**, then fix or register |
  | 7 | `backend/app/services/run_reconciler.py:245` | ⛔ | **REGISTER** — the process is gone; a stranded **Deep chat** run's count is genuinely unknowable in memory |
  | — | `backend/app/services/run_lifecycle.py:369` | — | not a site — a **default parameter value** |

  Sites 1-5 are the identical shape with a live `ctx.run_usage_box`. ⛔ Fixing only the two named
  sites would leave five known holes in a number Phase 257 turns into dollars, against a phase whose
  own goal sentence is *"no run loses its token count."*

- **D-256-09: `workflow_runs` ACCUMULATES BY ADDITION AT THE DATABASE, never by SET.**
  `ctx.run_usage_box` is reset to `{}` on every `_resume_run` (`harness_engine.py:1844`), so each
  segment only ever sees its own spend. `persist_run_usage` therefore writes
  `input_tokens = COALESCE(input_tokens, 0) + $n`, matching the breaker's own additive
  `record_tokens`. ⛔ **The per-phase write must be a DELTA, not the cumulative box** — writing the
  cumulative box per phase against an `ADD` column double-books every phase. The breaker's
  `absorb_usage_box` already owns exactly this subtraction; reuse that shape rather than inventing a
  second delta bookkeeper.

- **D-256-10: `max_tokens_per_run` is really `max_tokens_per_SEGMENT`. NAME IT, DO NOT FIX IT.**
  Because the box resets per segment (D-256-09), a run resumed five times can spend 5× its ceiling.
  That is true **today**; this phase is what makes it visible. ⛔ Changing a shipped safety cap's
  semantics is a live behaviour change on a setting operators have tuned — it belongs in its own
  phase with its own UAT. **Register it as a seed with a concrete re-open trigger.** ⭐ This phase's
  whole thesis is that a named hole beats a silent one; this is the thesis applied to itself.

### The emit blind spot (METER-06)

- **D-256-11: COUNT it — do not register it.** ⚠ Measured: `forced_emit._drain`
  (`backend/app/services/forced_emit.py:516`) already receives the gateway's `usage` and
  `usage_delta` events and **silently drops both**. `task_service._drain:414-427` reads exactly those
  two arms. The box, the summer (`_record_run_usage`) and the persistence all already exist — this is
  the **last unwired leg**, roughly ten lines mirroring an existing drain, not new instrumentation.
  ⛔ A register entry for a hole this cheap to close is a deferral nobody would defend at Phase 257,
  where `METER-07` would otherwise have to print *"we cannot see `llm_emit` spend"* on most published
  workflows.

- **D-256-12: EVERY RUNG OF THE RECOVERY LADDER COUNTS, including failed rungs.** `forced_emit` can
  make several shots; you were billed for each one the provider served, whether or not it validated.
  ⛔ Counting only the successful shot systematically under-reports **the runs that cost the most** —
  the retry-heavy ones — and the under-report is invisible. Breaking failed-rung spend out into its
  own field is **deferred** (see Deferred Ideas).

### Guardrails

- **D-256-13: G-5 fires on SEVEN files and is discharged BY CONSTRUCTION, with the missing row added
  here.** ⚠ The ROADMAP says five; re-derived at `772f53354` it is seven:

  | File | commits / phases / lines | Ledger row |
  |---|---|---|
  | `backend/app/services/harness_engine.py` | 54 / 20 / 3135 | ✅ |
  | `backend/app/services/harness/phase_types.py` | 53 / 26 / 2937 | ✅ |
  | `backend/app/db/workflows.py` | 48 / 25 / 2585 | ✅ |
  | `backend/app/api/runs.py` | 38 / 17 / 1695 | ✅ |
  | `backend/app/services/harness/publish_service.py` | 25 / 11 / 1810 | ✅ |
  | `backend/app/services/eval_runner_service.py` | 12 / 7 / 959 | ✅ |
  | **`backend/app/services/forced_emit.py`** | **8 / 5 / 578** | ⛔ **NO ROW — absent its ENTIRE LIFE** |

  ⛔ `forced_emit.py` is the `config.py` failure repeating: **invisible to its own guardrail at five
  phases**, and METER-06 is the phase that modifies it. `check-hot-file-ledger.cjs 256` will fail
  `[no-row]` on it. **Add the row in THIS phase**, to BOTH registers, in the same commit
  (`docs/HOT-FILE-LEDGER.md` section + the CLAUDE.md scan-list row).
  ⚠ Also touched and **not yet firing**, rows to be added at the touch by the
  `settingsSearchPayload.ts` / `LibraryCloudImport.tsx` precedent (an absent row is invisible at any
  count): `backend/app/services/scheduler_service.py` (5 / 2 / 399),
  `backend/app/services/run_reconciler.py` (3 / 2 / 325),
  `backend/app/services/circuit_breaker.py` (1 / 1 / 331).

  **The by-construction claim must be PROVEN BY ARITHMETIC, not asserted** (the 249-02 precedent):
  one new function in `db/workflows.py` with `finish_run` byte-unchanged; one call added at an
  existing absorb point; two `elif` arms mirrored into an existing drain; five literal `None`
  replaced by a value. **No new branch, no new state, no extraction.** State/call-site counts before
  and after go in the SUMMARY.

- **D-256-14: The frontend count gate is RED AT BASE and its failing SET must be captured and
  committed BEFORE the first source edit.** Measured at `772f53354`:
  `total 8414 · failed 3 · pinned total 7674 · COUNT GATE VIOLATED (1 reason)`.
  ⛔ **Counts alone are not a baseline.** CLAUDE.md records publishing a backend baseline of 71 when
  the truth was 72 because a `tail` kept the count and threw the set away; counts can match while
  sets differ. This is a backend-only phase, so the frontend gate exists purely to prove any red is
  **inherited** — and without filenames that proof is impossible. Commit the set beside
  `256-BASELINE-backend-failing-set.txt`.

- **D-256-15: Backend baseline is 71 with ZERO headroom, and the SET is committed.**
  `.planning/phases/256-every-token-is-counted-and-kept/256-BASELINE-backend-failing-set.txt`
  (71 lines, verified). ⛔ Diff the **set**, never the count. Any new failure above 71 breaks the
  gate without operator authorisation.

- **D-256-16: G-8 — target 3-5 plans.** Four requirements is not four plans. ⛔ Never cut the
  verifier, TDD RED drives, security review or migration discipline to hit the number; the lever is
  targeted suites per task with FULL gates once per wave.

### Claude's Discretion

- The exact name and type of the coverage-marker column (D-256-07) — `text` CSV vs `jsonb` vs a
  `token_coverage` enum array. Constraint: Phase 257 must be able to read it per-run **and**
  aggregate "which runs are not fully covered" per-org without a scan.
- Whether the `parent_run_id IS NULL` fence (D-256-02) is a pytest AST fence over `backend/app` or a
  narrower grep-shaped guard. Constraint: it must be **driven RED against a planted un-narrowed SUM**
  and restored, and the plant must be proven removed (md5 or an armed watcher — the Phase 255
  `emitters.py` precedent).
- Which register receives D-256-10 (`max_tokens_per_run` is per-segment) and the `forced_emit`
  failed-rung breakdown — a new `SEED-NNN` via `/gsd:capture`, or an entry on `SEED-074`. Constraint:
  it must carry a **concrete** `trigger_when` and structured `trigger_paths`, per
  `.planning/seeds/TEMPLATE.md`, or `check-seeds-register.cjs` cannot sweep it.
- Plan decomposition inside the 3-5 target.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own measurement pack
- `.planning/phases/256-every-token-is-counted-and-kept/256-PREFLIGHT.md` — baseline pack.
  ⚠ **Written by the BUILDER, not the reviewer, and it says so.** ⛔ Its §4 claim of *"two
  `input_tokens=None` sites"* is **REFUTED by D-256-08 — there are seven.** Re-measure anything
  load-bearing rather than citing it.
- `.planning/phases/256-every-token-is-counted-and-kept/256-BASELINE-backend-failing-set.txt` —
  the 71-name backend failing SET at `772f53354`. Diff this, never a count.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Metering — cost becomes attributable" (METER-01..07, lines 63-83)
- `.planning/ROADMAP.md` §"Phase 256: Every Token Is Counted And Kept" (lines 150-163) — the four
  success criteria verbatim
- `.planning/ROADMAP.md` §"Phase 257" (lines 165-178) — the downstream consumer; every decision here
  is a number 257 turns into money

### Seeds (⛔ a seed is answered by EDITING the seed)
- `.planning/seeds/SEED-074-workflow-harness-token-usage-rollup.md` — ⚠ its title
  (*"workflow runs record NULL tokens today"*) is **partly stale**: the sub-agent path has recorded
  real tokens on its own `runs` row since Phase 093. Flip `status` at this phase's close.
- `.planning/seeds/SEED-073-model-cost-rate-registry-token-to-usd.md` — stands unchallenged, but it
  is **METER-01/02 = Phase 257**. ⛔ Nothing here builds a rate table.
- `.planning/seeds/TEMPLATE.md` — the frontmatter contract any new seed must satisfy.

### Guardrails and gates
- `docs/HOT-FILE-LEDGER.md` — read the section for **each** of the seven G-5 files before planning;
  the CLAUDE.md cell carries the verdict only, the named seam lives here.
- `CLAUDE.md` §"Workflow guardrails (MANDATORY)" — G-5, G-7, G-8
- `CLAUDE.md` §"Seeds register cross-check" and §"Reported bugs cross-check"
- `scripts/check-hot-file-ledger.cjs` · `scripts/check-seeds-register.cjs` ·
  `scripts/vitest-count-gate.cjs` · `scripts/check-backend-unit-baseline.cjs`
- `supabase/SETUP.md` — migration 182 application route (⛔ SQL editor, never `db push` / `db reset`)
- `scripts/regenerate-full-schema.sh` — run after 182 lands, **without** `--reset`

### Extension contract (Phase 255, inherited)
- `docs/EXTENSION-CONTRACT.md` — nothing in this phase may make a counter, emitter or writer
  resolvable from data, config or a database row. `scripts/check-extension-contract.cjs` runs on a
  PostToolUse hook and will fire.

### Coordination
- `AGENTS.md` §6.1 / §6.3 — baseline-before-build, and builder ≠ verifier
- `.agent-bus/OPEN.md` / `scripts/agent-bus.sh` — **BUS-264** assigns claude as builder, gemini as
  reviewer. ⛔ Design decisions go `--to operator`, never agent-to-agent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — ⛔ THE COUNTING ALREADY EXISTS

- `backend/app/services/task_service.py:451-455` — `_stream_one_iteration` SUMS each turn's
  `usage` / `usage_delta` into a caller-supplied `usage_box`. Since Phase 093 (D-17). **The substrate.**
- `backend/app/services/task_service.py:414-427` (`_drain`) — the canonical two-arm usage reader.
  **METER-06 mirrors these arms into `forced_emit._drain`.**
- `backend/app/services/harness/phase_types.py:768 _record_run_usage` — sums ONE completed sub-agent
  into the run-level box. ⭐ **METER-04's rollup is already written**; its docstring explains why the
  sub-agent keeps its own local box (so sub-run N does not record the cumulative spend of 1..N).
- `backend/app/services/harness/phase_types.py:752 _run_usage_box` — `getattr` with a safe default;
  a Deep run, a unit stub and a publish golden run all reach the executors with no box and get `None`.
  **Absence is the disarmed case and it is the common one.**
- `backend/app/services/harness_engine.py:1844` — `ctx.run_usage_box = {}`, once per run **segment**.
- `backend/app/services/harness_engine.py:1875` — `breaker.absorb_usage_box(...)` after every phase.
  **D-256-04's write point.**
- `backend/app/services/circuit_breaker.py` — `absorb_usage_box` already owns the cumulative→delta
  subtraction. **Reuse that shape for D-256-09; do not write a second delta bookkeeper.**
- `backend/app/db/runs.py:82 finalize_run` — the shared `runs` terminal writer; `input_tokens` may
  legitimately be `None`.
- `backend/app/services/run_producer.py:249` and `backend/app/services/run_lifecycle.py:386` — the
  two call sites that **already pass real totals**. Copy their shape at the five broken sites.

### Established Patterns

- **`None` ≠ `0`, everywhere.** `runs.input_tokens` is nullable and deliberately so. Migration 182
  must match (D-256-06).
- **`parent_run_id IS NULL` is the existing producer narrowing** — `api/workflows.py:1772`,
  `api/runs.py:1563`, `api/threads.py:384` / `:468`. D-256-01's read rule is this pattern, named.
- **One-home DB writers in `backend/app/db/`.** No SQL in services. D-256-05 follows it.
- **`finish_run` is value-identity-safe across workers, not exclusion-safe.** Its docstring:
  *"the one thing a caller must never do is make the two writes disagree."* ⛔ An ADD-shaped token
  write is NOT value-identity-safe — two workers adding the same delta double-books. **Plan must
  state how D-256-09's write is made idempotent or single-writer.**
- Migrations are numbered `<digits>_name.sql`; a letter suffix (`182b`) is **silently skipped**.

### Integration Points

- `workflow_runs` (schema at `supabase/full-schema.sql`) — 16 columns, **zero token columns**.
  Migration 057 has none; 062 / 063 / 064 / 070 added `inputs`, `model`, `continues_used`, `user_id`.
- `runs` — already carries `input_tokens`, `output_tokens`, `parent_run_id`. Unchanged by this phase.
- `backend/app/api/panel.py:243-274` — renders per-sub-agent rows via `parent_run_id`. ⚠ A shipped
  surface that reads child tokens; D-256-01 (inclusive parent) leaves it correct, D-256-02's
  rejected "literal" reading would have deleted it.
- `backend/app/services/forced_emit.py:318 forced_emit` → `:516 _drain` → `_exec_llm_emit`
  (`phase_types.py:1407`, calling at `:1561`). The METER-06 chain.

### ⚠ Open questions for the researcher — measure, do not assume

1. **Does `eval_runner_service.py:946` have a reachable usage box?** D-256-08 site #6 is unresolved.
2. **Is the per-phase ADD write single-writer?** Two workers can reach `finish_run` concurrently
   (its docstring names the interleave). Establish whether the same is possible for
   `persist_run_usage`, and if so whether the delta is made idempotent by a sequence/phase key.
3. **Do any shipped queries already SUM `runs.input_tokens` without the `parent_run_id IS NULL`
   narrowing?** If so, D-256-01 turns an existing correct total into a double count **the moment
   METER-05 fills the producer shells.** ⛔ This must be swept BEFORE the shells are filled, not after.
4. **Does `forced_emit`'s gateway stream actually emit `usage` for every provider?** The roster is
   eight (seven native + OpenRouter) and `emit_tier: coerce` providers are the weakest. A provider
   that emits no usage must persist `None`, not `0`.

</code_context>

<specifics>
## Specific Ideas

- **The phase's own thesis, applied to itself:** a named hole beats a silent one. D-256-10
  (`max_tokens_per_run` is per-segment) and D-256-08 site #7 (the reconciler) are both **registered**
  rather than fixed, and that is the phase working, not the phase failing.
- **Record the arithmetic, not the adjective.** D-256-13's "honoured by construction" is only worth
  something if the SUMMARY carries before/after counts. The 249-02 precedent: *state hooks 9→9,
  effect hooks 10→10.*
- **Drive the fence RED before trusting it.** Both new guards (D-256-02's narrowing fence, and any
  METER-06 fence) get a planted violation, a non-zero exit, a removal, a zero exit, and a proof the
  plant is gone. Phase 255's `emitters.py` incident — a planted `eval()` sat live for a period — is
  why the proof is an armed watcher or an md5, not timing.

</specifics>

<deferred>
## Deferred Ideas

- **Fix `max_tokens_per_run` to mean per-run** (seed the box from the persisted total on resume).
  Deferred by D-256-10 — a live behaviour change to a shipped safety cap needs its own phase and UAT.
  Re-open trigger: the first operator report of a resumed run exceeding its configured ceiling, or
  any phase that touches `CircuitBreaker` ceiling semantics.
- **Break failed-recovery-ladder spend out separately** (`forced_emit` retry cost as its own field),
  so a retry-heavy workflow is diagnosable rather than merely expensive. Deferred by D-256-12 —
  no requirement asks for it. Candidate for Phase 257's `METER-07`.
- **Recover a stranded Deep chat run's token count** (D-256-08 site #7, `run_reconciler.py:245`).
  Needs mid-stream chat-side persistence, which this phase does not build. Register with a re-open
  trigger.
- **Rename `max_tokens_per_run`.** Rejected as not cheaper than the fix and closing nothing.
- **Cache-read / reasoning-token breakdown.** Not asked for; a `jsonb` column was rejected for
  D-256-06 because Phase 257 must aggregate per org.

### Reviewed Todos (not folded)

- `spike-nl-workflow-authoring.md` (score 0.6) — matched on generic keywords (`run`, `real`, `2026`,
  `trigger`, `milestone`) only. It is an NL→workflow authoring spike with no metering surface.
  **Not folded.**

### Reported bugs reviewed, none folded

Swept `.planning/reported-bugs/` for `status: open` + `surface: Agentic-RAG` (8 reports). Four
overlap **by area, not by claim**, and ⛔ none was driven, so none is evidence:

- `BUG-260609-02` (harness/sub-agents) — a Sub-Results **labelling** defect in the workspace panel.
  ⭐ Useful as *structure*: it confirms sub-agents really do write `runs` rows with `parent_run_id`,
  which D-256-01 depends on. Nothing in this phase's scope can close it. **Left open.**
- `BUG-260730-02` (emit / render_template) — an emit **gate verdict** defect, not an emit **usage**
  defect. METER-06 touches `_drain`, not the citation gate. **Left open.**
- `BUG-260828-05` (`phase_types.py`, run-surfaces) — an SMTP receipt naming defect in a file this
  phase modifies. Same file, unrelated seam. **Left open.**
- `BUG-260916-01` (agent-loop, provider-routing) — an LLM-call timeout defect. **Left open.**

### Seeds sweep

`node scripts/check-seeds-register.cjs --phase 256` → **0 matched**, over 303/303 parsed, 0 duplicate
ids. ⚠ **That zero is an ARTEFACT, not a finding** — the phase has no PLAN.md yet, so it declares no
surfaces and `trigger_surfaces` matched nothing. The gate says so itself. ⛔ **Re-run after the first
PLAN.md exists.** Unswept figures, ⛔ never summed: **134** carry no `trigger_when` at all · **114**
carry prose a sweep cannot match.

</deferred>

---

*Phase: 256-every-token-is-counted-and-kept*
*Context gathered: 2026-09-18*
