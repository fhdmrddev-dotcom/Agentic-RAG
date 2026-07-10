---
phase: 120-collision-fix-context-isolation
audited: 2026-06-22
asvs_level: L1
threats_total: 10
threats_closed: 10
threats_open: 0
status: SECURED
auditor: gsd-security-auditor
---

# Phase 120: Security Audit — collision-fix-context-isolation

**Result: SECURED.** All 10 declared threats CLOSED. Each declared mitigation was
re-derived from the shipped source (not from documentation or intent) and, for the
DB-dependent threats, re-verified against the live local DB (:54322). Every
file:line citation below was opened and read; the live invariants were independently
re-queried, not taken from the SUMMARY.

This phase ships **COLL-01** (run-scope the sandbox-output harvest via a once-per-run
SHA-256 baseline seed) and **CTX-01** (a `messages.origin` column + asymmetric origin
history filter). The disposition for every threat is `mitigate` except T-120-SC
(`accept`).

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-120-01 | Information Disclosure (foreign container read) | mitigate | CLOSED | `tool_dispatcher.py:868,883` — seed passes the run's own `session = sandbox_manager.get_or_create(ctx.thread_id)` into `run_in_threadpool(snapshot_output_baseline, session)`; no foreign thread_id. `sandbox_service.py:364` helper takes only `session`. |
| T-120-02 | Information Disclosure (cross-run leak — core bug) | mitigate | CLOSED | `sandbox_service.py:417-423` SHA-256-keys every pre-run file into the `{hash: meta}` baseline (`iteration:-1`); `tool_dispatcher.py:883-885` seeds it into `_previous_files_in_run` so the existing `if h in previous_files: continue` dedup excludes it. Headline test `test_stale_workflow_file_excluded_from_skill_emit` **passed live** (exactly-one-file emit). |
| T-120-03 | Denial of Service (loop block / run failure) | accept→mitigate | CLOSED | `tool_dispatcher.py:883` `await run_in_threadpool(...)` (never blocks the loop, D-v2.5-01); `sandbox_service.py:398-428` whole body try/except → empty/failure returns `{}`, never raises; no `/sandbox/output/` delete added (D-120-02). |
| T-120-04 | Information Disclosure (context bleed — core property) | mitigate | CLOSED | All harness write-sites tag `'harness'`: `harness_engine.py:227-240` (raw INSERT, positional `$4`), `:451` (success persist), `:522` (failure persist), `:901` (disposition prompt); `phase_types.py:636` (llm_human_input prompt); `api/runs.py:577,596` (workflow-fallback branch). Deep filter `agent_loop.py:744` `neq("origin","harness")` always fires for Deep → drops harness rows. The two untagged inserts (`tool_dispatcher.py:2566`, `agent_loop.py:209`) are Deep-only and harness-unreachable (`ask_user ∈ _SUB_AGENT_EXCLUDED`, `tool_dispatcher.py:2256`) → default `'deep'` correctly. |
| T-120-05 | Elevation of Privilege / IDOR (scope relaxation) | mitigate | CLOSED | `agent_loop.py:1056-1057` keeps both `.eq("thread_id", thread_id)` + `.eq("user_id", current_user["id"])`; `_apply_origin_filter` (`:743-745`) only chains `.neq`/`.eq` and returns the same builder — never replaces it. `origin` is NOT in `.select(...)` (`:1055`). Filter is strictly additive (NARROWS within an already-owner-scoped set). |
| T-120-06 | Tampering (SQL injection on raw INSERT) | mitigate | CLOSED | `harness_engine.py:225-241` is the ONLY raw `INSERT INTO messages` — uses `$1..$4` positional placeholders; origin bound as positional `$4 = "harness"` literal, NEVER f-stringed. `db/runs.py:179,191` binds origin as positional `$10`. Grep confirms no f-string SQL in either path. |
| T-120-07 | Information Disclosure (NULL-origin regression) | mitigate | CLOSED | `076_messages_origin.sql:28-29` `ADD COLUMN ... NOT NULL DEFAULT 'deep'`. **Live DB re-queried independently:** `total=684, null_origin=0, deep=683, harness=1`; `is_nullable=NO`, `column_default='deep'::text`. `test_120_migration.py` **3/3 passed live**. (Count rose from the SUMMARY's 658→684 as more rows were written; the load-bearing invariant null=0 still holds.) |
| T-120-08 | Input Validation (out-of-domain origin) | mitigate | CLOSED | `076_messages_origin.sql:34-35` `CHECK (origin IN ('deep','harness'))`; origin is server-set enum only (never user input — every write site supplies a literal). Live integration test exercises the CHECK non-vacuously (probe supplies NOT NULL `user_id` so the CHECK is genuinely reached — Plan 03 Rule-1 fix) and **passes** accept-deep/harness + reject-'other'. `full-schema.sql:616` carries the CHECK. |
| T-120-09 | Denial of Service / Data Loss (db push wipe) | mitigate | CLOSED | `076_messages_origin.sql:19-26` mandates SQL-editor paste / psycopg2-direct, NEVER `db push`/`db reset`; migration idempotent (`ADD COLUMN IF NOT EXISTS` + `DROP CONSTRAINT IF EXISTS` before re-add). `full-schema.sql:615-616` regenerated (not hand-edited), matches the live schema. |
| T-120-SC | Tampering (package installs) | accept | CLOSED (accepted) | `tech-stack.added: []` in all three SUMMARYs; the new code reuses already-imported stdlib `hashlib`/`os`/`tempfile` (`sandbox_service.py:380-381`). No npm/pip/cargo install in any plan. **Acceptance rationale sound** — zero new dependency surface introduced; nothing to vet. Logged here as the accepted-risk entry. |

## Independent Live Re-Verification (not taken from SUMMARY)

- `psycopg2 → :54322`: `messages` → total=684, **null_origin=0**, deep=683, harness=1; `origin` is `is_nullable=NO`, `default='deep'::text`. Closes T-120-07.
- `pytest tests/integration/test_120_migration.py` → **3 passed** (zero-NULL, NOT NULL DEFAULT 'deep', CHECK accept/reject non-vacuous). Closes T-120-08.
- `pytest test_120_collision_regression.py::test_stale_workflow_file_excluded_from_skill_emit` + `test_120_origin_filter.py` → **15 passed** (headline exactly-one-file emit + asymmetric filter + byte-identical Deep no-op + harness-site-tagging backstop). Closes T-120-02/04/05.

## Unregistered Flags

**None.** Every SUMMARY's `## Threat Flags` section reports "None" and maps cleanly to
the declared register:
- 120-01 Threat Flags: "None — the snapshot reads the SAME per-thread session the run already uses" → maps to T-120-01 (CLOSED).
- 120-02 / 120-03 SUMMARYs introduce no `## Threat Flags` surface beyond the declared register.
No new attack surface appeared during implementation without a threat mapping.

## Code-Review Warnings — Disposition (informational, non-blocking)

The phase code review (`120-REVIEW.md`) found 0 critical / 3 warning / 4 info. None is
a missing declared mitigation; all map onto already-CLOSED threats and are recorded
here for traceability (they do NOT reopen any threat):

- **WR-01** (read-side `_apply_origin_filter` keys on `body.agent_mode`, which is never
  `"harness"`, so the `eq` branch is dead) → maps to **T-120-04**. The DECLARED
  mitigation is the Deep `neq('origin','harness')` filter, which always fires and is
  live — verified at `agent_loop.py:744,1059`. The dead `eq` branch is the harness-READ
  side, which the plan itself documents (A1) as defense-in-depth for a path that does not
  exist today (harness reconstructs from durable phase outputs, not `messages`). Latent
  write/read key-drift risk only if a future change routes a harness phase through
  `run_agent_loop`. **Non-blocking** — the core property (Deep never replays harness rows)
  holds. Recommend AR-120-01 follow-up: thread an explicit `history_mode` or drop the dead
  branch.
- **WR-02** (`supersedes` can point at an invisible `iteration:-1` pre-run baseline file →
  misleading "Replaces:" affordance) → adjacent to **T-120-02**. A user-honesty UX quirk
  on the collision path, NOT a correctness/security defect (the right file IS emitted).
  **Non-blocking.** Recommend AR-120-02 follow-up: exclude `iteration == -1` entries from
  supersedes detection.
- **WR-03** (`ctx._output_baseline_seeded` is a non-declared dynamic attribute; per-RUN
  comment vs per-PHASE harness reality) → robustness around **T-120-02**. Works today
  (`ToolContext` is a non-frozen, non-slots dataclass); would break only under a future
  `frozen=True`/`slots=True` hardening. **Non-blocking.** Recommend AR-120-03 follow-up:
  declare the field on the dataclass and reconcile the comment.
- IN-01/02/03/04 are test-naming / duplication / stale-comment hygiene items — no security
  impact.

## Accepted Risks Log

| ID | Threat | Rationale | Status |
|----|--------|-----------|--------|
| T-120-SC | Tampering via package installs | No new dependencies introduced; new code reuses already-imported stdlib (`hashlib`/`os`/`tempfile`); `tech-stack.added: []` across all three plans. Zero supply-chain surface to vet. | Accepted |

## Verdict

**SECURED — threats_open: 0 / 10.** Every declared mitigation is present in the shipped
code at the cited location, and every DB-dependent invariant was independently re-verified
on the live DB. The 3 code-review warnings are latent-quality/UX follow-ups (AR-120-01..03)
that map onto already-CLOSED threats and do NOT reopen any threat. Phase 120 may ship.
