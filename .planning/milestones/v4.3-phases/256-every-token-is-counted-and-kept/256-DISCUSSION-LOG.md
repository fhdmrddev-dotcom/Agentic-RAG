# Phase 256: Every Token Is Counted And Kept - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 256-every-token-is-counted-and-kept
**Areas discussed:** Rollup semantics (METER-04), Durability + write seam (METER-03), Resume + continue (METER-05), The emit blind spot (METER-06), Guardrails (G-5 + baselines)
**Mode:** default (interactive). Advisor mode off — no `USER-PROFILE.md`.

---

## Rollup semantics (METER-04)

### Q1 — What should a producer run's persisted token number MEAN?

| Option | Description | Selected |
|--------|-------------|----------|
| Inclusive + a fenced read rule | Producer row = own turns + every descendant, which is what `ctx.run_usage_box` already produces. "Exactly one place" becomes a READ rule: sum only `WHERE parent_run_id IS NULL` — the narrowing two shipped queries already use. | ✓ |
| Exclusive + aggregate at read | Producer carries only its own turns; totals walk `parent_run_id`. Double-counting structurally impossible, but requires subtracting children back out of a box that already summed them in. | |
| Two columns — own + descendants | `runs` gains `descendant_*` columns. Most honest; 2 more columns on a hot table and a rule unused until 257. | |

**User's choice:** Inclusive + a fenced read rule
**Notes:** Recommended because it undoes nothing — `_record_run_usage` (`phase_types.py:768`) already sums children into the box. The read rule is an existing pattern, not a new one.

### Q2 — How to discharge SC#2's "exactly one place rather than twice"?

| Option | Description | Selected |
|--------|-------------|----------|
| Redefine as hierarchy, and drive the guard | A child row plus an inclusive parent row is a tree, not a double count; what SC#2 forbids is more than one NON-OVERLAPPING sum. Guard driven RED against a planted un-narrowed SUM. | ✓ |
| Take it literally — producer stores the only copy | Sub-agent rows stop carrying their own totals. Satisfies the words; deletes the shipped per-sub-agent drill-down (`api/panel.py:243-274`). | |
| Escalate to the operator before building | Post `--to operator` since 257 turns these into money. | |

**User's choice:** Redefine as hierarchy, and drive the guard
**Notes:** The literal reading was rejected on measured grounds — a shipped surface renders child tokens today.

### Q3 — `workflow_runs` vs the producer shell in `runs`: which is authoritative?

| Option | Description | Selected |
|--------|-------------|----------|
| `workflow_runs` authoritative; producer shell mirrors its segment | `workflow_runs` is cumulative across resume segments; the shell carries ITS segment, which is what it actually is. Never sum across tables. | ✓ |
| `runs` authoritative; `workflow_runs` a denormalized cache | Everything funnels through `runs`. Makes a harness run's home a table it does not own. | |
| Only `workflow_runs` — leave the None sites NULL | ⛔ Fails METER-05 outright. | |

**User's choice:** `workflow_runs` authoritative; producer shell mirrors
**Notes:** Surfaced because the same tokens landing in two tables is a cross-table double count nobody would notice until Phase 257 aggregates.

---

## Durability + write seam (METER-03)

### Q4 — WHEN do totals reach `workflow_runs`?

| Option | Description | Selected |
|--------|-------------|----------|
| After every phase, at the breaker absorb point | `_enforce_budget` already calls `absorb_usage_box` after each phase (`harness_engine.py:1875`). Survives `kill -9`, OOM, worker restart and a breaker trip. Only option that satisfies SC#1's "after the process restarts" literally. | ✓ |
| At finalize only | One write, cheapest, matches `runs` today. A crashed or SIGKILLed run persists ZERO — and a breaker-tripped run is the one whose spend matters most. | |
| Both — per-phase, re-asserted at finalize | Belt and braces; two write paths to keep in agreement. | |

**User's choice:** After every phase, at the breaker absorb point

### Q5 — WHERE does the write land?

| Option | Description | Selected |
|--------|-------------|----------|
| New one-home `persist_run_usage()` in `db/workflows.py` | `finish_run` left byte-unchanged; its 3 box-less callers (cancel paths, delete cascade) need no change. G-5 honoured by construction: one added function, zero edits to existing ones. | ✓ |
| Widen `finish_run` with optional token params | Fewer moving parts. Touches a function whose docstring records a cross-worker interleave contract; 3 of 7 callers would pass `None` forever. | |
| Write from the engine directly (inline UPDATE) | ⛔ Breaks the one-home pattern and puts SQL in a 54/20/3135 firing file. | |

**User's choice:** New one-home `persist_run_usage()` writer

### Q6 — Migration 182 column shape?

| Option | Description | Selected |
|--------|-------------|----------|
| `input_tokens` / `output_tokens`, integer, NULL-able | Mirrors `runs` exactly. `NULL` = never measured, `0` = measured as zero — the distinction CLAUDE.md says is deliberately preserved. | ✓ |
| Same two columns, `NOT NULL DEFAULT 0` | Simpler reads. ⛔ Coalesces two different facts and makes an uninstrumented run indistinguishable from a free one — the defect 257 exists to prevent. | |
| A single `tokens` jsonb column | Extensible without a later migration. Cannot be summed or indexed cheaply, and 257 aggregates per org. | |

**User's choice:** integer, NULL-able

### Q7 — How is emit coverage "discoverable from the run's own totals" (SC#4)?

| Option | Description | Selected |
|--------|-------------|----------|
| A coverage marker column on the run | Records what the total includes. A run persisted before emit counting reads honestly as not covering it, forever. 257's METER-07 reads the column rather than hand-written prose. | ✓ |
| Infer from `created_at` vs the ship date | ⛔ This IS "someone's memory", encoded as a date comparison — the thing SC#4 forbids. | |
| Count emit unconditionally, so there is nothing to mark | Redundant if METER-06 counts. Historical rows and any future blind spot still have nowhere to say so. | |

**User's choice:** A coverage marker column

---

## Resume + continue (METER-05)

> ⚠ **This area opened with a measurement that corrected both the requirement text and the phase's
> own PREFLIGHT.** METER-05 names two `input_tokens=None` sites; `256-PREFLIGHT.md` §4 says two.
> `grep -rn "input_tokens=None" backend/app` returns **seven** argument sites plus one default
> parameter value. The seven were tabled with their shapes before any option was offered.

### Q8 — How far does METER-05 reach?

| Option | Description | Selected |
|--------|-------------|----------|
| All 5 producer shells + name #6/#7 | Fix sites 1-5 (identical shape, live `ctx` box). Register #7 (reconciler — process gone, genuinely unknowable for a Deep chat run). Measure #6 (eval) at plan time. Closes the class, not two instances. | ✓ |
| The two named sites only | Exactly what the requirement says; smallest diff. Leaves five known holes in a number 257 turns into dollars, against a goal sentence reading "no run loses its token count". | |
| All 7, including the reconciler | Would recover a stranded HARNESS run from what per-phase persistence already wrote — but a stranded DEEP chat run still cannot, so it does not actually reach 7 without new chat-side work (scope creep). | |

**User's choice:** All 5 producer shells + name #6/#7

### Q9 — How does `workflow_runs` accumulate across resume segments?

| Option | Description | Selected |
|--------|-------------|----------|
| ADD at the DB, never SET | `COALESCE(x,0) + $n`, matching the breaker's additive `record_tokens`. Requires the per-phase write to be a DELTA or a resumed run double-books its own segment. | ✓ |
| SET the cumulative box, and make the box survive resume | Load the persisted total back into `ctx.run_usage_box` on resume; plain SET, one in-memory source of truth. Cost: the breaker's ceiling then counts prior segments — arguably correct, but a behaviour change to a shipped cap. | |
| SET per segment, total at read time | ⛔ Loses the single-row read 257 needs; contradicts Q3. | |

**User's choice:** ADD at the DB, never SET

### Q10 — `max_tokens_per_run` is really per-SEGMENT. Act on it?

| Option | Description | Selected |
|--------|-------------|----------|
| Name it, don't fix it | Register with a concrete re-open trigger. Changing a shipped safety cap's semantics is a live behaviour change belonging in its own phase with its own UAT. | ✓ |
| Fix it here — seed the box from the persisted total on resume | Makes the setting mean what its name says. A run 90% through its budget then trips almost immediately on resume. | |
| Rename the setting instead | Touches config, settings UI, docs and stored `user_settings` rows — not cheaper than the fix, and closes nothing. | |

**User's choice:** Name it, don't fix it
**Notes:** Consistent with the phase's own thesis — a named hole beats a silent one. This phase is what makes the hole nameable.

---

## The emit blind spot (METER-06)

> Opened with the measurement that decides it: `forced_emit._drain` (`:516`) reads
> `delta` / `tool_preparing` / `tool_args_progress` / `tool_start` / `finish` and **drops `usage` and
> `usage_delta`** — the two arms `task_service._drain:414-427` already reads. The gateway emits them
> today, so counting is a mirror of an existing drain, not new instrumentation.

### Q11 — Count it or register it?

| Option | Description | Selected |
|--------|-------------|----------|
| Count it | ~10 lines: mirror the two arms, widen the return, call the existing `_record_run_usage` from `_exec_llm_emit`. Box, summer and persistence all already exist. | ✓ |
| Register it | Zero code. 257's METER-07 would then print "we cannot see `llm_emit` spend" on most published workflows. | |
| Count it AND register the residue | Count what the drain sees, register what it still cannot (e.g. a rung whose stream died before emitting usage). Decide after the drain is driven. | |

**User's choice:** Count it
**Notes:** The "count AND register residue" option stays available if driving the drain reveals a provider that emits no usage on this path.

### Q12 — Which shots of the recovery ladder count?

| Option | Description | Selected |
|--------|-------------|----------|
| Every rung, including failed ones | You were billed for each shot served. A ladder that retried four times and succeeded on the fifth cost five calls. | ✓ |
| Only the successful shot | Cleanest mapping. ⛔ Systematically under-reports the runs that cost the most — the retry-heavy ones — invisibly. | |
| Every rung, with failed-rung spend broken out separately | Total honest AND retry-heavy workflows diagnosable. No requirement asks for it — deferred to 257. | |

**User's choice:** Every rung, including failed ones

---

## Guardrails (G-5 + baselines)

> ⚠ **Surfaced BEFORE writing CONTEXT.md, as G-5 requires** — a refactor recommendation is offered as
> the first option, not the feature. Re-derived at `772f53354`: G-5 fires on **seven** files, not the
> five the ROADMAP names, and `backend/app/services/forced_emit.py` (8 / 5 / 578) has **no ledger row
> at all** — absent for its entire life, the `config.py` failure repeating.

### Q13 — How do we discharge G-5 on 7 files?

| Option | Description | Selected |
|--------|-------------|----------|
| Honoured by construction + add the missing row | Every edit measurably additive: one new function (`finish_run` byte-unchanged), one call at an existing absorb point, two `elif` arms in an existing drain, five literal `None` → a value. Arithmetic recorded as proof (249-02 precedent). `forced_emit.py` row added at THIS phase. | ✓ |
| Insert a refactor phase 255.1 first | Take a named seam before landing a 7-file feature. The `harness_engine.py` / `phase_types.py` seams are large — a real extraction is its own multi-plan phase, delaying the metering 257 depends on. | |
| Split 256 so no plan touches more than 2 firing files | Same work, smaller blast radius per plan. Pushes plan count against G-8's 3-5 target. | |

**User's choice:** Honoured by construction + add the missing row
**Notes:** The by-construction claim is only worth something with the before/after counts in the SUMMARY — asserted, it is the same word five stale ledger rows used.

### Q14 — The frontend count gate is RED at base and I have counts, not filenames.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run and commit the failing SET before any source work | This is a backend-only phase, so the frontend gate exists purely to prove any red is INHERITED — impossible without filenames. One gate run, before the first edit, per BUS-264. | ✓ |
| Treat "failed 3" as inherited on the count alone | ⛔ The exact failure CLAUDE.md records — a `tail` kept the count and threw the set away, publishing a backend baseline of 71 when the truth was 72. | |
| Ask gemini for its captured baseline instead | Independent of the builder, therefore stronger evidence. Blocks on an agent stopped mid-255. | |

**User's choice:** Re-run and commit the failing SET before any source work
**Notes:** Gate re-run started during this discussion. Measured at base: `total 8414 · failed 3 · pinned total 7674 · COUNT GATE VIOLATED (1 reason)`.

---

## Claude's Discretion

- Exact name and type of the coverage-marker column (D-256-07) — constrained by 257 needing both a
  per-run read and a per-org "not fully covered" aggregate without a scan.
- Shape of the `parent_run_id IS NULL` fence (D-256-02) — pytest AST fence vs a narrower guard.
  Constrained: must be driven RED against a planted un-narrowed SUM and the plant proven removed.
- Which register receives D-256-10 and the failed-rung breakdown — a new `SEED-NNN` vs an entry on
  `SEED-074`. Constrained by `.planning/seeds/TEMPLATE.md` so the sweep can see it.
- Plan decomposition inside the G-8 3-5 target.

## Deferred Ideas

- Fix `max_tokens_per_run` to mean per-run (seed the box from the persisted total on resume).
- Break failed-recovery-ladder spend out as its own field — candidate for 257's METER-07.
- Recover a stranded Deep chat run's token count (`run_reconciler.py:245`) — needs mid-stream
  chat-side persistence this phase does not build.
- Rename `max_tokens_per_run` — rejected outright, not deferred.
- Cache-read / reasoning-token breakdown — rejected with the jsonb column shape.

## Cross-references swept

- **Todos:** 1 match (`spike-nl-workflow-authoring`, 0.6) — generic keyword noise, **not folded**.
- **Reported bugs:** 8 open `surface: Agentic-RAG`; 4 overlap by area, none by claim, none driven,
  **none folded**, all left open with reasons in CONTEXT.md.
- **Seeds:** `check-seeds-register.cjs --phase 256` → 0 matched, 303/303 parsed, 0 duplicate ids.
  ⚠ Artefact — no PLAN.md exists yet, so the phase declares no surfaces. Re-run after plan 01.
  Unswept, never summed: 134 no `trigger_when` · 114 prose-only.
