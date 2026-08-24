"""asyncpg-backed helpers for the harness workflow tables (Phase 091 / HARNESS-03).

These typed helpers mirror ``backend/app/db/runs.py`` (the D-073 asyncpg hot-path
precedent): an asyncpg pool, parameterized ``$N`` placeholders only (no f-strings
on SQL — T-073-02 / T-091-03), and small return shapes the Phase 091 engine
(``harness_engine.run_workflow``) consumes.

  ONE NAMED EXCEPTION TO "no f-strings on SQL" (Phase 186 / D-186-07):
  ``CONCURRENCY_TOKEN_SQL`` below is a module-level CODE LITERAL — no user input
  ever reaches it — spliced into the f-strings of the four draft queries. Every
  VALUE still travels as ``$N``. See the constant's own docblock for why the token
  must be rendered in SQL rather than compared as a bare timestamp column.

COLUMN-NAME CONTRACT (BLOCKER fix — migration 058:16, full-schema.sql:716):
  On ``workflow_phases`` the run foreign-key column is ``workflow_run_id`` (NOT a
  bare ``run_id``). Every RUN-KEYED read against ``workflow_phases`` therefore
  filters ``WHERE workflow_run_id=$1``; querying ``WHERE run_id=$1`` would raise
  Postgres 42703 (undefined_column) at runtime while ordering-only mock unit
  tests stay green. PHASE-KEYED writes filter ``WHERE id=$1`` and are correct.

  ``harness_audit`` DOES have a plain ``run_id`` column (migration 059) — that is
  a different table and its ``run_id`` predicate is correct. The ``workflow_runs``
  helpers are keyed by that table's own ``id`` column.

SECURITY (T-091-03 / V4 access control): the engine runs as service role
(bypasses RLS). Every run-keyed query is scoped by ``workflow_run_id`` (which is
owner-scoped through the workflow_runs -> threads.user_id FK chain); the engine
never accepts a run_id it did not receive from the owning thread's producer spawn.

PHASE 163 (TEN-02) — this module stays SERVICE-ROLE by design (no request-scoped
get_user_pg_connection conversion). It is shared by BOTH the request routes AND the
background harness engine on the SAME helpers, several of which own their own
``pool.acquire()`` transaction (create_workflow_run / delete_published_workflow_cascade
/ delete_workflow_cascade_preview / count_foreign_runs_on_global / finish_run) and so
cannot accept a duck-typed request-scoped RLS Connection. The workflow_* membership-RLS
policies are LIVE + proven at the DB layer (tests/integration/test_163_rls_workflow_eval.py:
cross-org isolation + is_system_global-org-scoping + parent-thread + created_by preservation), so
isolation is enforced regardless of the client; app-code ``created_by`` / ``workflow_run_id``
scoping stays the D-14 in-code gate. Plan 09 widens the harness async writers with org_id.

2-PHASE WRITE (HARNESS-03 / Pitfall 1): ``mark_phase_active`` makes the phase
durably ``active`` BEFORE any work runs; ``complete_phase`` flips to ``completed``
AND writes ``output`` in ONE atomic UPDATE, ONLY after the output is durable. A
phase that crashes mid-work is left ``active`` (never ``completed``), so a later
sweep re-runs it.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from uuid import UUID

import asyncpg

from app.models.harness import WorkflowDefinition

logger = logging.getLogger(__name__)

# ── Phase 186 (CONCUR-02 / D-186-07) — the optimistic concurrency token ───────
# ONE canonical expression, referenced by every read AND by the guard, so the value the
# client is handed and the value the WHERE clause compares can never drift apart.
#
# WHY THIS EXPRESSION AND NOT ``updated_at = $N`` (what D-186-07 originally proposed):
#   asyncpg REFUSES to bind a ``str`` to a ``timestamptz`` parameter — with AND without
#   an explicit ``$N::timestamptz`` cast. Probed against the live local stack 2026-08-01:
#   ``DataError: invalid input for query argument $2: '...' (expected a datetime.date or
#   datetime.datetime instance, got 'str')``, identically for both forms. The naive shape
#   is a runtime 500 on the first stale check, not a subtle precision bug. Comparing in
#   TEXT space keeps the token a ``str`` from Postgres to the browser and back, which is
#   what makes "echo it verbatim" ENFORCEABLE rather than merely requested.
# WHY ``AT TIME ZONE 'UTC'`` AND NOT ``updated_at::text``:
#   a bare cast renders in the SESSION ``TimeZone``. Probed: the same row renders
#   ``...19:55:38.363036+00`` under UTC and ``...01:25:38.363036+05:30`` under IST, so a
#   pooled connection that picked up a different TimeZone would 409 every save. This form
#   pins UTC and was proven byte-identical across both sessions.
# WHY ``.US`` AND NOT Python's ``isoformat()``:
#   ``US`` always emits 6 fractional digits. Python's ``.isoformat()`` and Pydantic's
#   datetime serializer BOTH DROP the fractional part when microseconds == 0, so the token
#   width would vary with the clock. Constant width means one shape to compare.
# PITFALL 9 — ``now()`` IS TRANSACTION TIME:
#   the ``set_updated_at`` trigger (migration 056) sets ``NEW.updated_at = now()``, and
#   ``now()`` is the TRANSACTION timestamp. Two UPDATEs wrapped in ONE transaction produce
#   an IDENTICAL token (probed) — which would silently disable this guard. Both production
#   writers are single-statement autocommit today; keep them that way, or the guard stops
#   guarding without any test going red.
# NOT ABSOLUTE, AND SAY SO: two writes landing in the SAME microsecond would render the
#   same token. Measured spacing on five back-to-back autocommit UPDATEs was ~1.4-3 ms, so
#   this is negligible — but it is a probability, not a proof.
#
# ``$N``-ONLY DISCIPLINE IS PRESERVED: this is a module-level CODE LITERAL containing no
# user input, spliced into an f-string. Every VALUE still travels as ``$N``.
CONCURRENCY_TOKEN_SQL = (
    "to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
)

# ── Phase 192.2 (LIB-06 / D-07) — the LAST-RUN LATERAL, in ONE place ─────────────────
#
# LIB-06's question is *does this one work*, and the answer already exists: measured against
# the live local DB on 2026-08-19, ``workflow_runs`` holds **228 rows** (186 completed / 31
# failed / 11 cancelled) across **48 distinct definitions**, and **all 228 carry a non-NULL
# ``user_id``**. ⚠ NO MIGRATION, NO NEW COLUMN, NO NEW WRITE — the three library feeds simply
# never read the table. This constant is the whole of the read.
#
# ⚠ ``LEFT``, AND ``LATERAL``, AND BOTH WORDS ARE LOAD-BEARING FOR A MEASURED REASON.
#   • ``LEFT`` — 69% of the library (81 of 117 real rows) is drafts and only 48 definitions
#     have ANY run, so an INNER join would silently HIDE most of the library. The card would
#     answer "does this one work" by deleting everything that has not been tried.
#   • ``LATERAL … LIMIT 1`` — one row per definition. A plain join to ``workflow_runs``
#     multiplies rows by run count, and the live data makes that concrete rather than
#     theoretical: one definition carries **24** runs, another **22**, another **20**. The
#     library would render those workflows 24, 22 and 20 times.
#
# ⚠ THE SCOPE CLAUSE ``r.user_id = $1`` IS THE SECURITY BOUNDARY OF THIS JOIN, NOT A FILTER.
# These feeds run on a service-role pool that BYPASSES RLS, so whatever the SQL returns is
# what the caller gets — the mig-116 / CR-01 shape Phase 190's review caught. A GLOBAL
# published row (``is_system_global``) is world-readable, and five of them carry 20 / 15 / 11
# / 7 / 1 real runs belonging to ONE user; an UNSCOPED lateral would hand every other caller
# that activity. Scoping by ``user_id`` is strictly NARROWER than scoping by ``org_id`` — a
# user belongs to one org — so the cross-ORG case is excluded by construction rather than by
# a second clause that could later be edited away. ⚠ A legacy run with a NULL ``user_id`` is
# attributed to NOBODY (``NULL = $1`` is not true): fail-closed, never fail-open.
#
# ⚠ IT BINDS ``$1`` AND NEVER A NEW PLACEHOLDER. All three feeds ALREADY bind the caller as
# ``$1``, so the join introduces no binding and cannot renumber the published feed's ``$2``
# project filter. No f-string, no ``%``, no user input reaches this text (T-192.2-12).
#
# ⚠ THE OUTPUT COLUMNS ARE RENAMED AT THE SUBQUERY BOUNDARY, AND THAT IS NOT COSMETIC.
# ``workflow_runs`` has ``id``, ``status`` AND ``updated_at``, and the outer queries carry all
# three BARE — ``WHERE status = 'published'``, ``ORDER BY updated_at DESC, id DESC``. Exposing
# them under their own names would make every one of those clauses AMBIGUOUS and each feed
# would raise. ``AS last_run_at`` / ``AS last_run_status`` is what keeps the shipped WHERE and
# ORDER BY byte-identical.
#
# ⚠ THE ORDER KEY IS THE RUN'S OWN ``created_at``, NEVER the definition's ``updated_at`` —
# those are different facts and this phase must not conflate them (on a published definition
# ``updated_at`` is the PUBLISH time, deliberately, because the row is immutable afterwards).
# The ``, r.id DESC`` tiebreaker is the review-WR-03 lesson applied PROSPECTIVELY rather than
# defensively: measured 2026-08-19 there are **0** ``(definition_id, created_at)`` collisions
# in all 228 rows, so this fixes no observed reshuffle — it refuses to depend on a uniqueness
# nothing enforces, since ``now()`` is transaction-scoped. ``workflow_runs.id`` is the PRIMARY
# KEY, so the order is total.
#
# ⚠ ONE CONSTANT, NOT THREE COPIES, and the second reason is stated rather than left to be
# discovered. The first reason is the obvious one — three feeds must agree on the ``lr.*``
# aliases or a projection references a column its own join does not expose. The second:
# ``test_workflows_updated_at`` reads ``inspect.getsource(list_starter_workflows)`` and
# asserts ``"id DESC" not in`` it, to pin that the STARTERS SHELF stays alphabetical (D-16).
# A lateral inlined there would red that fence with a SUBQUERY's ordering, which is not the
# shelf's ordering — the 187-24 trap, a needle judging something it was never written to
# judge. Keeping the join here leaves that fence judging exactly its own property, and
# ``test_library_run_facts.test_the_starters_shelf_ordering_is_untouched`` re-pins the shelf
# clause AND this constant's ordering so neither goes unguarded.
#
# NO INDEX, NO MIGRATION, and the evidence rather than the assurance: ``workflow_runs`` is
# **228 rows** and already carries ``idx_workflow_runs_user_id``, which is the selective half
# of this predicate (one user owns all 228 today, but the index is what the planner reaches
# for as that changes). There is no index on ``definition_id`` and none is added — the
# precedent is recorded in ``list_published_workflows``' own docstring: "NO expression index,
# ZERO migration … sufficient at current scale". Re-open at ~10k runs.
_LAST_RUN_LATERAL_SQL = (
    "LEFT JOIN LATERAL ("
    "SELECT r.created_at AS last_run_at, r.status AS last_run_status "
    "FROM workflow_runs r "
    "WHERE r.definition_id = wd.id AND r.user_id = $1 "
    "ORDER BY r.created_at DESC, r.id DESC "
    "LIMIT 1"
    ") lr ON TRUE "
)

# ── Phase 192.2 gap round 1 (CR-01 / DEC-08-A) — the ROW-LEVEL run bit ───────────────
#
# ⚠ THIS CONSTANT IS DELIBERATELY UNSCOPED, AND THAT IS THE WHOLE POINT OF IT EXISTING.
# The lateral one line above answers *have YOU run this*. This answers *has ANYBODY run this*.
# Everything the lateral's docblock argues — ``LEFT``, ``LATERAL … LIMIT 1``, the ``$1``, the
# renames, one constant not three copies — is stated there and is NOT restated here; only what
# is NEW is written down.
#
# ⚠ WHAT IS NEW, AND WHY IT HAD TO BE. ``192.2-VERIFICATION.md`` gap 1 / review **CR-01**
# (BLOCKER): the lateral is correctly caller-scoped, but every downstream artifact rendered its
# NULL as a ROW-LEVEL fact. Measured 2026-08-19, five ``is_system_global`` published rows carry
# **20 / 15 / 11 / 7 / 1** runs belonging to ONE user, and ``/starters`` + ``/published``'s
# global branch serve those same rows to everybody — so every other caller read an explicit
# "Never run" about a workflow that had run twenty times. A caller-scoped fact rendered as a
# row-level one is not merely unhelpful; it is false. THE FIX IS A SECOND FACT, NOT A WIDER
# FIRST ONE — ``r.user_id = $1`` above stays byte-identical (DEC-08-B).
#
# ⚠ THE DISCLOSURE BUDGET, VERBATIM FROM DEC-08-A, AND IT IS OPERATOR-LOCKED. This bit may
# reveal that SOMEBODY ran a workflow the caller CAN ALREADY SEE. It may reveal NOTHING ELSE:
# **no count, no timestamp, no user id, no org id, no status** — ``EXISTS`` and nothing more.
# A future edit that grows this constant a ``count(*)``, a ``MAX(created_at)``, a ``user_id``
# or a ``status`` is a CROSS-TENANT DISCLOSURE, not an enhancement, and
# ``test_library_run_facts.test_the_row_level_bit_discloses_existence_and_nothing_else``
# sweeps this constant's VALUE (never the module source) to say so, with a synthetic positive
# control. Re-open trigger for the trade itself: the first workflow row visible to a caller who
# is not entitled to know it has been exercised at all.
#
# ⚠ WHY IT IS SAFE ON A WORLD-READABLE ROW. It is emitted ONLY for rows the caller can already
# see, because it rides each feed's existing ``WHERE`` — and that predicate is untouched by
# this change (the projection widens; the predicate does not, for the third phase running).
#
# ⚠ IT MUST LIVE IN THE OUTER PROJECTION, NEVER INSIDE THE LATERAL. Folded into
# ``_LAST_RUN_LATERAL_SQL`` it would inherit ``r.user_id = $1`` and answer the same question
# twice — the bug, restated as a fix. It binds NO placeholder, which is why branch B's
# ``${len(params)}`` project filter is not renumbered (T-192.2-35, proved live rather than
# assumed). The inner alias is ``r2``, never ``r``, so it cannot be misread as the lateral's
# correlation name. ⚠ The correlation is ``wd.id`` — all four projection sites alias
# ``workflow_definitions`` as ``wd``, and a MISCORRELATED ``EXISTS`` returns TRUE for EVERY
# ROW, i.e. the exact opposite lie, looking green everywhere. NO INDEX, NO MIGRATION, NO NEW
# COLUMN, NO NEW WRITE — same 228 rows, same recorded re-open trigger at ~10k runs.
_HAS_ANY_RUN_SQL = (
    "EXISTS (SELECT 1 FROM workflow_runs r2 WHERE r2.definition_id = wd.id) AS has_any_run "
)

# harness_audit.event_type CHECK (migration 059 = 9 kinds; migration 069 = +7 emit
# kinds → 16; migration 070 = +6 judge/publish/policy/ask_user-approval kinds → 22;
# migration 114 = +1 armed action-risk pause kind → 23; migration 117 = +1 send-receipt
# kind → 24 total). Validate in code so a typo fails fast in tests, not as a Postgres
# 23514 mid-run (Pitfall 6). MUST stay IN LOCKSTEP with the 069 + 070 + 114 + 117
# CHECK — a mismatch is the exact fail-fast this set exists for (Phase 101.1 D-12 /
# Phase 102 D-12).
#
# BUG-260731-02 (Phase 185): registering a kind HERE is only half the fix. This set
# raises a ValueError before the INSERT; the Postgres CHECK raises a 23514 during it.
# A kind present here but absent from the CHECK moves the failure, it does not remove
# it. ``backend/tests/unit/test_audit_event_registration.py`` now pins this set EQUAL
# to the highest-numbered migration's CHECK body, in both directions — add a kind to
# one layer without the other and that test goes red instead of a live run dying.
_AUDIT_EVENT_TYPES = frozenset(
    {
        # 059 — the 9 original harness lifecycle/gate kinds:
        "phase_started",
        "phase_completed",
        "phase_transition",
        "gate_passed",
        "gate_failed",
        "tool_refused",
        "run_started",
        "run_completed",
        "run_failed",
        # 069 (Phase 101.1 D-12) — the 7 emit-transition kinds:
        "emit_forced",
        "emit_recovered",
        "emit_validated",
        "emit_rejected",
        "emit_rendered",
        "emit_integrity_failed",
        "emit_failed",
        # 070 (Phase 102 GATE-01/QUAL-01) — judge/publish/policy/ask_user-approval receipts:
        "judge_verdict",
        "publish_attempted",
        "publish_blocked",
        "publish_succeeded",
        "policy_applied",
        "validator_ask_user_approved",
        # 114 (Phase 185 GOVERN-03 / BUG-260731-02) — the armed action-risk pause:
        "action_risk_pending",
        # 117 (Phase 190 CONN-02/CONN-03, D-20) — the send receipt: a real consequence,
        # not an intention. Phase 189's D-09 deferred this kind to 190 deliberately,
        # "where it would describe a real consequence"; 190 is the phase that creates one.
        "external_action_sent",
        # 125 (Phase 204 SCHED-02 / D-204-07) — the spend-cap / wall-clock trip. This is
        # the ONLY thing that distinguishes, in the ledger, a run the SYSTEM stopped from
        # a run a PERSON stopped: both terminalize `cancelled` through the identical
        # composition (D-204-03), so without this kind an unattended run killed by its own
        # budget is indistinguishable from a user pressing Stop.
        # ⚠ REGISTERED HERE **AND** IN MIGRATION 125 IN THE SAME COMMIT. Either alone only
        # moves the failure (ValueError <-> Postgres 23514); G2 in
        # tests/unit/test_audit_event_registration.py pins the two sets equal.
        "circuit_breaker_tripped",
    }
)


# ── run creation (Phase 092 MODE-01 / Q5 — the net-new atomic transaction) ───
async def create_workflow_run(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    definition_id: UUID,
    definition: WorkflowDefinition,
    inputs: dict,
    model: str | None,
    user_id: UUID,
    is_golden_run: bool = False,
) -> UUID:
    """Atomically create a workflow run + its phase rows + set the thread anchor.

    The ONLY live-app path that creates a workflow run (RESEARCH Landmine 3 — no
    ``INSERT INTO workflow_phases`` existed anywhere in ``backend/app`` before this).
    All three writes run inside ONE transaction in FK-safe order (Landmine 9):

      1. INSERT workflow_runs (status='active', persists ``inputs``+``model`` —
         SEED-047) → RETURNING id
      2. one INSERT workflow_phases per PhaseSpec, in ``phase_index`` order,
         status='pending'
      3. UPDATE threads.active_workflow_run_id = <new run id>  (the lock anchor)

    The workflow_runs INSERT MUST precede the threads UPDATE because
    ``threads.active_workflow_run_id`` FKs to ``workflow_runs.id`` (full-schema.sql).

    This is a NET-NEW transaction mechanic — no in-file precedent existed; the
    standard asyncpg ``acquire() -> transaction()`` form is lifted here and the
    three writes go through the acquired connection (``con``), not the pool.

    RLS (file header contract): this helper runs as service role; owner-scoping
    lives UPSTREAM in the route (the send_message handler already ownership-checked
    the thread and resolved the definition under the user's RLS). The run-owner
    ``user_id`` (resolved from the route's ``current_user``) IS persisted on the
    workflow_runs row (Phase 092-05 F1) — it is the trusted owner stamp that the
    resume path (_build_resume_context) and every harness_audit write read back.
    ``$N`` placeholders only; ``json.dumps(inputs)`` + ``$3::jsonb`` (this file
    does NOT use a pool JSONB codec — mirror complete_phase :240).

    Phase 102 (D-05 / QUAL-01): ``is_golden_run`` (keyword-only, default False —
    every existing caller stays byte-identical) flags a publish-time VALIDATION
    run (the migration-070 ``workflow_runs.is_golden_run`` column, live on :54322
    via Plan 02). A golden run is a REAL end-to-end run on the project KB whose
    final output the publish-path judge grades (no mocks, no opt-out); the flag
    only marks the row so the receipt VIEW (Phase 107) can distinguish "what good
    looked like at publish approval" from a normal run.

    ── Migration 122 — THE DEFINITION SNAPSHOT, AND WHY IT IS WRITTEN *HERE* ────────────

    ``workflow_runs.definition_snapshot`` is written in the INSERT below, serialized from
    the ``definition`` parameter this function already receives.

    ⚠ THE SITE IS THE WHOLE POINT, not a convenience. The very next statement iterates
    ``definition.phases`` to write this run's ``workflow_phases`` rows, so the snapshot and
    the phase rows are two projections of ONE in-memory object inside ONE transaction. They
    cannot drift apart, and no second read, second query or re-resolution is involved. A
    snapshot taken anywhere else would be a second source and would owe its own proof that
    it matches.

    ⚠ WHAT IT FIXES, measured rather than argued: ``workflow_definitions.definition`` is
    MUTABLE while ``status = 'draft'``, and a draft can be rewritten under a run that
    already has phase rows. On the local database 2026-08-20, **21 of 228 runs point at a
    draft, 14 of those drafts have been edited since, and on 2 the phase ORDER changed** —
    at which point the run surface's ``phase_index`` join (D-188-01) reports each step's
    state as its NEIGHBOUR's. Published definitions are immutable and show zero crossings.
    ``get_workflow_run``'s docstring already promised *"the definition version that RAN"*;
    until this column that promise was protected against the SLUG moving and not against
    the ROW moving.

    ⚠⚠ THE ORIGINAL PARAGRAPH HERE WAS **WRONG ON ITS CENTRAL FACT**, IT SHIPPED, AND THE
    FIRST TWO REAL RUNS PROVED IT. It is quoted in full rather than deleted, because the
    false clause is the whole lesson:

        "⚠ ``json.dumps`` + ``$N::jsonb``, matching ``inputs`` one line above — **this file
         does NOT install a pool JSONB codec.** ``mode="json"`` is REQUIRED, not stylistic
         … ⚠ AND IT MUST LAND AS A JSONB OBJECT, never a JSON string scalar."

    **The file does not install a codec. THE POOL DOES**, and the pool is what this function
    acquires from. ``dependencies._init_pg_connection`` registers a ``jsonb`` codec with
    ``encoder=json.dumps`` on EVERY connection the pool creates (Phase 073 / D-073-06), and
    its own docblock says why: *"Registering here lets call sites pass plain Python
    dicts/lists."* So a call site that hands over an ALREADY-DUMPED STRING gets it dumped a
    SECOND time, and what lands is a jsonb STRING SCALAR containing the JSON text.

    ⚠ MEASURED, NOT REASONED ABOUT (2026-08-20, against the live local database):

      · ``jsonb_typeof(definition_snapshot)`` = ``string`` on **2 of 2** rows written since
        migration 122 — i.e. every row the column has ever held.
      · ``jsonb_typeof(inputs)`` = ``string`` on **230 of 230** rows.
      · ``jsonb_typeof(workflow_definitions.definition)`` = ``string`` on **261 of 291**.
      · Driven directly against asyncpg: with the pool's codec installed, a pre-dumped string
        stores as ``string`` and ``-> 'phases'`` returns ``None``; the plain dict stores as
        ``object`` and ``-> 'phases'`` returns the array. Without the codec BOTH forms store
        as ``object`` — which is exactly why a probe on a bare connection exonerates this code
        and a probe through the pool convicts it.

    **This is the root cause of the recorded "jsonb string-scalar trap"** — the shape that
    makes ``definition->'phases'`` return SQL NULL instead of erroring, and that has now
    produced a confident, vacuous ``0`` in two separate investigations plus a RED
    ``test_migration_122``.

    ⚠ THE FIX IS TO STOP PRE-ENCODING, NOT TO ADD A CAST. ``$7::jsonb`` is fine; the parameter
    is what was wrong. ``mode="json"`` is STILL REQUIRED and for the original reason: the model
    holds ``UUID`` and ``datetime`` members, and the codec's ``json.dumps`` refuses them just
    as the manual one did. So the value handed over is ``model_dump(mode="json")`` — a plain
    dict of JSON-safe primitives — and the codec does the one encode.

    ⚠ SCOPE, STATED SO THE SILENCE IS NOT MISTAKEN FOR AN OVERSIGHT. **Only this column is
    fixed here.** ``inputs`` on the line above, and the four ``definition`` writes elsewhere in
    this file, have the identical defect and are DELIBERATELY LEFT: they have 230 and 261
    rows respectively written in the old shape, and flipping the writer would make new rows
    objects while old rows stay strings — every reader of those columns then needs an audit,
    which is a change with its own blast radius and its own migration question. ``definition_snapshot``
    is fixable alone because it has TWO rows, both from today, and its one reader
    (``api/workflow_runs.py:_coerce_definition``) already accepts BOTH shapes by design. Re-open
    trigger: the next phase that touches ``inputs`` or ``workflow_definitions.definition`` on
    the write path — see ``SEED-190``'s sibling note and ``.planning/STATE.md``.

    ``backend/tests/test_migration_122.py`` asserts ``jsonb_typeof`` on every stored value; it
    went RED on the first two real runs, which is the pin working exactly as written.

    Returns the new workflow_run id.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            run_id = await con.fetchval(
                """
                INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id, is_golden_run, definition_snapshot)
                VALUES ($1, $2, 'active', $3::jsonb, $4, $5, $6, $7::jsonb)
                RETURNING id
                """,
                thread_id,
                definition_id,
                json.dumps(inputs),
                model,
                user_id,
                is_golden_run,
                # ⚠ THE PLAIN DICT, NOT A PRE-DUMPED STRING — see the migration-122 paragraph
                # in this function's docstring. The pool's jsonb codec (`_init_pg_connection`)
                # encodes it; handing over a string gets it encoded TWICE and stores a jsonb
                # STRING SCALAR, which is what the first two real runs did.
                definition.model_dump(mode="json"),
            )
            for ps in sorted(definition.phases, key=lambda p: p.phase_index):
                await con.execute(
                    """
                    INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status)
                    VALUES ($1, $2, $3, 'pending')
                    """,
                    run_id,
                    ps.phase_index,
                    ps.slug,
                )
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1",
                thread_id,
                run_id,
            )
    return run_id


async def list_published_workflows(
    pool: asyncpg.Pool,
    *,
    user_id: UUID,
    project_folder_id: UUID | None = None,
    owned_only: bool = False,
) -> list[dict]:
    """Published workflow definitions visible to a user (the picker feed).

    Mirrors the RESEARCH Q5 RLS-mirroring predicate: ``status='published'`` AND
    (``is_system_global`` OR ``created_by = $1``) — a user never sees another user's
    unpublished or private definitions (T-092-07). Returns the id/slug/name the
    picker needs. ``$N`` placeholders only.

    PROJECT BINDING (Phase 098 / PROJ-01, D-03): when ``project_folder_id`` is
    supplied, the result is additionally filtered to definitions whose JSONB
    ``definition->>'project_folder_id'`` equals that folder — the queryable
    half of "a project (folder) owns a library of workflows". This is a
    JSONB-path predicate on the existing ``definition`` column: NO new column,
    NO expression index, ZERO migration (RESEARCH §5/§6 — sufficient at current
    scale). The user-scope clause is evaluated FIRST and the project filter is
    AND-appended, so it can only NARROW, never widen, visibility (T-098-09 /
    V4 — a caller cannot see another user's private workflow by guessing a
    ``project_folder_id``). The value is bound as a positional ``$N`` parameter
    as ``str(project_folder_id)`` because ``definition->>'key'`` yields TEXT —
    never string-interpolated into the SQL (T-098-10 / V5; only the placeholder
    INDEX ``$N`` — a code-derived int — is f-string-built). When omitted the
    query is byte-identical to the pre-098 full published list (backward
    compatible).

    SCOPED NARROWING (Phase 143 / WF-01, D-143-2b): the additive keyword-only
    ``owned_only`` flag (default ``False``) narrows the predicate to the caller's
    OWN published rows (``created_by = $1``, dropping the bare ``is_system_global``) so
    the Workflows-page Published shelf stops double-rendering the curated globals
    that now live in their own Starters shelf (D-143-2a end state). This is a
    SCOPED narrowing, NOT a blanket change: the DEFAULT ``owned_only=False`` keeps
    the exact ``(is_system_global = true OR created_by = $1)`` predicate every OTHER caller
    relies on — the composer Harness picker, ``WorkspacePanel`` run-soul, and
    ``threads.py`` kickoff all NEED the global rows (Pitfall 3). Mirrors the
    ``is_golden_run=False`` keyword-only precedent: default OFF = byte-identical.
    """
    if owned_only:
        # D-143-2b — the Workflows-page Published shelf only; drop the bare
        # is_system_global so curated globals live solely in the Starters shelf.
        #
        # Phase 192 (LIB-01 / D-04): ``created_by`` + ``is_system_global`` are projected
        # FOR SERVER-SIDE COMPUTATION ONLY. The API layer consumes the raw ``created_by``
        # to compute the one bit ``PublishedWorkflow.is_mine`` and NEVER serializes it —
        # this pool bypasses RLS, so whatever leaves the API layer is what the caller gets.
        # The projection widens; the predicate does NOT.
        #
        # Phase 192.1 (LIB-05 / D-15): ``updated_at`` joins the same projection, and the
        # same sentence applies verbatim — THE PROJECTION WIDENS; THE PREDICATE DOES NOT.
        # It is the recency half of the library's identity line ("changed <rel>"), an
        # ADDITIVE column on an existing NOT NULL field (full-schema.sql:1941) kept fresh
        # by the ``workflow_definitions_set_updated_at`` trigger — no migration, no new
        # column, and not one byte of the WHERE / ORDER BY / $N binding below is touched.
        #
        # Phase 192.2 (LIB-06 / D-07): ``last_run_at`` + ``last_run_status`` join that SAME
        # projection, and THE SENTENCE ABOVE APPLIES VERBATIM ONCE MORE — the projection
        # widens; the predicate does NOT. The data is 228 rows that already exist in
        # ``workflow_runs``, so there is no migration, no new column and no new write here
        # either; what is new is only that the feed finally READS them.
        # ⚠ The one thing 192.1's sentence does NOT cover, because ``updated_at`` needed no
        # join at all: this arrives through ``_LAST_RUN_LATERAL_SQL``, and a JOIN is the one
        # edit that can move rows INTO a result set. It is ``LEFT`` so never-run rows survive
        # and ``LATERAL … LIMIT 1`` so no row multiplies, it reuses the ``$1`` bound below
        # rather than adding a placeholder, and it is owner-scoped so a world-readable global
        # row cannot leak another caller's activity. The full argument is on the constant.
        #
        # Phase 192.2 gap round 1 (CR-01): ``has_any_run`` joins the projection LAST — the
        # existing columns, then the two CALLER-SCOPED run columns, then the one ROW-LEVEL
        # bit. It is a projection-only ``EXISTS``: it binds no placeholder, touches no WHERE
        # and no ORDER BY, and cannot move a row into or out of this result set.
        sql = (
            "SELECT id, slug, name, definition, created_by, is_system_global, updated_at, "
            "lr.last_run_at, lr.last_run_status, "
            + _HAS_ANY_RUN_SQL
            + "FROM workflow_definitions wd "
            + _LAST_RUN_LATERAL_SQL
            + "WHERE status = 'published' AND created_by = $1"
        )
    else:
        sql = (
            # Phase 103-06 (REQ-7 D9/D10): the Workflows page card derives the
            # client-side strictness tier (deriveTier) + the phase-type chain from
            # the REAL definition JSONB, so the list additionally returns
            # ``definition``. This is purely ADDITIVE — the pre-103 id/slug/name
            # picker callers ignore the extra column (asyncpg's pool codec decodes
            # the JSONB to a dict).
            #
            # Phase 192 (LIB-01 / D-04): ``created_by`` + ``is_system_global`` are projected
            # FOR SERVER-SIDE COMPUTATION ONLY — consumed inside the API layer to compute
            # ``is_mine``, never serialized. Projection only; the predicate is untouched.
            #
            # Phase 192.1 (LIB-05 / D-15): ``updated_at`` joins that projection. The
            # projection widens; the predicate does NOT — this branch's
            # ``(is_system_global = true OR created_by = $1)`` is byte-identical to what
            # shipped, and ``test_dual_mode_wiring.py:256`` asserts that exact substring.
            #
            # Phase 192.2 (LIB-06 / D-07): ``last_run_at`` + ``last_run_status`` join it too,
            # through the shared ``_LAST_RUN_LATERAL_SQL``. ⚠ THIS BRANCH IS THE ONE WHERE THE
            # OWNER-SCOPE ON THE LATERAL EARNS ITS KEEP: it is the branch that returns
            # ``is_system_global`` rows to EVERY caller, and five of those globals carry
            # 20 / 15 / 11 / 7 / 1 real runs belonging to ONE user. An unscoped lateral here
            # would be a cross-tenant read of run activity on a world-readable row. The
            # predicate itself is still byte-identical, and the join adds columns only.
            #
            # ⚠ Phase 192.2 gap round 1 (CR-01): ``has_any_run`` is appended here, and THIS IS
            # THE BRANCH THE DEFECT WAS MEASURED ON. It returns the ``is_system_global`` rows
            # to EVERY caller, and the five carrying 20 / 15 / 11 / 7 / 1 runs read an explicit
            # "Never run" for everybody but the one user who ran them. The scoped pair stays
            # scoped; the unscoped bit says only that SOMEBODY has — existence and nothing else
            # (DEC-08-A). ⚠ It binds no placeholder, which is precisely why the ``$2`` project
            # filter appended below is not renumbered.
            "SELECT id, slug, name, definition, created_by, is_system_global, updated_at, "
            "lr.last_run_at, lr.last_run_status, "
            + _HAS_ANY_RUN_SQL
            + "FROM workflow_definitions wd "
            + _LAST_RUN_LATERAL_SQL
            + "WHERE status = 'published' AND (is_system_global = true OR created_by = $1)"
        )
    params: list = [user_id]
    if project_folder_id is not None:
        params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
        sql += f" AND definition->>'project_folder_id' = ${len(params)}"
    # ── SITE 1 of 3 — Phase 193.2 (BUG-260815-02, D-15 / D-16): RECENCY, not alphabet ──
    #
    # ⚠ THE DIVERGENCE BELOW IS A DECISION, NOT AN INCONSISTENCY, AND THIS IS WHERE IT IS
    # RECORDED SO A LATER READER FINDS THE REASONING RATHER THAN A PUZZLE. This feed and
    # ``list_draft_workflows`` — the two that hold the author's OWN work — order by
    # ``updated_at DESC``. ``list_starter_workflows`` — the curated catalogue the author
    # did NOT write — deliberately KEEPS ``ORDER BY name``, because "the most recently
    # updated starter" is meaningless to someone browsing a shelf of examples.
    # ``BUG-260815-02`` explicitly warns *"change them together or the feeds disagree"* and
    # this decision (D-16) deliberately does NOT — accepted with eyes open, on the recorded
    # condition that the divergence lives in the code. Do not "tidy" it back to uniformity:
    # that restores the blocking defect. Pinned by
    # ``test_the_d16_divergence_is_recorded_at_all_three_sites``.
    #
    # THE DEFECT (``BUG-260815-02``, severity `blocking`): a just-published workflow was
    # UNFINDABLE. The AI names the workflow, so the author does not know the name they are
    # looking for, and all three feeds sorted alphabetically — nothing anywhere surfaced the
    # thing that had just changed.
    #
    # WHY ``updated_at`` AND NOT ``created_at`` (D-15): the column is already on the wire
    # and already consumed by ``relativeChanged``'s nine bands
    # (``library/libraryFilter.ts:86`` and `:112`), so the card's "changed <rel>" text and
    # the list order read the SAME column and agree BY CONSTRUCTION rather than by
    # discipline. And on THIS feed the two candidates coincide exactly: the publish flip is
    # an ``UPDATE`` and ``workflow_definitions_set_updated_at`` is an unconditional
    # ``BEFORE UPDATE … FOR EACH ROW`` trigger, after which
    # ``workflow_definitions_block_published`` freezes the row — so here
    # ``ORDER BY updated_at DESC`` IS ``ORDER BY publish-time DESC``, and D-15's rejection
    # of ``created_at DESC`` costs nothing at all.
    #
    # WHAT IS PRESERVED — and on this pool that is the whole safety argument: NOT ONE BYTE
    # of the two ``WHERE`` branches, the ``params`` list or the ``$N`` binding above is
    # touched. This pool bypasses RLS, so the predicate IS the access boundary; the
    # ``ORDER BY`` is appended AFTER the predicate and AFTER the ``$N`` project filter, so
    # it cannot widen visibility. Both clauses are static literals — no user input reaches
    # the sort. Pinned by the three ``*_predicate*_byte_identical_to_what_shipped`` cases.
    #
    # ⚠ SHARED-CONSUMER CONSEQUENCE, STATED HERE RATHER THAN DISCOVERED LATER — and it is
    # unique to THIS site. With the DEFAULT ``owned_only=False`` this feed is not just the
    # Workflows-page Published shelf: it also serves the **composer's Harness workflow
    # picker**, **``WorkspacePanel``'s run-soul** and **``threads.py``'s kickoff** (`:97`
    # imports it). All three therefore move from alphabetical to recency. That is
    # defensible — recency is arguably better in a picker too — but it is a user-visible
    # change OUTSIDE the library. MEASURED at the time of the change: no test and no
    # frontend module asserts alphabetical order for any of those three surfaces.
    #
    # NO MIGRATION, and the evidence rather than the assurance: there is no index on
    # ``name`` either, so the shipped sort was ALREADY unindexed and the plan shape is
    # unchanged. ``workflow_definitions`` is 225 rows; the largest single feed measured is
    # 118. The precedent is recorded twenty lines up in this same docstring — "NO
    # expression index, ZERO migration … sufficient at current scale". No file under
    # ``supabase/migrations/`` is added by this phase.
    #
    # ⚠ AMENDED 2026-08-15 (code review ``WR-03``) — ``, id DESC`` IS A CORRECTNESS FIX, NOT
    # A TIDY-UP, AND IT IS RECORDED BESIDE THE PARAGRAPHS ABOVE RATHER THAN OVER THEM.
    # ``updated_at`` is NOT unique and Postgres' ``now()`` is TRANSACTION-scoped, so every
    # row touched by one migration or one bulk update carries an identical timestamp.
    # Censused against the live local DB (``127.0.0.1:54322``, 225 rows) on the day of the
    # amendment: 39 published rows share ``2026-07-18 20:43:42.856183+00`` (and 2 more share
    # another), 24 draft rows share the same instant. Within a tie Postgres guarantees NO
    # order, so a THIRD of the library was free to reshuffle between two fetches — on the
    # very feed whose purpose is "find the thing that just changed". The clause this
    # replaced was total in practice under ``ORDER BY name`` (names are near-unique) and
    # stopped being total the moment the sort key became a timestamp.
    #
    # WHY ``id``: it is this table's PRIMARY KEY (``workflow_definitions_pkey``) — therefore
    # NOT NULL and unique, measured against ``pg_constraint``/``pg_attribute`` rather than
    # assumed — and it is ALREADY in the SELECT list above, so the projection does not widen
    # by one byte. No migration, no index (there is none on ``updated_at`` either, so nothing
    # regresses), no schema change.
    #
    # ⚠ IT ORDERS WITHIN TIES AND NOWHERE ELSE — measured, not argued. Both clauses were
    # driven over all three live predicate shapes (drafts 78 rows, owned published 28,
    # published-with-globals 91): the sequence of ``updated_at`` VALUES is identical with and
    # without the tiebreaker, the top row is unchanged, every position that moved sits inside
    # a tie group (zero outside), and two consecutive runs agree exactly. D-15's recency is
    # therefore untouched — a freshly published row holds a unique fresh timestamp, is in no
    # tie, and still lands first. Pinned by
    # ``test_the_two_author_feeds_order_by_recency_and_starters_stay_alphabetical``, whose
    # needle is the FULL clause on purpose: ``"ORDER BY updated_at DESC"`` is a PREFIX of
    # this one, so the shorter needle stays green against a feed with no tiebreaker at all.
    sql += " ORDER BY updated_at DESC, id DESC"
    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


async def list_starter_workflows(
    pool: asyncpg.Pool, *, user_id: UUID | None = None
) -> list[dict]:
    """Curated global starters — the Starters shelf feed (Phase 143 / WF-01, D-143-2).

    Returns the ``status='published' AND is_system_global=true`` definitions carrying the
    JSONB curation marker ``definition->>'category' = 'starter'`` — the 3 seeded
    starters (Plan 03), NOT the 5 mig-061 dev scaffolds (which lack the marker so
    they are excluded from this shelf, D-143-2a). Mirrors the
    ``definition->>'project_folder_id'`` JSONB-path precedent in
    ``list_published_workflows``.

    NO user scope: ``is_system_global`` published rows are world-readable by the mig-056
    SELECT policy (T-143-01 — no private row can appear); ``category='starter'``
    narrows to curated. The ``'starter'`` literal is a CONSTANT predicate, not user
    input, so it is a ``$``-free literal — the ``$N``-only binding rule (T-073-02 /
    T-091-03) applies only to user-supplied values, of which this query has none
    (V5 — no injection surface). Returns the id/slug/name/definition the shelf card
    needs (mirrors ``list_published_workflows``' additive ``definition`` column).

    ⚠ THE KEYWORD-ONLY ``user_id`` (Phase 192.2 / LIB-06, D-07) IS NOT A SCOPE ON THE SHELF —
    IT IS THE SCOPE ON THE RUN FACTS, and the distinction is the whole security argument for
    this signature change. The shelf's own three-clause predicate is untouched and still
    returns the SAME curated globals to every caller; the id is bound as ``$1`` and consumed
    ONLY inside ``_LAST_RUN_LATERAL_SQL``, so it decides whose ``last_run_at`` /
    ``last_run_status`` this caller sees on a row everybody can see. The Starters shelf needs
    it for the reason RESEARCH C-6 records: ``PublishedWorkflow`` is ONE model serving TWO
    feeds, so a field added for ``/published`` and not mirrored here leaves every starter card
    silently missing its run facts while the type says it has them (192.1 hit this exact trap
    with ``updated_at``). Measured 2026-08-19: the live shelf is 3 rows, exactly ONE of which
    has ever been run — both arms are real.

    ⚠ DEFAULTED TO ``None``, AND THAT DEFAULT IS FAIL-CLOSED RATHER THAN CONVENIENT. With no
    id the bind is SQL NULL, ``r.user_id = $1`` is never true, and every row comes back with
    both facts NULL — "we do not know", never "everyone's runs". The default exists so the
    shipped positional call ``list_starter_workflows(pool)`` (``test_starter_workflows.py``)
    stays valid; it can only ever REMOVE information.
    """
    # Phase 192 (LIB-01 / D-04): ``created_by`` + ``is_system_global`` are projected FOR
    # SERVER-SIDE COMPUTATION ONLY — ``get_starter_workflows`` computes ``is_mine`` from the
    # raw ``created_by`` and never serializes it. Projection only; the predicate is untouched.
    #
    # Phase 192.1 (LIB-05 / D-15): ``updated_at`` joins that projection. The projection
    # widens; the predicate does NOT — the three-clause WHERE and the ``ORDER BY name``
    # below are byte-identical to what shipped. Note this feed serves the SAME
    # ``PublishedWorkflow`` model as ``/published`` (RESEARCH C-6: one model, two feeds),
    # so both SELECT lists must carry the column or one shelf renders no "changed" segment.
    #
    # ── SITE 2 of 3 — Phase 193.2 (BUG-260815-02, D-16): THIS ONE STAYS ALPHABETICAL ──
    #
    # ⚠ THE ``ORDER BY name`` BELOW IS DELIBERATE AND IS THE ONLY ONE LEFT IN THIS MODULE.
    # Its two siblings — ``list_published_workflows`` and ``list_draft_workflows`` — moved to
    # ``ORDER BY updated_at DESC`` in Phase 193.2 to fix ``BUG-260815-02`` (severity
    # `blocking`: a just-published workflow was unfindable, because the AI names it and every
    # feed sorted by that name). **This feed did not move, and that asymmetry is the decision
    # rather than an oversight.** These rows are the CURATED starters — a fixed catalogue the
    # author did not write and does not edit — so "the most recently updated starter" carries
    # no information for someone browsing examples, while a stable alphabet does. Recency
    # answers "what did I just do?"; nobody asks that of a shelf they did not touch.
    #
    # ``BUG-260815-02`` warns *"change them together or the feeds disagree"* and D-16
    # deliberately does NOT — accepted with eyes open, on the recorded condition that the
    # divergence lives in the code, which is what this comment is. **Do not "fix" the
    # inconsistency by making this feed match its siblings**: uniformity here buys nothing and
    # a later reader who quietly restores it is the failure mode
    # ``test_the_d16_divergence_is_recorded_at_all_three_sites`` exists to catch.
    #
    # NOTHING ELSE MOVES: the three-clause ``WHERE`` and the whole projection are still
    # byte-identical to what shipped (this pool bypasses RLS, so that predicate is the access
    # boundary), and no migration is added — there is no index on ``name`` and never was.
    #
    # Phase 192.2 (LIB-06 / D-07): ``last_run_at`` + ``last_run_status`` join that projection
    # via the shared ``_LAST_RUN_LATERAL_SQL``. ⚠ NOTHING ABOUT THE SHELF ITSELF MOVES — the
    # three-clause WHERE is byte-identical, ``ORDER BY name`` is byte-identical (D-16's
    # divergence stands), and the ``$1`` bound below is read ONLY by the lateral. It is the
    # ONE constant on purpose: a lateral inlined here would carry ``id DESC`` into this
    # function's source and red ``test_workflows_updated_at``'s alphabetical-shelf fence with
    # a SUBQUERY's ordering, which is not this shelf's ordering. See the constant's own
    # comment; ``test_library_run_facts.test_the_starters_shelf_ordering_is_untouched``
    # re-pins both halves so neither is left to that coincidence.
    #
    # ⚠ Phase 192.2 gap round 1 (CR-01): ``has_any_run`` is appended here TOO, and this shelf
    # is the reason the operator chose the row-level fact over rewording the caller-scoped one
    # (DEC-08-A). It is WORLD-READABLE and it is the shelf a newcomer meets first: measured
    # 2026-08-19 it is 3 rows, ONE of which has ever been run — so for every caller but that
    # runner, LIB-06's own question (*does this one work*) went unanswered on the exact rows it
    # most needed answering. ⚠ ``ORDER BY name`` and the three-clause WHERE stay byte-identical;
    # the bit is projection-only and binds nothing.
    rows = await pool.fetch(
        "SELECT id, slug, name, definition, created_by, is_system_global, updated_at, "
        "lr.last_run_at, lr.last_run_status, "
        + _HAS_ANY_RUN_SQL
        + "FROM workflow_definitions wd "
        + _LAST_RUN_LATERAL_SQL
        + "WHERE status = 'published' AND is_system_global = true "
        "AND definition->>'category' = 'starter' "
        "ORDER BY name",
        user_id,
    )
    return [dict(r) for r in rows]


# ── single-definition read + publish flip (Phase 102 / QUAL-01, D-07) ────────
async def get_definition(
    pool: asyncpg.Pool, definition_id: UUID, *, user_id: UUID
) -> dict | None:
    """Load ONE workflow definition (the OWNER's drafts INCLUDED) the user may publish.

    The publish path (Plan 05) loads a DRAFT before flipping it — so unlike
    ``list_published_workflows`` this read does NOT filter ``status='published'``
    for the OWNER; it returns the owner's draft (or published) row for their id.

    OWNER-SCOPED for DRAFTS (V4 / T-102-05-01 + WR-02 / T-102-09-01): a row is
    readable only when ``created_by = $2`` (the true owner — drafts included) OR
    it is a GLOBAL PUBLISHED row (``is_system_global = true AND status = 'published'``).
    The bare ``OR is_system_global = true`` is GONE: a non-owner can NO LONGER load (and
    therefore can NOT golden-run / publish-flip) another user's GLOBAL DRAFT — that
    was a real elevation-of-privilege (a privileged state change by a non-owner). A
    non-owner now gets ``None`` for ANY draft (including a global draft); the publish
    endpoint converts ``None`` to a uniform 404 so a not-found and a cross-user /
    non-owned-draft id are indistinguishable (no existence leak — T-102-05-06 /
    T-102-09-01, the 101.1-09 404-collapse precedent). ``$N`` placeholders only.

    Returns ``{id, slug, version, name, status, definition, created_by, token}`` or
    ``None``. ``definition`` is the JSONB the caller ``model_validate``s into a
    ``WorkflowDefinition`` (asyncpg's pool codec decodes it to a dict).

    ``token`` (Phase 186 / D-186-07) is the ADDITIVE opaque concurrency token — the
    same ``CONCURRENCY_TOKEN_SQL`` expression the guarded UPDATE compares against, so a
    caller that reads here and writes there can never be comparing two renderings. It is
    a ``str``; nothing may parse it. Publish stage 0 captures it here (186-02).
    """
    row = await pool.fetchrow(
        f"SELECT id, slug, version, name, status, definition, created_by, "
        f"{CONCURRENCY_TOKEN_SQL} AS token "
        f"FROM workflow_definitions "
        f"WHERE id = $1 AND (created_by = $2 OR (is_system_global = true AND status = 'published'))",
        definition_id,
        user_id,
    )
    return dict(row) if row is not None else None


async def publish_definition(
    pool: asyncpg.Pool, definition_id: UUID, *, token: str | None = None
) -> int:
    """Flip a definition ``status`` draft -> published (D-07), RETURNING the version.

    The ONLY draft->published flip site. Mirrors ``finish_run``'s
    ``UPDATE ... SET ... WHERE id=$1`` status-flip shape (``$N`` only). The
    ``workflow_definitions_block_published_update`` immutability trigger ALLOWS
    this transition (it only blocks an UPDATE where ``OLD.status='published'`` —
    a published->edit), so the draft->published flip is the allowed path while a
    published row stays frozen (T-102-05-05 / the 091 immutability invariant).

    TWO SENTINELS, NEVER ONE (Phase 186 / D-186-10):

      ``-1``  UNCHANGED, the WR-03 case — not a draft / already published / not found.
              The ``status='draft'`` WHERE guard makes a double-publish a no-op
              (idempotent): a re-flip finds 0 matching rows. The caller
              (``publish_service`` stage 0) has already owner-checked + state-checked,
              so this is a defensive sentinel, not the happy path.
      ``-2``  NEW — the row is STILL a draft, but it MOVED since the caller's stage-0
              read: the concurrency-token conjunct matched 0 rows.

    WHAT A COLLAPSED ``-1``/``-2`` WOULD LIE ABOUT — this is the whole reason there are
    two. ``-1`` is *"someone already published this"*. ``-2`` is *"the thing we spent a
    golden run checking is not the thing we were about to publish"*. They are different
    sentences to the author and different receipts in the governance trail: routing a
    ``-2`` to ``already_published`` would tell an author that somebody else published
    their workflow, which did not happen (the T-185-04-01 false-receipt rule).

    ``token`` IS OPTIONAL, AND THAT IS A COMPATIBILITY DECISION, NOT AN ACCIDENT. When it
    is ``None`` the statement is BYTE-IDENTICAL to the pre-186 one and ``-2`` is
    unreachable — which is what keeps the shipped POSITIONAL two-argument callers
    (``test_103_tweak_fork.py:89,101``) correct with zero edits, and mirrors the route's
    optional ``If-Match``: an absent token means "no opinion about which version I am
    flipping", exactly as it did before this phase. ``publish_service`` supplies one via
    ``row.get("token")``, so a caller whose stage-0 read predates the token degrades to
    the old behaviour rather than raising.

    NOT WRAPPED IN A TRANSACTION WITH ANY OTHER UPDATE — see ``CONCURRENCY_TOKEN_SQL``'s
    docblock (Pitfall 9): ``now()`` is TRANSACTION time, so a sibling UPDATE in the same
    transaction would render an identical token and silently disable this guard.

    Returns the published ``version`` (for the D-08 success verdict), or ``-1`` / ``-2``.
    """
    if token is None:
        row = await pool.fetchrow(
            "UPDATE workflow_definitions SET status = 'published' "
            "WHERE id = $1 AND status = 'draft' RETURNING version",
            definition_id,
        )
        # No token was supplied, so the token conjunct is absent and -2 is unreachable:
        # a 0-row flip can only be the WR-03 case. Today's answer, unchanged.
        return row["version"] if row is not None else -1

    row = await pool.fetchrow(
        f"UPDATE workflow_definitions SET status = 'published' "
        f"WHERE id = $1 AND status = 'draft' AND {CONCURRENCY_TOKEN_SQL} = $2 "
        f"RETURNING version",
        definition_id,
        token,
    )
    if row is not None:
        return row["version"]
    # 0 rows — WHICH conjunct failed? One probe. It needs NO owner clause, and the reason
    # is worth stating rather than leaving to inference: the CALLER (``publish_service``
    # stage 0) has already owner-checked via ``get_definition``, this function is not
    # reachable from any un-owner-checked path, and the probe returns a bare ``1`` — never
    # a row's contents — so it discloses nothing a caller who reached here does not have
    # (T-186-02-02, accepted).
    still_a_draft = await pool.fetchval(
        "SELECT 1 FROM workflow_definitions WHERE id = $1 AND status = 'draft'",
        definition_id,
    )
    return -2 if still_a_draft else -1


# ── draft CRUD (Phase 103 / REQ-1 / WFAUTH-01) ───────────────────────────────
# The authoring substrate the Workflows page (Plan 06) + Builder (Plan 04) sit on.
# Mirror the in-file owner-scoped ``$N``-only precedent (get_definition /
# list_published_workflows / create_workflow_run). The service-role engine bypasses
# RLS, so EVERY query self-scopes ``created_by = $N`` (a second user's draft is
# absent — T-103-01-01). ``$N`` placeholders only (no f-string on SQL).
#
# AMENDED, Phase 186 (D-186-07) — the ONE exception, stated here so a source grep for
# "no f-string on SQL" lands on the amendment rather than on a rule that now reads as
# violated: ``CONCURRENCY_TOKEN_SQL`` is a MODULE-LEVEL CODE LITERAL containing no user
# input, spliced into these queries' f-strings. It is not an interpolated value, and
# every VALUE below still travels as ``$N`` — including the token itself, which is bound
# as ``$5`` in the guarded UPDATE. Nothing about the injection posture changed.
async def create_workflow_definition(
    pool: asyncpg.Pool, *, definition: WorkflowDefinition, user_id: UUID
) -> dict:
    """INSERT a new DRAFT definition, RETURNING ``{id, version}`` (REQ-1 create).

    Server-enforced invariants (T-103-01-03): ``status='draft'``, ``is_system_global=false``,
    ``created_by=user_id`` are bound LITERALLY/by the trusted owner id — never from the
    client body (the route forces ``body.status='draft'`` too; this is the second
    backstop). The ``definition`` JSONB is ``json.dumps(definition.model_dump(mode="json"))``
    + ``$N::jsonb`` (mirror create_workflow_run — this file uses no pool JSONB codec).

    Tweak fork (REQ-7 / Pitfall 6): a fork is just this INSERT with
    ``definition.version = published_N + 1`` and the SAME slug — the frozen published
    row is NEVER UPDATEd. ``UNIQUE(slug, version)`` (migration 056) keeps versions
    distinct.

    Returns ``{id, version, token}`` — ``token`` is the Phase 186 (D-186-07) opaque
    concurrency token of the row as just inserted, so the client can chain its first
    autosave PATCH without a re-read.
    """
    row = await pool.fetchrow(
        f"INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
        f"VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, false) "
        f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token",
        definition.slug,
        definition.version,
        definition.name,
        json.dumps(definition.model_dump(mode="json")),
        user_id,
    )
    return dict(row)


async def list_draft_workflows(pool: asyncpg.Pool, *, user_id: UUID) -> list[dict]:
    """The caller's OWN drafts (the Workflows page drafts shelf — D-103-4).

    Owner-scoped ONLY (``status = 'draft' AND created_by = $1``) — a second user's
    draft is ABSENT (T-103-01-01 EoP; the service role bypasses RLS so the WHERE is
    the boundary). Mirrors ``get_definition``'s owner-scope shape, narrowed to drafts.
    ``$N`` placeholders only. Returns the id/slug/version/name the shelf needs.
    """
    rows = await pool.fetch(
        # Phase 103-06 (REQ-7 D9/D10): also return ``definition`` so the drafts
        # shelf card can derive the tier badge + phase chain client-side (additive;
        # the pre-103 id/slug/version/name shelf callers ignore the extra column).
        # Phase 186 (D-186-07): and ``token``, so the Open-a-draft path arrives in the
        # builder already holding a concurrency token — otherwise the first autosave
        # would have to guess one, or write unguarded.
        #
        # Phase 192.1 (LIB-05 / D-15): and a SEPARATE ``updated_at``. The projection
        # widens; the predicate does NOT.
        #
        # ⚠ D-16 IS A FENCE, NOT ADVICE, AND THIS LINE IS WHERE IT BINDS. ``token`` on the
        # very same row is ALREADY ``updated_at`` in disguise —
        # ``CONCURRENCY_TOKEN_SQL`` (:93-95) is
        # ``to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`` — so
        # the cheap-looking move is to reuse it and skip this column. DO NOT. The token is
        # OPAQUE by contract (``api.ts:3334-3345`` forbids parsing it): Postgres keeps
        # MICROSECONDS and a JS date value keeps only milliseconds, so a
        # parsed-and-re-rendered token is truncated, matches ZERO rows, and every later
        # save then refuses as stale — probed against the live database 2026-08-01. Two
        # columns off one source field is the correct shape: one the server compares
        # byte-for-byte, one the client may format.
        #
        # ── SITE 3 of 3 — Phase 193.2 (BUG-260815-02, D-15 / D-16): RECENCY ────────────
        #
        # ⚠ TWO DIFFERENT DECISIONS SHARE THE ID ``D-16`` ON THIS ONE FUNCTION, AND THE
        # AMBIGUITY IS NAMED HERE RATHER THAN LEFT FOR A READER TO TRIP OVER. Twelve lines
        # up, "⚠ D-16 IS A FENCE, NOT ADVICE" is **Phase 192.1's** D-16 — *the opaque token
        # is not the timestamp*. The ``D-16`` in this block is **Phase 193.2's** — *the two
        # author feeds order by recency and the starters shelf does not*. Both bind; they
        # are unrelated. ``BUG-260815-02`` is the token that disambiguates them, which is
        # why ``test_the_d16_divergence_is_recorded_at_all_three_sites`` asserts it: a bare
        # ``D-16`` needle was MEASURED to pass on this function against the PRE-change
        # source, satisfied entirely by 192.1's comment about something else.
        #
        # THE CHANGE: ``ORDER BY name`` → ``ORDER BY updated_at DESC``. This feed and
        # ``list_published_workflows`` hold the author's OWN work, so the row that just
        # changed belongs at the top; ``list_starter_workflows`` keeps the alphabet (D-16).
        # ``BUG-260815-02`` (severity `blocking`) is a just-published workflow being
        # unfindable — the AI names it, so the author cannot search for a name they never
        # chose.
        #
        # WHY THIS COLUMN (D-15): ``updated_at`` is already on the wire and already drives
        # ``relativeChanged``'s nine bands (``library/libraryFilter.ts:86``, `:112`), so the
        # card's "changed <rel>" text and the row order read the same column and agree by
        # construction. ⚠ And note what is NOT used: the ``token`` alias on this very row is
        # ``updated_at`` in disguise, and sorting by it would be a string sort over a
        # ``to_char`` render — the sort reads the real ``timestamptz`` column, which is the
        # same two-columns-off-one-field rule 192.1's D-16 states directly above.
        #
        # WHAT IS PRESERVED: the ``WHERE status = 'draft' AND created_by = $1`` owner scope
        # and the ``CONCURRENCY_TOKEN_SQL`` projection are byte-identical to what shipped —
        # the service role bypasses RLS, so that predicate is the boundary, and the sort key
        # is appended after it as a static literal with no user input. No migration: there
        # is no index on ``name`` either, the table is 225 rows, and the largest feed
        # measured is 118.
        #
        # ⚠ AMENDED 2026-08-15 (code review ``WR-03``) — the same amendment as SITE 1, for
        # the same measured reason, recorded BESIDE the paragraphs above rather than over
        # them. ``updated_at`` is not unique and ``now()`` is transaction-scoped: **24 draft
        # rows on the live local DB share one instant** (``2026-07-18 20:43:42.856183+00``),
        # and Postgres guarantees no order inside a tie. ``id`` is the PRIMARY KEY — NOT
        # NULL, unique, and already in the SELECT list above — so the sort becomes total
        # with no projection change, no index and no migration. Measured over this feed's
        # own live predicate (78 rows): the ``updated_at`` value sequence is unchanged, the
        # top row is unchanged, every moved position is inside a tie group, and repeated
        # runs agree. ⚠ And note again what is NOT used as the tiebreaker: ``token`` on this
        # very row is ``updated_at`` in disguise, so it would break ties by the same field
        # that created them — ``id`` is the only column here that is unique by construction.
        #
        # ── Phase 192.2 (LIB-06 / D-07) — the run facts join this projection too ──────
        #
        # ⚠ A DRAFT CAN HAVE RUNS, AND THAT IS THE POINT RATHER THAN AN EDGE CASE. The
        # publish gauntlet's GOLDEN RUN is a real ``workflow_runs`` row against a draft, and
        # the live DB carries drafts with 3, 2 and 2 of them. "Your test run failed" is
        # exactly the answer LIB-06 asks the library to give, so no ``is_golden_run`` filter
        # is applied — a golden run IS a run of this draft.
        #
        # ⚠ AND NOTE WHICH COLUMN IS **NOT** BEING REUSED, because this function already
        # carries the identical trap twice above. ``token`` is ``updated_at`` in disguise and
        # ``updated_at`` is the DRAFT's edit time — neither is a run time, and a card that
        # showed "changed 2 minutes ago" as "ran 2 minutes ago" would be lying about the one
        # fact this phase exists to tell the truth about. ``last_run_at`` is the RUN's own
        # ``created_at``, from a different table.
        #
        # The owner scope below is untouched and the lateral is scoped to the SAME ``$1``, so
        # this feed's answer cannot widen: a caller sees their own drafts and their own runs
        # of them, exactly as before plus two columns.
        #
        # ⚠ Phase 192.2 gap round 1 (CR-01): ``has_any_run`` is appended here for CONSISTENCY
        # rather than because this shelf can lie the way the two published ones can — a draft
        # is owner-scoped, so on this feed the caller IS the only person with runs and the bit
        # agrees with ``last_run_at`` today. It is projected anyway because the library speaks
        # ONE language across its three shelves, and because "today the two agree" is an
        # UNSTATED invariant nothing enforces: the publish gauntlet's golden run is written by
        # the run lifecycle, not by the shelf. ⚠ And it is a FOURTH time-shaped-adjacent fact
        # that is NOT ``token`` and NOT ``updated_at``; see the paragraph above.
        f"SELECT id, slug, version, name, definition, {CONCURRENCY_TOKEN_SQL} AS token, updated_at, "
        f"lr.last_run_at, lr.last_run_status, "
        + _HAS_ANY_RUN_SQL
        + f"FROM workflow_definitions wd "
        + _LAST_RUN_LATERAL_SQL
        + f"WHERE status = 'draft' AND created_by = $1 "
        f"ORDER BY updated_at DESC, id DESC",
        user_id,
    )
    return [dict(r) for r in rows]


async def update_workflow_definition(
    pool: asyncpg.Pool,
    definition_id: UUID,
    *,
    definition: WorkflowDefinition,
    user_id: UUID,
    token: str | None = None,
) -> dict:
    """UPDATE a DRAFT's ``name`` + ``definition`` JSONB (REQ-1 PATCH), returning a
    REFUSAL-AWARE dict that always names what happened.

    ``{"ok": True, "id", "version", "token"}`` on success, or
    ``{"ok": False, "cause": "not_found" | "already_published" | "stale_token", "token"?}``.

    WHY NOT ``None`` ANY MORE (Phase 186 / D-186-09): once a token conjunct exists, a
    0-row UPDATE conflates FOUR causes, and the shipped ``None`` -> 404 mapping would tell
    an author their own open draft does not exist. That is a lie, and it is the specific
    lie this signature exists to prevent. The caller maps ``cause`` to HTTP; it no longer
    has to infer one from an absence.

    THE TOKEN CLAUSE IS A THIRD CONJUNCT, ADDED ALONGSIDE THE OWNER SCOPE AND NEVER IN
    PLACE OF IT (T-186-01-01). ``created_by = $2`` is the ONLY authorization boundary on
    this table for the service-role pool (it bypasses RLS), so the token is a CONCURRENCY
    check and never an AUTHORIZATION check — a forger holding a perfect token still
    matches 0 rows on somebody else's draft.

    OPTIONAL FOR ONE RELEASE (D-186-07 posture): ``token=None`` omits the conjunct
    entirely and runs today's byte-identical unguarded UPDATE, so a browser tab open
    across the deploy does not break on its next save. This is a dated concession, not the
    end state — the client always sends one.

    Owner-scoped + draft-only (``id = $1 AND created_by = $2 AND status = 'draft'``):
    a row not owned by the caller, not a draft, or not found matches 0 rows and the
    owner-scoped probe below collapses "missing" and "not yours" to the SAME
    ``not_found`` (no existence leak — the get_definition precedent).

    PUBLISHED-ROW FREEZE (T-103-01-02): the immutability trigger
    ``workflow_definitions_block_published`` raises Postgres ``23514`` on a published-row
    UPDATE. The ``status='draft'`` WHERE guard makes the normal published-row PATCH a
    0-row no-op (-> ``already_published`` -> 409). The trigger is NOT caught here — it is
    left to PROPAGATE as ``asyncpg.exceptions.CheckViolationError`` so the route maps it
    to HTTP 409 (mirroring ``publish_definition``'s draft->published trigger note: the
    trigger is the source of truth; the route maps the exception, never a silent overwrite
    or a 500). The ``status='draft'`` conjunct usually pre-empts the trigger — but not in
    a race, which is why BOTH still exist (T-186-01-06).

    ``$N`` placeholders only for every VALUE; ``CONCURRENCY_TOKEN_SQL`` is a code literal
    (see the amended section comment above).
    """
    # The token conjunct is included ONLY when a token was supplied. Two statements, not
    # one with a "$5 IS NULL OR" escape hatch: an OR'd-away guard is one refactor away
    # from being permanently disabled, and it would read as guarded when it is not.
    if token is not None:
        row = await pool.fetchrow(
            f"UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
            f"WHERE id = $1 AND created_by = $2 AND status = 'draft' "
            f"AND {CONCURRENCY_TOKEN_SQL} = $5 "
            f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token",
            definition_id,
            user_id,
            definition.name,
            json.dumps(definition.model_dump(mode="json")),
            token,
        )
    else:
        row = await pool.fetchrow(
            f"UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
            f"WHERE id = $1 AND created_by = $2 AND status = 'draft' "
            f"RETURNING id, version, {CONCURRENCY_TOKEN_SQL} AS token",
            definition_id,
            user_id,
            definition.name,
            json.dumps(definition.model_dump(mode="json")),
        )
    if row is not None:
        # The RETURNING reads the NEW row: the BEFORE UPDATE ``set_updated_at`` trigger
        # has already stamped ``NEW.updated_at``, so this is the POST-write token and the
        # client can chain the next autosave with no extra read.
        return {"ok": True, **dict(row)}

    # 0 rows — up to four causes are conflated. Disambiguate with ONE owner-scoped read.
    # THE ``created_by = $2`` HERE IS LOAD-BEARING (T-186-01-02): a probe WITHOUT it would
    # answer "that row exists but isn't yours", which is exactly the existence leak the
    # 404-collapse closes. This query can only ever describe a row the caller ALREADY OWNS.
    probe = await pool.fetchrow(
        f"SELECT status, {CONCURRENCY_TOKEN_SQL} AS token FROM workflow_definitions "
        f"WHERE id = $1 AND created_by = $2",
        definition_id,
        user_id,
    )
    if probe is None:
        return {"ok": False, "cause": "not_found"}  # missing OR not-owned -> one 404
    if probe["status"] == "published":
        return {"ok": False, "cause": "already_published"}  # -> 409, today's sentence
    if token is None:
        # DEFENSIVE COLLAPSE TO TODAY'S BEHAVIOUR, never a stale_token for a request that
        # carried no token: an UNGUARDED update cannot match 0 rows on an owned draft, so
        # this branch is unreachable. If it is ever reached the row is in a state this
        # function does not model, and the honest answer is the pre-186 one.
        return {"ok": False, "cause": "not_found"}
    return {"ok": False, "cause": "stale_token", "token": probe["token"]}


async def delete_workflow_definition(
    pool: asyncpg.Pool, definition_id: UUID, *, user_id: UUID
) -> bool:
    """DELETE a DRAFT owned by the caller (REQ-1 DELETE). Returns True iff a row was
    removed.

    Owner-scoped + draft-only (``id = $1 AND created_by = $2 AND status = 'draft'``):
    a non-owned / non-draft / missing id removes 0 rows -> ``False`` (the route maps
    ``False`` -> 404; no existence leak).

    PUBLISHED-ROW FREEZE (T-103-01-02): same as ``update_workflow_definition`` — the
    immutability trigger raises ``23514`` on a published-row DELETE; the ``status='draft'``
    guard makes the normal published-row DELETE a 0-row no-op (-> ``False`` -> 404), and a
    trigger violation is left to PROPAGATE as ``CheckViolationError`` for the route to map
    to HTTP 409. ``$N`` placeholders only.
    """
    row = await pool.fetchrow(
        "DELETE FROM workflow_definitions "
        "WHERE id = $1 AND created_by = $2 AND status = 'draft' "
        "RETURNING id",
        definition_id,
        user_id,
    )
    return row is not None


# ── published-workflow safe DELETE cascade (Phase 152 / WFIN-03, D-LOCK-04) ──
async def delete_published_workflow_cascade(
    pool: asyncpg.Pool, *, slug: str, user_id: UUID
) -> dict:
    """Hard-delete a workflow (definition + ALL versions + ALL runs) in FK-safe order.

    "Delete the workflow" = every row sharing ``slug`` owned by the caller (A1 — the
    Published shelf renders one card per slug, so a delete must sweep all versions, not
    a single one). Resolved owner-scoped (``created_by = $2``): a foreign / unknown slug
    resolves to 0 version_ids → ``{"deleted": False}`` (the route maps that to 404, no
    existence leak — service role bypasses RLS, so the WHERE is the ONLY boundary,
    T-152-02-01).

    FK-SAFE ORDER (verified against full-schema.sql — one transaction, mirrors
    ``create_workflow_run``'s ``acquire() -> transaction()`` shape):
      1. ``DELETE workflow_runs WHERE definition_id = ANY(version_ids)`` FIRST — the
         ``workflow_runs.definition_id`` FK is ``ON DELETE RESTRICT`` (:3203), THE blocker.
         Deleting the runs AUTO-cascades ``workflow_phases`` (ON DELETE CASCADE :3195) and
         AUTO-detaches threads (``threads.active_workflow_run_id`` ON DELETE SET NULL :3131 —
         threads are KEPT as normal chats, D-LOCK-04). No orphaned runs / phases / anchors.
      2. ``DELETE workflow_definitions WHERE id = ANY(version_ids)`` — the RESTRICT is now
         satisfied. The immutability trigger is ``BEFORE UPDATE`` only (:2598) → it does NOT
         fire on DELETE, so no trigger amendment and NO migration are needed.

    ``harness_audit`` is deliberately NOT touched — its ``run_id`` has NO FK (nullable), so
    its append-only receipts LINGER as the audit trail (A3 — the SC names runs+threads, not
    audit). All params bind ``$N`` / ``ANY($1::uuid[])`` — NEVER an f-string on user values
    (T-152-02-04). Cancel-first of any in-flight run lives in the SERVICE/route layer BEFORE
    this txn (D-LOCK-05), never inside it.

    Returns ``{"deleted": True, "name", "versions", "runs"}`` or ``{"deleted": False}``.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            rows = await con.fetch(
                "SELECT id, name FROM workflow_definitions WHERE slug = $1 AND created_by = $2",
                slug,
                user_id,
            )
            if not rows:
                return {"deleted": False}  # → route maps to 404 (no existence leak)
            version_ids = [r["id"] for r in rows]
            name = rows[0]["name"]
            # runs FIRST (RESTRICT blocker) → cascades phases + SET-NULLs thread anchors
            run_status = await con.execute(
                "DELETE FROM workflow_runs WHERE definition_id = ANY($1::uuid[])",
                version_ids,
            )
            await con.execute(
                "DELETE FROM workflow_definitions WHERE id = ANY($1::uuid[])",
                version_ids,
            )
    # asyncpg returns the command tag "DELETE <n>"; parse the deleted-run count.
    try:
        runs_deleted = int(run_status.split()[-1])
    except (ValueError, AttributeError, IndexError):
        runs_deleted = 0
    return {"deleted": True, "name": name, "versions": len(version_ids), "runs": runs_deleted}


async def delete_workflow_cascade_preview(
    pool: asyncpg.Pool, *, slug: str, user_id: UUID
) -> dict:
    """Exact Removed/Kept counts for the victim-naming sheet (D-LOCK-03) — read-only.

    Owner-scoping applies to the DEFINITIONS only (``created_by = $2`` resolves the
    caller's own version_ids for ``slug``). The ``runs`` / ``threads`` / ``in_flight``
    counts are then computed over those definitions' workflow_runs — which, for an
    ``is_system_global`` definition, AGGREGATE across ALL runners (``workflow_runs.user_id`` is
    the runner, not the definition owner), NOT just the caller's own runs (WR-01). These
    read counts are owner-definition-scoped and low-sensitivity; the DESTRUCTIVE path is
    fail-closed separately by the ``count_foreign_runs_on_global`` 409 guard in the
    cascade route, which refuses to delete a global definition that has other users' runs.
    An unknown / foreign slug → ``{"found": False}`` (the route maps that to 404,
    indistinguishable from not-found). ``$N`` / ``ANY($1::uuid[])`` binding only.

    Returns ``{"found": True, "name", "versions", "runs", "threads", "in_flight"}`` where
    ``runs`` = ``COUNT(*)`` of the workflow_runs for those versions (Removed), ``threads`` =
    ``COUNT(DISTINCT thread_id)`` of the threads those runs live on (Kept — they become
    normal chats), and ``in_flight`` = ``COUNT(*)`` of runs still LIVE (active/paused/
    cap_paused — the D-LOCK-05 cancel-first signal). Or ``{"found": False}``.
    """
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT id, name FROM workflow_definitions WHERE slug = $1 AND created_by = $2",
            slug,
            user_id,
        )
        if not rows:
            return {"found": False}
        version_ids = [r["id"] for r in rows]
        name = rows[0]["name"]
        runs = await con.fetchval(
            "SELECT COUNT(*) FROM workflow_runs WHERE definition_id = ANY($1::uuid[])",
            version_ids,
        )
        threads = await con.fetchval(
            "SELECT COUNT(DISTINCT thread_id) FROM workflow_runs "
            "WHERE definition_id = ANY($1::uuid[])",
            version_ids,
        )
        # Phase 152-04 (D-LOCK-05): the count of runs STILL LIVE — the honest signal
        # the frontend's amber cancel-first banner gates on. Matches the cancel-first
        # status set the DELETE route heals (active/paused/cap_paused) so the banner
        # and the actual cancel agree. This is a LIVE signal, never the total ``runs``
        # (which is historical run RECORDS — showing "in progress" off that would lie).
        in_flight = await con.fetchval(
            "SELECT COUNT(*) FROM workflow_runs WHERE definition_id = ANY($1::uuid[]) "
            "AND status IN ('active', 'paused', 'cap_paused')",
            version_ids,
        )
    return {
        "found": True,
        "name": name,
        "versions": len(version_ids),
        "runs": int(runs or 0),
        "threads": int(threads or 0),
        "in_flight": int(in_flight or 0),
    }


async def count_foreign_runs_on_global(
    pool: asyncpg.Pool, *, slug: str, user_id: UUID
) -> int:
    """Count OTHER users' runs on the caller's ``is_system_global`` definitions for ``slug`` (WR-01).

    The delete cascade's owner gate is on the DEFINITION (``created_by``), but the
    ``ON DELETE RESTRICT`` FK forces ``DELETE workflow_runs`` to sweep EVERY runner's
    rows on an ``is_system_global`` definition (any user may run a global published workflow;
    ``workflow_runs.user_id`` is the runner). This helper is the fail-closed guard: it
    resolves the caller's OWN global version_ids (``created_by = $2 AND is_system_global = true``)
    then returns ``COUNT(*)`` of workflow_runs on those versions owned by anyone else
    (``user_id <> $2``). The cascade route refuses (409) when this is > 0, so a global
    starter's owner can no longer silently cancel + delete every user's run history.

    Non-global definitions and global definitions with only the owner's own runs → 0
    (unaffected). ``$N`` / ``ANY($1::uuid[])`` binding only — never an f-string on user
    values (T-152-05-05).
    """
    async with pool.acquire() as con:
        rows = await con.fetch(
            "SELECT id FROM workflow_definitions "
            "WHERE slug = $1 AND created_by = $2 AND is_system_global = true",
            slug,
            user_id,
        )
        if not rows:
            return 0  # non-global / foreign slug → no cross-user blast radius
        version_ids = [r["id"] for r in rows]
        count = await con.fetchval(
            "SELECT COUNT(*) FROM workflow_runs "
            "WHERE definition_id = ANY($1::uuid[]) AND user_id <> $2",
            version_ids,
            user_id,
        )
    return int(count or 0)


# ── workflow_phases reads (RUN-KEYED → workflow_run_id) ──────────────────────
async def load_run_phases(pool: asyncpg.Pool, run_id: UUID) -> list[dict]:
    """All phases for a run, in ``phase_index`` order (resumability substrate).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — that column does not
    exist on workflow_phases; would raise Postgres 42703).
    """
    rows = await pool.fetch(
        """
        SELECT id, slug, phase_index, status, output, started_at, completed_at
        FROM workflow_phases
        WHERE workflow_run_id = $1
        ORDER BY phase_index
        """,
        run_id,
    )
    return [dict(r) for r in rows]


async def get_latest_completed_workflow_run(
    pool: asyncpg.Pool,
    slug: str,
    *,
    user_id: UUID,
    org_id: UUID | None = None,
) -> dict | None:
    """Resolve the previous completed run's deliverable for a stateful workflow (Phase 205 / STATE-01).

    Scopes on stable workflow identity (``workflow_definitions.slug``) and owner (``workflow_runs.user_id``)
    so living registers survive version bumps and republishes (G-1, N-1).

    Applies Phase 200.2's shipped deliverable-resolution rule (G-4):
    selects the last completed phase row with a NON-EMPTY deliverable text (skipping confirm/question
    steps and empty file steps).

    Defends against the JSONB string-scalar trap (G-3 / N-3) by safely deserializing string scalars
    (the 87% live DB format) into parsed dicts, distinguishing genuine cold starts (``None``) from
    decoding failures (logged warning + empty dict fallback).
    """
    # 1. Query the most recent completed run for this slug + user_id (+ org_id)
    run_row = await pool.fetchrow(
        """
        SELECT wr.id AS run_id, wr.created_at, wr.user_id, wr.org_id
        FROM workflow_runs wr
        JOIN workflow_definitions wd ON wd.id = wr.definition_id
        WHERE wd.slug = $1
          AND wr.user_id = $2
          AND ($3::uuid IS NULL OR wr.org_id = $3)
          AND wr.status = 'completed'
          AND wr.is_golden_run = false
        ORDER BY wr.created_at DESC
        LIMIT 1
        """,
        slug,
        user_id,
        org_id,
    )
    if run_row is None:
        return None

    run_id: UUID = run_row["run_id"]

    # 2. Query completed phases for this run in reverse execution order (phase_index DESC)
    phase_rows = await pool.fetch(
        """
        SELECT id, slug, phase_index, status, output, created_at
        FROM workflow_phases
        WHERE workflow_run_id = $1
          AND status = 'completed'
        ORDER BY phase_index DESC, created_at DESC
        """,
        run_id,
    )

    # 3. Apply Phase 200.2 resolution rule: find the last phase with non-empty deliverable text,
    #    skipping question/confirm steps (where output represents an ask-user prompt or question).
    selected_output: dict = {}
    deliverable_text: str = ""

    for prow in phase_rows:
        raw_output = prow["output"]
        output_dict: dict = {}
        if isinstance(raw_output, str):
            try:
                output_dict = json.loads(raw_output)
                if not isinstance(output_dict, dict):
                    output_dict = {"text": str(output_dict)}
            except Exception as exc:
                logger.warning(
                    "get_latest_completed_workflow_run: failed to decode string-scalar output on phase %s (run %s): %s",
                    prow["id"], run_id, exc,
                )
                output_dict = {"text": raw_output}
        elif isinstance(raw_output, dict):
            output_dict = raw_output

        text = output_dict.get("text")
        if text and isinstance(text, str) and text.strip():
            # A confirm/ask_user prompt is not a deliverable answer
            if (
                output_dict.get("ask_user")
                or output_dict.get("options")
                or output_dict.get("prompt_type") == "confirm"
                or output_dict.get("question") is True
            ):
                continue
            deliverable_text = text.strip()
            selected_output = output_dict
            break

    # If no phase had non-empty text, fall back to the last completed phase's output dict
    if not deliverable_text and phase_rows:
        raw_output = phase_rows[0]["output"]
        if isinstance(raw_output, str):
            try:
                selected_output = json.loads(raw_output)
                if not isinstance(selected_output, dict):
                    selected_output = {"text": str(selected_output)}
            except Exception:
                selected_output = {"text": raw_output}
        elif isinstance(raw_output, dict):
            selected_output = raw_output
        deliverable_text = selected_output.get("text") or ""

    return {
        "id": str(run_id),
        "run_id": str(run_id),
        "created_at": run_row["created_at"].isoformat() if run_row["created_at"] else None,
        "deliverable_text": deliverable_text,
        "output": selected_output,
    }


# ── resume sweep reads (HARNESS-03 / Plan 04) ────────────────────────────────
async def find_resumable_runs(pool: asyncpg.Pool) -> list[dict]:
    """Stranded runs to re-run on startup (HARNESS-03 startup sweep).

    A stranded run is one whose run row is still ``active``/``paused`` AND is the
    thread's CURRENT run (``threads.active_workflow_run_id = wr.id``) AND has a
    ``workflow_phases`` row left ``status='active'`` — a phase a restart killed
    mid-work (its output was never durable, so re-running it from the top is the
    correct, idempotent resume point — HARNESS-03 2-phase write).

    COLUMN CONTRACT (BLOCKER): the ``threads`` anchor is the threads-table column
    ``active_workflow_run_id`` (per-thread, not a global flag); the
    ``workflow_phases`` EXISTS sub-select keys by ``workflow_run_id`` (migration
    058:16 — a bare ``wp.run_id`` would raise Postgres 42703). The owner FK chain
    (workflow_runs.thread_id -> threads.user_id) closes T-091-23 cross-user reads.

    ⚠ **PHASE 190 (A4) — A GOLDEN RUN IS NEVER RESUMABLE, AND THAT IS A SECURITY
    PROPERTY, NOT HOUSEKEEPING.** ``create_workflow_run`` sets the ``threads``
    anchor for EVERY run it creates, the publish path included
    (``publish_service._drive_golden_run`` passes ``is_golden_run=True`` straight
    into it). So until Phase 190 a publish killed by a restart mid-phase left an
    anchored, stranded golden run that this sweep happily returned — and
    ``harness_engine._build_resume_context`` does not carry ``is_golden_run``, so the
    next boot re-drove it as a LIVE run. That was inert while the ``external_action``
    executor sent nothing. From the commit that gave it a real send it stops being
    inert: **the resumed publish validation would PERFORM the external action, with
    nobody asked, once per boot until it terminalized** — D-16's defect arriving
    through the one door D-16's gate does not watch.

    The exclusion lives HERE rather than as a second flag on a second ctx builder,
    because the honest statement is not *"a resumed golden run must not send"* but
    *"a golden run is not a thing to resume"*: publishing is a bounded, synchronous
    validation whose caller is long gone, and abandoning a stranded one is the
    correct outcome on its own terms.

    **Both gates, the shape plan 190-06 established for D-14:** the SQL predicate is
    the gate (the row never leaves Postgres), and the post-fetch re-check is what
    survives a future author simplifying the query. Driven by
    ``tests/test_harness_engine.py::test_a_resumed_run_can_never_be_a_golden_run``,
    which was OBSERVED RED against the unfiltered version above.
    """
    rows = await pool.fetch(
        """
        SELECT wr.id AS run_id, wr.thread_id, wr.current_phase_id, wr.inputs,
               wr.org_id, wr.is_golden_run, t.user_id
        FROM workflow_runs wr
        JOIN threads t ON t.id = wr.thread_id
        WHERE wr.status IN ('active', 'paused')
          AND t.active_workflow_run_id = wr.id
          AND wr.is_golden_run = false
          AND EXISTS (
            SELECT 1 FROM workflow_phases wp
            WHERE wp.workflow_run_id = wr.id
              AND wp.status = 'active'
          )
        """
    )
    resumable: list[dict] = []
    for row in rows:
        run = dict(row)
        if run.get("is_golden_run"):
            # Unreachable through the predicate above; kept because the predicate is one
            # careless edit from gone and this is the half that would still refuse.
            logger.warning(
                "resume sweep: refusing to resume golden run %s — a publish validation is "
                "never re-driven (Phase 190 / A4)", run.get("run_id"),
            )
            continue
        resumable.append(run)
    return resumable


async def get_active_phase(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The single ``status='active'`` phase row for a stranded run (resume target).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — column does not exist
    on workflow_phases; would raise Postgres 42703). Returns id/slug/phase_index/
    status/output, or ``None`` if no phase is active (already advanced).
    """
    row = await pool.fetchrow(
        """
        SELECT id, slug, phase_index, status, output, started_at, completed_at
        FROM workflow_phases
        WHERE workflow_run_id = $1 AND status = 'active'
        ORDER BY phase_index
        LIMIT 1
        """,
        run_id,
    )
    return dict(row) if row is not None else None


async def ask_user_response_exists(
    pool: asyncpg.Pool, run_id: UUID, tool_call_id: str
) -> bool:
    """True iff a durable ask_user RESPONSE row exists for ``tool_call_id``.

    MIRRORS the panel.py ``/ask_user/pending`` raw query (the NOT-EXISTS half),
    INVERTED: instead of finding prompts WITHOUT a response, we ask whether a
    response row for THIS ``tool_call_id`` exists. The distinguishing shape (from
    runs.py ``/ask_user_response`` step 2 — the durable insert):
      - ``role = 'system'``  (Phase 086: system rows are FILTERED from /snapshot —
        we scan them DIRECTLY the /pending way, NOT the snapshot path)
      - ``tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb``  (the RESPONSE
        kind — the prompt row carries ``kind='ask_user_prompt'`` instead)
      - ``tool_calls->0->>'tool_call_id' = $1``  (the per-call id match)

    The scan is keyed off the run's thread via the workflow_runs FK so it stays
    owner-scoped. True ⇒ answered (resume must NOT re-ask); False ⇒ pending
    (resume re-subscribes + re-emits, subscribe-before-emit).

    RUN-SCOPING (WR-06, 091-08): the response row (runs.py /ask_user_response)
    stores ``kind``/``tool_call_id``/``response_text``/``choice_index`` but NOT a
    ``run_id`` — so we cannot filter the response itself by run. Instead we require
    that a matching PROMPT row (which DOES carry ``run_id`` —
    phase_types.py:331) for the SAME ``tool_call_id`` belongs to THIS run
    (``p.tool_calls->0->>'run_id' = $1::text``). This disambiguates a thread that
    has had multiple workflow runs: the answer counts only when it answers a prompt
    this run issued — not merely the latest answer in the thread.
    """
    found = await pool.fetchval(
        """
        SELECT EXISTS (
            SELECT 1
            FROM messages r
            JOIN workflow_runs wr ON wr.thread_id = r.thread_id
            JOIN messages p
              ON p.thread_id = wr.thread_id
             AND p.role = 'system'
             AND p.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
             AND p.tool_calls->0->>'tool_call_id' = $2
             AND p.tool_calls->0->>'run_id' = $1::text
            WHERE wr.id = $1
              AND r.role = 'system'
              AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
              AND r.tool_calls->0->>'tool_call_id' = $2
        )
        """,
        run_id,
        tool_call_id,
    )
    return bool(found)


async def get_pending_ask_user(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The durable ``ask_user_prompt`` row's payload for a run's active prompt.

    Scans the ``role='system'`` prompt rows (the /pending way, NOT the filtered
    /snapshot path) for this run's thread and returns the LATEST prompt's
    ``tool_calls[0]`` payload (tool_call_id, prompt, options, timeout_seconds) so
    resume re-emits the SAME prompt. Returns ``None`` if no prompt row exists.

    RUN-SCOPING (WR-05, 091-08): the prompt row stores the issuing ``run_id`` at
    ``tool_calls->0->>'run_id'`` (phase_types.py:331). We filter on it
    (``= $1::text``) so a thread with MULTIPLE workflow runs (or multiple prompts)
    re-emits the prompt that actually belongs to THIS run — not merely the newest
    prompt in the thread (which could be a different run's question, making resume
    re-emit the wrong tool_call_id).
    """
    row = await pool.fetchrow(
        """
        SELECT m.tool_calls
        FROM messages m
        JOIN workflow_runs wr ON wr.thread_id = m.thread_id
        WHERE wr.id = $1
          AND m.role = 'system'
          AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
          AND m.tool_calls->0->>'run_id' = $1::text
        ORDER BY m.created_at DESC
        LIMIT 1
        """,
        run_id,
    )
    if row is None:
        return None
    tcs = row["tool_calls"] or []
    payload = tcs[0] if tcs else {}
    return {
        "tool_call_id": payload.get("tool_call_id"),
        "prompt": payload.get("prompt"),
        "options": payload.get("options"),
        "timeout_seconds": payload.get("timeout_seconds"),
    }


# ── workflow_phases writes (PHASE-KEYED → id) ────────────────────────────────
async def mark_phase_active(pool: asyncpg.Pool, phase_id: UUID) -> datetime | None:
    """Flip a phase to ``active`` BEFORE its work runs (Pitfall 1: durable-first).

    PHASE-KEYED write → ``WHERE id=$1``.

    ── 200 (DES-02 / D-05): THE ONE ``started_at`` WRITE SITE ────────────────
    This is the ONLY writer of ``workflow_phases.started_at`` in the tree, and it is the
    right one precisely because it happens BEFORE the phase's work: the durable-first flip
    IS the moment the step began. **No other site may write that column** — a second home
    would let two "when did this start" answers disagree.

    ⚠ WHY ``created_at`` COULD NOT SUBSTITUTE, which is D-05's whole argument.
    ``create_workflow_run`` batch-INSERTs EVERY phase row of a run inside one transaction
    (:334 above), so ``created_at`` is the moment the RUN was created — identical across all
    of a run's phases and unrelated to when any of them began work. And ``updated_at`` is
    overwritten by all seven status writers on every transition, so it only ever means "the
    last time anything about this row moved". Neither could answer "how long did this step
    take"; a per-step duration was genuinely underivable before migration 121.

    ⚠ RETURNS THE TIMESTAMP THE DATABASE ACTUALLY WROTE — via ``RETURNING``, not a
    Python-side ``datetime.now()`` computed alongside. The engine emits this value on the
    ``phase_started`` SSE frame so a live tick has an anchor without polling, and emitting a
    number the row does not carry would be exactly the dishonesty this phase exists to
    remove. ``fetchval`` (not ``execute``) is what makes ``RETURNING`` readable; the write
    is otherwise byte-identical and still ONE statement.

    Returns ``None`` when no row matched — the caller treats a missing anchor as "not
    recorded" and renders nothing, never a zero.
    """
    return await pool.fetchval(
        "UPDATE workflow_phases SET status='active', updated_at=now(), started_at = now() WHERE id = $1 RETURNING started_at",
        phase_id,
    )


async def complete_phase(
    pool: asyncpg.Pool, phase_id: UUID, output: dict
) -> datetime | None:
    """Flip to ``completed`` AND write ``output`` in ONE atomic UPDATE.

    Called ONLY after the output is durable. The status flip and the output
    write are a single statement (never two) so a crash between them is
    impossible — the resumability invariant (HARNESS-03).
    PHASE-KEYED write → ``WHERE id=$1``.

    ── 200 (DES-02 / D-05): ONE OF THE FIVE ``completed_at`` WRITE SITES ─────
    The other four are ``fail_phase``, ``record_phase_not_sent``, ``cancel_phase`` and
    ``cancel_active_phases``. ⚠ ``skip_phase`` writes NEITHER timestamp, deliberately: a
    skipped phase never ran, so both columns stay NULL and the row reads *never ran* rather
    than a zero duration. That silence is D-06's, and it is not an omission to "fix".

    ⚠ RETURNS THE TIMESTAMP THE DATABASE ACTUALLY WROTE (``RETURNING``), for the same
    reason ``mark_phase_active`` does: the engine puts this value on the ``phase_completed``
    SSE frame, and a Python-side ``datetime.now()`` computed beside the write would be a
    number the row does not carry.

    ⚠ ``RETURNING`` COMPOSES WITH THE ``IS DISTINCT FROM 'cancelled'`` FENCE RATHER THAN
    WEAKENING IT, and that is the useful part: when the fence refuses the write (a Stop
    already cancelled this phase — the L-01 residue) NO row is returned, so this yields
    ``None`` and the caller emits no completion timestamp for a step that was never
    completed. The guard and the return value agree by construction.

    ── 200.1 / D-200.1-01(b): THIS WRITER STOPPED PRE-ENCODING ──────────────
    This function, ``fail_phase`` and ``record_phase_not_sent`` each bound
    ``json.dumps(...)`` into their ``$2::jsonb`` parameter on a pool that ALREADY installs a
    jsonb codec with ``encoder=json.dumps`` (``dependencies._init_pg_connection``, D-073-06).
    Encoded twice, every value landed as a jsonb **STRING SCALAR** — measured at **527 of 588**
    non-null ``output`` values, including **484 of 484** ``completed`` rows. That is migration
    122's root cause one column over, and the full narrative is in ``create_workflow_run``'s
    docstring above. **The fix is to stop pre-encoding, not to add a cast:** ``$2::jsonb`` is
    fine and is unchanged, and so is every other byte of the SQL.

    ⚠ **A FINDING THIS PLAN MEASURED AND IS DELIBERATELY *NOT* FIXING — recorded here because
    a finding that lives nowhere is a finding that was deleted.** ``load_run_phases`` SELECTs
    ``output``, and ``harness_engine.py``'s F7 resume re-fold reads ``r.get("output") or {}``
    into an ``accumulated_outputs: dict[str, dict]``. On a string-scalar row the pool codec
    decodes to a Python **``str``**, so **the resumed run's grounding re-fold has been folding
    STRINGS** — the same silent degradation as ``declared_phase_measure``, in a THIRD consumer,
    and the reason ``isinstance`` guards downstream (``_is_llm_human_input``,
    ``_active_tool_call_id``) have been quietly falling through. **(b) repairs this for NEW rows
    and does NOT repair it for the 527 historical ones.** That is outside RUN-04's scope — the
    fix belongs with an audit of the resume path's own shape assumptions, not with a parameter
    change. ⚠ **Re-open trigger, named rather than left silent: the next phase that touches the
    resume path or the startup sweep.**

    ⚠ **THE SIBLING COLUMNS ARE UNTOUCHED AND THAT IS A DECISION.** ``json.dumps(inputs)`` in
    ``create_workflow_run`` and the four ``definition`` writes elsewhere in this file keep the
    old shape; their re-open trigger is carried forward VERBATIM from migration 123's header
    (the next phase that touches either on the WRITE path). ``output`` is repairable now
    precisely because it ALREADY has two shapes in it — 527 string against 61 object — and
    because ``models/thread.py::phase_output_object`` now accepts both.
    """
    return await pool.fetchval(
        # ── L-01 RESIDUE AT THE PHASE LEVEL (added 2026-08-16) ───────────────
        # ⚠ THIS CLAUSE EXISTS BECAUSE THE RUN-LEVEL GUARD CREATED A CONTRADICTION
        # IT DID NOT CLOSE. `finish_run` now refuses to overwrite a terminal
        # `workflow_runs.status`, so a user's Stop survives. The four terminal
        # `workflow_phases` writers had NO equivalent — measured:
        # `git show 9dbd57f5 -- backend/app/db/workflows.py | grep -cE "^\+.*workflow_phases"`
        # returns 0. So on the known L-01 residue (the far-worker producer keeps
        # running after a Stop) worker B could write `completed` over worker A's
        # `cancelled` phase, and the run would read `cancelled` while its spine
        # showed that very step DONE — with `runStepCount.ts` counting it toward
        # "N of M steps". Making the run row honest while leaving the phase rows
        # unguarded is a WORSE state than leaving both dishonest, because the two
        # surfaces then disagree.
        #
        # ⚠ SCOPED DELIBERATELY NARROWER THAN `finish_run`'s GUARD, and the reason
        # is that the wider one is not provable here. `finish_run` refuses ANY
        # terminal→different-terminal write; a phase cannot take that rule, because
        # a retry legitimately re-runs a phase (`mark_phase_active` at
        # `harness_engine.py:1579`) and a `failed`→`completed` transition may be
        # correct. **`cancelled` is the one phase status nothing legitimately
        # transitions OUT of**: its only writers are `cancel_phase` and
        # `cancel_active_phases`, both on the Stop path, and the run itself is
        # terminal by then. So the fence is `IS DISTINCT FROM 'cancelled'` and
        # nothing else. A broader guard would strand retried phases — a far worse
        # failure than the one being fixed.
        #
        # `IS DISTINCT FROM` rather than `<>` on purpose: `status` is NOT NULL
        # today, and `<>` would silently stop matching if that ever changed.
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now(), completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled' RETURNING completed_at",
        phase_id,
        # ⚠ THE PLAIN DICT, NOT A PRE-DUMPED STRING — 200.1 / D-200.1-01(b). See the
        # migration-122 paragraph in `create_workflow_run` above for the full root cause:
        # the POOL installs a jsonb codec with `encoder=json.dumps`, so a pre-encoded string
        # is encoded a SECOND time and lands as a jsonb STRING SCALAR. The `$2::jsonb` cast
        # is fine and stays; the PARAMETER is what was wrong.
        output,
    )


async def fail_phase(
    pool: asyncpg.Pool, phase_id: UUID, reason: str, output: dict | None = None
) -> None:
    """Mark a phase ``failed`` with the failure reason in ``output`` (Plan 05).

    101.1 review WR-02: ``output`` (optional, ADDITIVE — both pre-existing callers
    pass nothing and are byte-identical) persists the FULL failure output dict
    alongside the reason — e.g. the cited ``field_map`` an honest emit failure
    carries (D-08: a non-opening render never loses the extracted data). Without
    it the in-memory field-map was dropped on every honest failure, contradicting
    the user-facing "the cited field-map is preserved" copy. ``_failure_reason``
    always wins on a key collision (it is the status-repair scripts' key).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    payload: dict = {**(output or {}), "_failure_reason": reason}
    await pool.execute(
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now(), completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
        phase_id,
        # ⚠ THE PLAIN DICT — 200.1 / D-200.1-01(b), see `complete_phase`. `payload` is still
        # composed here and `_failure_reason` still wins on a key collision; only the encode
        # moved to the pool's codec.
        payload,
    )


async def skip_phase(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Mark a phase ``skipped`` (skip_to_phase routing — Plan 05).

    PHASE-KEYED write → ``WHERE id=$1``.

    ── 200 (DES-02 / D-06): THIS IS THE ONE STATUS WRITER THAT TOUCHES NEITHER ──
    ⚠ **THE ABSENCE IS DELIBERATE AND MUST NOT BE "FIXED".** Six of the seven
    ``workflow_phases`` status writers now stamp a timestamp; this one stamps none. A skipped
    phase NEVER RAN — it was routed around, not executed — so it has no start instant and no
    completion instant, and both columns stay NULL. The row then reads *never ran*, which is
    a DIFFERENT client-facing state from *time not recorded* (a phase that did run, before
    migration 121 existed). Writing ``completed_at`` here would claim the step finished;
    writing ``started_at`` would claim it began. D-06 calls this CORRECT SILENCE, and it is
    the count-side twin of the rule that a type with no real number emits no key at all.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='skipped', updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
        phase_id,
    )


async def record_phase_not_sent(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    """Flip to ``recorded_not_sent`` AND write ``output`` in ONE atomic UPDATE (189 / D-05).

    WHAT THIS STATUS MEANS. The phase is a governed EXTERNAL ACTION (the 7th
    ``phase_type``): a human was asked and approved, the step RAN, and it RECORDED
    the action it would have taken — it SENT NOTHING (D-05). None of the five shipped
    statuses is true of that outcome: ``completed`` says the send happened,
    ``failed`` says something went wrong (nothing did), and ``skipped`` says the step
    never ran (it did, and a person approved it). Phase 190 swaps the no-op for a real
    call behind an unchanged seam, and only then does this row become ``completed``.

    ⚠ THE COLUMN STORES THE SLUG (D-17). ``recorded_not_sent`` is the literal in
    ``workflow_phases_status_check`` (migration 115). The sentence a person reads —
    "Not sent — recorded" (D-16) — is RENDERED by the client's vocabulary layer from
    this slug and appears in no query and no constraint.

    Called ONLY after the output is durable. The status flip and the output
    write are a single statement (never two) so a crash between them is
    impossible — the resumability invariant (HARNESS-03). Copies
    ``complete_phase``; NOT ``fail_phase`` — there is no failure reason to merge
    (D-08), so no failure-reason key is written here. The identifier itself is
    deliberately not spelled in this body: the plan's check is a grep, and a
    denial and a use read identically to one (the 189-09 fence lesson).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='recorded_not_sent', output=$2::jsonb, updated_at=now(), completed_at = now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
        phase_id,
        # ⚠ THE PLAIN DICT — 200.1 / D-200.1-01(b), see `complete_phase`. This writer copies
        # `complete_phase` and that includes how it binds its parameter.
        output,
    )


async def cancel_phase(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Flip the interrupted phase to ``cancelled`` — the ENGINE arm (194 / RUN-01, D-04).

    WHAT THIS STATUS MEANS. The phase that was RUNNING when the user stopped the run.
    It did NOT ``fail`` — nothing went wrong, the step was interrupted. It was NOT
    ``skipped`` — it was never routed around; it started, it did work, and a person
    ended the run underneath it. It is plainly not ``completed`` (it produced no phase
    output), not ``pending`` (it had already started), and not ``recorded_not_sent``
    (189's governed-external-action outcome, which has nothing to do with a stop).
    None of the six shipped statuses is true of that outcome.

    ⚠ REUSING ``failed`` OR ``skipped`` WAS OFFERED AND REJECTED (D-04). Phase 194's
    entire requirement is honesty about what a stopped run did and did not do; writing
    ``failed`` on a phase that did not fail, or ``skipped`` on a phase that ran, is
    precisely the dishonesty the phase exists to remove.

    ⚠ THE COLUMN STORES THE SLUG (D-17). ``cancelled`` is the literal in
    ``workflow_phases_status_check`` (migration 119). The sentence a person reads —
    "Run cancelled — no deliverable produced" — is RENDERED by the client's vocabulary
    layer from this slug and appears in no query and no constraint.

    ⚠ COMPLETED PHASES ARE UNTOUCHED (D-07 / D-13, inherited verbatim). Their outputs
    are already durable and ``finish_run`` does not touch them. This writer moves ONE
    row, named by its id — the phase the caller already knows was interrupted. It is
    not a bulk terminalize and must never become one.

    ⚠ WHERE THIS IS CALLED FROM, AND WHY THERE ARE TWO. This is the ENGINE arm's
    writer. The engine's cancel/escape path holds ``phase_id`` in the same loop
    iteration, so it is the only home that knows WHICH phase the user interrupted
    without a query — and the only home that can distinguish "the phase the user
    interrupted" from "some phase row that happens to be ``active``". The engineless
    zombie / no-producer arm has no engine, no loop and no ``phase_id`` at all; it uses
    the RUN-KEYED sibling ``cancel_active_phases`` below. Collapsing the two would cost
    the engine arm its certainty or leave the zombie arm with nothing to call.

    NO OWNERSHIP CHECK IS PERFORMED HERE (T-194-06-03). The workflow cluster reads
    through a service-role pool that BYPASSES RLS, so a WHERE clause is the access
    boundary — but this writer takes no user-supplied filter, only a key. Ownership is
    enforced by the CALLER (the owner-scoped, anchor-confirmed cancel route), the same
    division ``_cancel_run_internals`` already keeps (T-147-06).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='cancelled', updated_at=now(), completed_at = now() WHERE id = $1",
        phase_id,
    )


async def cancel_active_phases(pool: asyncpg.Pool, workflow_run_id: UUID) -> None:
    """Flip a run's in-flight phase row(s) to ``cancelled`` — the ENGINELESS arm (194 / RUN-01).

    WHAT THIS STATUS MEANS. Identical to ``cancel_phase`` above and stated once there:
    the phase that was RUNNING when the user stopped the run — not failed, not skipped,
    interrupted. ⚠ Reusing ``failed`` or ``skipped`` was OFFERED AND REJECTED (D-04).

    ⚠ THE COLUMN STORES THE SLUG (D-17). ``cancelled`` is the literal in
    ``workflow_phases_status_check`` (migration 119). The sentence a person reads —
    "Run cancelled — no deliverable produced" — is RENDERED by the client's vocabulary
    layer from this slug and appears in no query and no constraint.

    ⚠ COMPLETED PHASES ARE UNTOUCHED (D-07 / D-13, inherited verbatim), AND THE
    ``AND status = 'active'`` CLAUSE IS THE MECHANISM — not a convention, not belt-and-
    braces. It is the only thing standing between this writer and a bulk terminalize of
    every phase on the run. Widening it to a set — or dropping it — would rewrite
    ``completed`` rows whose outputs are already durable, which D-07 forbids outright;
    ``failed``, ``skipped`` and ``recorded_not_sent`` rows are equally out of its reach
    and must stay so.

    ⚠ RUN-KEYED write → ``WHERE workflow_run_id=$1``. The column is
    ``workflow_run_id``. ``workflow_phases`` has NO plain ``run_id`` column and naming
    one raises Postgres 42703 — the trap ``get_active_phase`` records above, whose
    predicate this applies as a WRITE.

    ⚠ A SET-PREDICATE, DELIBERATELY — never a read-then-update-by-id. Exactly one
    ``active`` row per run is TYPICAL, NOT GUARANTEED (measured: 3 runs have exactly 1
    each, 0 runs have more; ``get_active_phase`` itself hedges with ``ORDER BY
    phase_index LIMIT 1``). One predicate UPDATE is correct for 0, 1 or N matching
    rows, raises on none of the three, and needs no prior read.

    ⚠ WHERE THIS IS CALLED FROM, AND WHY THERE ARE TWO. This is the zombie /
    no-producer arm's writer — the path with no engine, no loop and no ``phase_id``,
    where the row must be FOUND rather than named. The engine arm uses the PHASE-KEYED
    ``cancel_phase`` above, which is the only home that can distinguish "the phase the
    user interrupted" from "some phase row that happens to be ``active``".

    NO OWNERSHIP CHECK IS PERFORMED HERE (T-194-06-03). The workflow cluster reads
    through a service-role pool that BYPASSES RLS, so a WHERE clause is the access
    boundary — but this writer takes no user-supplied filter, only a key. Ownership is
    enforced by the CALLER (the owner-scoped, anchor-confirmed cancel route), the same
    division ``_cancel_run_internals`` already keeps (T-147-06).

    ⚠ The predicate below is written on ONE source line ON PURPOSE (193.2-08: a rule
    written WRAPPED failed its own literal ``grep -q`` and read as "already fixed").
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='cancelled', updated_at=now(), completed_at = now() WHERE workflow_run_id = $1 AND status = 'active'",
        workflow_run_id,
    )


# ── workflow_runs writes (keyed by the runs table's own id) ──────────────────
async def advance_current_phase(
    pool: asyncpg.Pool, run_id: UUID, next_phase_id: UUID | None
) -> None:
    """Point ``workflow_runs.current_phase_id`` at the next phase (or NULL on last).

    workflow_runs table, keyed by its own ``id``.
    """
    await pool.execute(
        "UPDATE workflow_runs SET current_phase_id = $2 WHERE id = $1",
        run_id,
        next_phase_id,
    )


async def pause_run(pool: asyncpg.Pool, workflow_run_id: UUID) -> None:
    """Flip a run to ``paused`` — the D-10 human gate, and the FIRST writer of this status.

    ⚠ ``workflow_runs.status = 'paused'`` HAD **ZERO WRITERS IN THE ENTIRE BACKEND**
    before Phase 200. ``grep -rn "'paused'" backend/app --include=*.py`` returned seven
    hits and **all seven were READS** — the delete-cascade in-flight sweep
    (``api/workflows.py``), the lock banner (``:1180``), ``find_resumable_runs``
    (``:1296``) and the claim/lease writes. The literal has been admitted by
    ``workflow_runs_status_check`` since migration 057 and nothing has ever written it.
    So there is no pause semantics to copy here, only a SHAPE: ``cancel_active_phases``'
    single keyed ``pool.execute`` with ``$N`` placeholders and a docstring naming the key
    axis and the ownership division.

    ⚠ **THIS MUST NOT BE ``finish_run``, AND THE REASON IS MEASURED RATHER THAN
    STYLISTIC.** ``finish_run``'s guard (``status NOT IN ('completed','failed',
    'cancelled')``) would happily ACCEPT a ``'paused'`` write — but it clears
    ``threads.active_workflow_run_id`` in the SAME transaction (092 SC#2), and
    ``find_resumable_runs`` (``:1251``) requires ``t.active_workflow_run_id = wr.id``.
    Reusing it would make every paused run **permanently unresumable**: the boot sweep
    would find nothing, forever. That is Pitfall 4, and it is why this is a separate
    writer rather than a second argument to an existing one.

    ⚠ RUN-KEYED write → ``WHERE id = $1``. The guard is
    ``status NOT IN ('completed','failed','cancelled')`` so this can never RESURRECT a
    terminal run — a Stop that landed on another worker while the gate was waiting keeps
    its terminal status, and this write finds 0 rows. It is deliberately NOT narrowed to
    ``status = 'active'``: a re-entered pause (the same gate timing out twice across a
    re-drive) must stay idempotent rather than silently no-op, and ``cap_paused`` is a
    non-terminal state a run can legitimately be in when a later phase's gate elapses.

    ⚠ THE THREAD ANCHOR IS NOT TOUCHED HERE, AND ITS ABSENCE IS THE POINT. A paused run
    is still the thread's CURRENT run; the anchor is what makes it findable again.

    NO OWNERSHIP CHECK IS PERFORMED HERE. The workflow cluster reads through a
    service-role pool that BYPASSES RLS, so a WHERE clause is the access boundary — but
    this writer takes no user-supplied filter, only a key. Ownership is enforced by the
    CALLER (the engine reached this run through an owner-scoped kickoff or an
    owner-scoped, anchor-confirmed answer), the same division ``cancel_active_phases``
    keeps.
    """
    await pool.execute(
        "UPDATE workflow_runs SET status = 'paused' WHERE id = $1 AND status NOT IN ('completed', 'failed', 'cancelled')",
        workflow_run_id,
    )


async def resume_run(pool: asyncpg.Pool, workflow_run_id: UUID) -> None:
    """Flip a ``paused`` run back to ``active`` — the answer-triggered re-drive (D-10).

    The exact inverse of ``pause_run`` above and narrower than it on purpose:
    ``AND status = 'paused'`` means this can only ever move a run OUT of the one state
    ``pause_run`` put it in. It cannot resurrect a terminal run, cannot disturb a
    ``cap_paused`` run (whose Continue path owns its own transition), and no-ops on a run
    somebody else already resumed — so two answers racing on two workers produce one
    transition, not two.

    ⚠ WITHOUT THIS, A RE-DRIVEN RUN WOULD REPORT ``paused`` WHILE IT IS RUNNING, which is
    the same class of user-visible lie D-10 exists to remove. The status is the only
    column written; the thread anchor is untouched (it was never cleared — see
    ``pause_run``).

    ⚠ RUN-KEYED write → ``WHERE id = $1``. Ownership is the CALLER's, exactly as above:
    the answer route resolves the run owner-scoped and anchor-confirmed before it ever
    reaches here.
    """
    await pool.execute(
        "UPDATE workflow_runs SET status = 'active' WHERE id = $1 AND status = 'paused'",
        workflow_run_id,
    )


async def get_ask_user_response(
    pool: asyncpg.Pool, run_id: UUID, tool_call_id: str
) -> dict | None:
    """The durable ask_user RESPONSE payload for ``tool_call_id`` — or ``None``.

    ⚠ THIS EXISTS BECAUSE THE RESUME CONTRACT WAS ONLY HALF TRUE, AND THE HALF THAT WAS
    MISSING IS THE ONE A PERSON NOTICES. ``resume_stranded_workflows``' docstring says of
    an already-answered ask_user phase: *"the answer is durable → do NOT re-ask; let
    ``run_workflow`` re-run the phase, which re-reads the durable answer and proceeds."*
    **Nothing re-read it.** ``_exec_llm_human_input`` mints a fresh ``uuid4().hex``
    ``tool_call_id`` on every entry and blocks on a brand-new channel, so a re-driven
    phase asked the question AGAIN. ``ask_user_response_exists`` (:1342) could answer
    *whether* an answer exists but never hand it back.

    It is the EXISTS query above, kept structurally identical and SELECTing the payload
    instead of a boolean — same ``role='system'`` scan (the /pending way, never the
    filtered /snapshot path), same ``ask_user_response`` kind discriminator, same
    per-call id match, and the same RUN-SCOPING correlation (WR-06): the response row
    carries no ``run_id``, so a matching PROMPT row for the SAME ``tool_call_id`` must
    belong to THIS run. A thread with several workflow runs cannot cross-feed answers.

    ⚠ ``expired`` rows are EXCLUDED. The terminal-site cleanup (096-09) writes a row
    shaped exactly like a response but carrying ``expired: true``; consuming one as an
    answer would resurrect precisely the silent-empty-approval this phase removes.

    Returns ``{"response_text": str, "choice_index": int | None}`` for the LATEST
    matching row, or ``None``. Owner-scoping is the caller's, as everywhere in this
    module: the pool bypasses RLS and the ``WHERE`` clause is the boundary.
    """
    row = await pool.fetchrow(
        """
        SELECT r.tool_calls
        FROM messages r
        JOIN workflow_runs wr ON wr.thread_id = r.thread_id
        JOIN messages p
          ON p.thread_id = wr.thread_id
         AND p.role = 'system'
         AND p.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
         AND p.tool_calls->0->>'tool_call_id' = $2
         AND p.tool_calls->0->>'run_id' = $1::text
        WHERE wr.id = $1
          AND r.role = 'system'
          AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
          AND r.tool_calls->0->>'tool_call_id' = $2
          AND COALESCE((r.tool_calls->0->>'expired')::boolean, false) = false
        ORDER BY r.created_at DESC
        LIMIT 1
        """,
        run_id,
        tool_call_id,
    )
    if row is None:
        return None
    tcs = row["tool_calls"] or []
    payload = tcs[0] if tcs else {}
    return {
        "response_text": payload.get("response_text"),
        "choice_index": payload.get("choice_index"),
    }


async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None:
    """Terminal run status write (``completed`` / ``failed`` / ``cancelled``) + lock-clear (SC#2).

    ⚠ CORRECTED (Phase 194). This docstring's first line previously read, verbatim:
    "Terminal run status write (``completed`` / ``failed``) + lock-clear (SC#2)." — and
    it is quoted here rather than deleted, because it was NARROWER THAN THE FUNCTION and
    a reader who trusted it drew exactly the wrong conclusion. It never restricted
    ``status``; it merely failed to mention the third value two shipped callers have been
    passing for a year:
      * ``backend/app/services/run_producer.py:262`` — the F2 harness-failure terminalize
        has passed ``"cancelled"`` since the v2.8 cancel-honesty fix, whenever the
        producer's ``terminal_status`` is ``cancelled`` (a user Stop).
      * ``backend/app/api/workflows.py:1518`` — ``delete_workflow_cascade`` passes
        ``"cancelled"`` for every in-flight run it tears down.
    And the schema has admitted it from the beginning: ``workflow_runs_status_check`` was
    created with ``cancelled`` in ``supabase/migrations/057_workflow_runs.sql:19`` and
    re-asserted in ``063_dual_mode_continue.sql:55-57`` when ``cap_paused`` was added.
    ⇒ THE CORRECTED CONTRACT: a terminal ``workflow_runs`` status write for ``completed``,
    ``failed`` OR ``cancelled``, plus the thread anchor clear, in ONE transaction,
    idempotent on a re-run. Phase 194 adds new callers on the cancel path and the old
    first line would have read as a refusal to serve them.

    ⚠ THE CROSS-WORKER INTERLEAVE — NAMED HERE RATHER THAN GUARDED, because a caller is
    who needs to know. A Stop landing on worker A (``_cancel_run_internals`` Step 3b →
    ``finish_run``) while worker B's producer is mid-F2 can interleave two
    ``UPDATE workflow_runs SET status = $2 WHERE id = $1`` writes against the same row.
    That is safe today for one reason only, and the reason is worth stating precisely:
    the interleave is BENIGN BY VALUE-IDENTITY, NOT BY EXCLUSION — both writes carry the SAME VALUE, row-level locking serialises them, and the anchor clear is idempotent (it finds 0 rows on the second pass).
    THE ONE THING A CALLER MUST NEVER DO IS MAKE THE TWO WRITES DISAGREE — e.g. one passing 'failed' while the other passes 'cancelled'. That prohibition IS the whole guard.
    Nothing here serialises the two workers, and adding a lock would be the wrong fix: the
    value-identity property is cheaper and it is what the shipped paths already satisfy.

    ⚠ THIS FUNCTION WRITES NO ``workflow_phases`` ROW, AND MUST NOT LEARN TO. It is
    called on the ``completed`` path (``harness_engine.py``'s success arm) and by the
    delete cascade; a phase write here would change behaviour on paths Phase 194 must not
    touch. The cancel path's phase terminalize lives in ``cancel_phase`` /
    ``cancel_active_phases`` above, called from the two cancel sites (194 / D-07).

    workflow_runs table, keyed by its own ``id``. Mirror ``_shielded_finalize``:
    this durable UPDATE happens BEFORE the terminal SSE sentinel.

    Phase 092 (092-03 / SC#2, MODE-02): this is the SINGLE authoritative clear
    site for the ``threads.active_workflow_run_id`` anchor on the workflow_runs
    side (Landmine 5 — clear exactly once across the two run rows). The producer's
    runs-row ``finalize_run`` does NOT also clear it for a harness send — the
    anchor FKs to ``workflow_runs.id``, so this run_id IS the FK target. Both
    writes ride ONE transaction so a terminal run can never leave a dangling
    Harness lock (a crash between the two would otherwise strand the thread). The
    anchor-clear is idempotent: a re-run finds 0 matching rows and no-ops.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            # ── L-01 / RUN-01 — THE TERMINAL GUARD (added 2026-08-16) ─────────
            #
            # ⚠ THIS ENFORCES THE PROHIBITION THE DOCSTRING ABOVE ALREADY DECLARES,
            # because that prohibition was prose and prose cannot bind a producer
            # running on another worker. The docstring says the interleave is
            # "BENIGN BY VALUE-IDENTITY" and that "THE ONE THING A CALLER MUST NEVER
            # DO IS MAKE THE TWO WRITES DISAGREE". **Shipped code already breaks it.**
            #
            # Measured (Phase 194, SC#2 FAILED; re-confirmed at 194.1's UAT): at the
            # shipped WORKER_COUNT=2, a Stop landing on worker A writes `cancelled`
            # while worker B's still-running producer reaches its success arm and
            # writes `completed` OVER IT — on roughly HALF of all stops. The user
            # pressed Stop and the run reports that it finished.
            #
            # A terminal status is FINAL. The first terminal write wins; a later,
            # DIFFERENT terminal value is refused. `status = $2` keeps the re-run
            # idempotency the docstring promises (both cancel sites can land twice).
            # Non-terminal states (`active`, `paused`, `cap_paused`) are untouched —
            # they are exactly what this function exists to move a run OUT of.
            #
            # ⚠ WHAT THIS DOES **NOT** FIX, stated here so the guard is never read as
            # more than it is: the far-worker producer KEEPS RUNNING. This makes the
            # run REPORT honestly; it does not make the work STOP. Halting the
            # producer (an in-loop status re-read, or a Redis cancel channel that
            # reaches a producer not parked on an `ask_user:*` channel) is the
            # separate, larger L-01 fix, and it is still OWED. Do not let a ticked
            # RUN-01 be read as "the work stops" — it is not the same claim.
            #
            # ⚠ NOT A SECOND CONCERN (G-5, and this file fires hardest of any backend
            # module at 18 phases): this narrows the WHERE of a status write the
            # function already owns. Zero new writes, zero new params, no schema
            # change, no migration — `status` was already the only column written.
            await con.execute(
                "UPDATE workflow_runs SET status = $2 "
                "WHERE id = $1 "
                "  AND (status IS NULL "
                "       OR status NOT IN ('completed', 'failed', 'cancelled') "
                "       OR status = $2)",
                run_id,
                status,
            )
            # Clear the per-thread lock anchor in the SAME transaction — no
            # dangling lock survives a terminal run (SC#2). Keyed by the FK
            # target (= this run id), so it only clears the thread this run owns.
            #
            # ⚠ DELIBERATELY **UNCONDITIONAL**, and it must stay that way even
            # though the status write above can now be refused. The two are not
            # coupled: a refused status write means the run was ALREADY terminal,
            # in which case the first `finish_run` cleared this anchor and the
            # statement no-ops on 0 rows (the idempotency the docstring promises).
            # Gating the clear on the status write's row count would reintroduce
            # exactly the dangling-lock failure the shared transaction exists to
            # prevent — a thread stranded as locked because a second, refused
            # terminalize skipped the clear.
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = NULL "
                "WHERE active_workflow_run_id = $1",
                run_id,
            )


async def claim_run(
    pool: asyncpg.Pool, run_id: UUID, lease_seconds: int
) -> bool:
    """CAS-claim a run for single-producer execution via a ``claimed_at`` lease.

    CR-01 fix (091-REVIEW): the prior claim did ``SET status='active' WHERE status
    IN ('active','paused')`` — but ``find_resumable_runs`` already returns ``active``
    rows, so the status never left the claimable set and BOTH WORKER_COUNT=2 workers
    matched the WHERE and got a RETURNING row → the run was re-driven twice (the
    exact Pitfall-7 double-execution this is meant to prevent).

    The real CAS stamps the migration-062 ``claimed_at`` lease and only matches when
    the lease is UNSET or EXPIRED::

        UPDATE workflow_runs
        SET claimed_at = now()
        WHERE id = $1
          AND status IN ('active', 'paused')
          AND (claimed_at IS NULL OR claimed_at < now() - $2::interval)
        RETURNING id

    The winner stamps a fresh ``claimed_at``; a racing loser sees that fresh value →
    0 rows → returns False. A crash-mid-resume run becomes re-claimable once the
    lease (``lease_seconds`` — a named engine/config constant, NOT a magic literal)
    expires, so a dead worker's claim never strands the run forever. ``status`` is
    untouched (the lease is orthogonal to status); ``find_resumable_runs`` keeps
    anchoring on ``status IN ('active','paused')``. workflow_runs table, keyed by id.

    ``lease_seconds`` is passed as a Postgres interval via ``make_interval`` so the
    parameter stays a plain ``$N`` (no f-string on SQL — T-091-03).
    """
    row = await pool.fetchrow(
        """
        UPDATE workflow_runs
        SET claimed_at = now()
        WHERE id = $1
          AND status IN ('active', 'paused')
          AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => $2))
        RETURNING id
        """,
        run_id,
        lease_seconds,
    )
    return row is not None


# ── harness_audit (this table's own column IS run_id — correct) ──────────────
async def write_audit(
    pool: asyncpg.Pool,
    run_id: UUID | None,
    *,
    user_id: UUID | None,
    event_type: str,
    metadata: dict,
) -> None:
    """INSERT one ``harness_audit`` row (INSERT-only RLS).

    ``run_id`` is ``UUID | None`` (IN-02): the ``harness_audit.run_id`` column IS
    nullable (full-schema.sql:452). A NULL ``run_id`` is the NULLABLE-RECEIPT
    CONTRACT for receipts that precede any run — the Phase-102 stage-0/1/2
    ``publish_blocked`` receipts are written BEFORE a golden run exists, so they key
    to a NULL ``run_id`` and carry the definition id in ``metadata`` instead. A
    keyed receipt (run created) passes the real run id; both are valid.

    ``event_type`` MUST be one of the kinds in the 059 + 069 + 070 + 114 + 117 CHECK
    (9 harness lifecycle/gate kinds + 7 Phase-101.1 emit-transition kinds + 6
    Phase-102 judge/publish/policy/ask_user-approval receipt kinds + the 1
    Phase-185 armed-action-risk-pause kind + the 1 Phase-190 send-receipt
    kind) — asserted here against
    ``_AUDIT_EVENT_TYPES`` so a typo fails fast in tests (ValueError), not as a
    Postgres 23514 mid-run (Pitfall 6). The count is deliberately NOT written out
    as a number anywhere it could go stale: the error message below derives it from
    ``len(_AUDIT_EVENT_TYPES)``. The ``harness_audit`` table's own foreign-key
    column IS ``run_id`` — this predicate is correct.

    Phase 185 BUG-260731-02: ``action_risk_pending`` was emitted by
    ``harness_engine`` while registered in NEITHER this set NOR the Postgres CHECK,
    so an armed action-risk checkpoint did not park — it killed the run on its own
    audit write (``workflow_runs.id = 80c8823d``). Both layers were extended; the
    hardcoded "22" that made this docstring and the ValueError below go stale was
    replaced with a derived count; and
    ``tests/unit/test_audit_event_registration.py`` now guards the whole class.

    Phase 092-05 F1: ``harness_audit.user_id`` is NOT NULL, but this INSERT
    previously OMITTED it — the first audit write of any live run raised
    ``NotNullViolationError`` and killed the run before any phase executed (the
    bug was mock-only-invisible until the first live run in Phase 092). The
    run-owner ``user_id`` (threaded from ``ctx.current_user`` at every call site)
    is now bound explicitly. It is keyword-only so no caller can re-introduce the
    omission silently.
    """
    if event_type not in _AUDIT_EVENT_TYPES:
        # Count derived, never hardcoded — a stale literal number here is what made
        # BUG-260731-02's own error message misleading (it said "22" while the set
        # was the thing that needed changing).
        raise ValueError(
            f"write_audit event_type must be one of the "
            f"{len(_AUDIT_EVENT_TYPES)} harness_audit kinds "
            f"(059 + 069 + 070 + 114 + 117), got {event_type!r}"
        )
    await pool.execute(
        "INSERT INTO harness_audit (run_id, user_id, event_type, metadata) "
        "VALUES ($1, $2, $3, $4::jsonb)",
        run_id,
        user_id,
        event_type,
        json.dumps(metadata),
    )


# ── Phase 204 (SCHED-02 / D-204-07) — the circuit-breaker trip record ────────
async def record_circuit_breaker_trip(
    pool: asyncpg.Pool,
    run_id: UUID,
    record: dict,
    *,
    user_id=None,
) -> None:
    """The DURABLE evidence that a policy — not a person — stopped this run.

    TWO writes, in this order, and the order is the point: the ``harness_audit`` receipt
    first, the ``workflow_runs.metadata`` detail second, and BOTH before the caller
    terminalizes anything (``CircuitBreaker.trip_breaker``'s step 2). The threat this
    answers is *audit evasion* — a run killed for spending too much must leave a record
    saying so, with the exact numbers, or the ledger cannot tell it apart from a user
    pressing Stop. Both paths end ``cancelled``.

    ⚠ IT RAISES. Unlike ``cancel_workflow_run_internals``, this is NOT best-effort at this
    layer — the caller owns that decision and wraps it, so a failure is visible in the log
    with a real traceback instead of being swallowed one level too early. The rule the
    caller enforces is "the bookkeeping is best-effort and the halt is not"; the rule HERE
    is simply "say what went wrong".

    ⚠ THE ``metadata`` PARAMETER IS THE PLAIN DICT — NEVER A PRE-DUMPED STRING (200.1 /
    D-200.1-01(b)). The pool installs a jsonb codec whose encoder IS ``json.dumps``
    (``dependencies._init_pg_connection``, D-073-06), so a pre-encoded string is encoded a
    SECOND time and lands as a jsonb STRING SCALAR — measured at 484 of 484 ``completed``
    rows on ``workflow_phases.output`` before it was fixed, and the root cause of migration
    122 one column over. ⚠ **THE FIX IS TO STOP PRE-ENCODING, NEVER TO ADD A CAST**:
    ``$2::jsonb`` is fine and stays. ``write_audit`` above is the deliberate exception and
    is NOT a counter-example — it binds a ``text`` parameter that the cast then PARSES, a
    different (and equally correct) shape that predates the codec.

    ⚠ ``||`` MERGES, IT DOES NOT REPLACE, AND ``COALESCE`` IS WHAT MAKES THAT WORK ON A
    NULL. ``metadata`` is nullable with no default (migration 125 — ``ADD COLUMN`` with no
    default is catalog-only and rewrites no rows), and ``NULL || anything`` is ``NULL`` in
    Postgres. Without the coalesce every trip on every pre-125 row would write nothing at
    all and report success.

    ⚠ THE ``WHERE`` CLAUSE IS THE ACCESS BOUNDARY. This module writes through a
    service-role pool that BYPASSES RLS, so — exactly as the terminal phase writers above
    record — the predicate is the only thing scoping the write. It takes a key and no
    user-supplied filter; ownership is the CALLER's (T-147-06).
    """
    await write_audit(
        pool,
        run_id,
        user_id=user_id,
        event_type="circuit_breaker_tripped",
        metadata=record,
    )
    await pool.execute(
        "UPDATE workflow_runs "
        "SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now() "
        "WHERE id = $1",
        run_id,
        # THE PLAIN DICT — see the codec paragraph above.
        {"circuit_breaker": record},
    )


async def arm_run_budget(
    pool: asyncpg.Pool,
    run_id: UUID,
    *,
    max_tokens_per_run: int | None,
    max_duration_seconds: int | None,
) -> None:
    """Write a scheduled run's circuit-breaker limits where ``load_run_budget`` reads them.

    ⚠ THIS FUNCTION EXISTS BECAUSE THE TWO HALVES OF PHASE 204 DISAGREED, AND THE
    DISAGREEMENT WAS INVISIBLE TO 106 PASSING TESTS. 204-03's scheduler wrote the caps
    into ``workflow_runs.inputs`` (as ``_schedule_max_tokens_per_run`` /
    ``_schedule_max_duration_seconds``); 204-02's ``load_run_budget`` reads them from the
    TOP LEVEL of ``workflow_runs.metadata``. ``scheduler_service.py`` contained zero
    occurrences of the word ``metadata``. The two plans ran in parallel waves and each
    mocked the other's side, so both suites were green and neither crossed the seam.

    Measured on a live scheduled run (2026-08-24, run 27e00e7e): ``metadata`` was NULL and
    the run passed **3m20s against a 120-second cap** without tripping. Because
    ``load_run_budget`` FAILS OPEN by design, the breaker silently disarmed and the run
    behaved exactly as if Phase 204 had never shipped — the "built, gated, green,
    structurally unreachable" shape (Phase 200 SC#3, Phase 118).

    ⚠ THE CAPS BELONG IN ``metadata``, NOT ``inputs``, AND THE DIRECTION OF THE FIX IS THE
    DECISION. ``inputs`` is the AUTHOR's kickoff payload — it is echoed to the run surface
    and handed to the definition; system-imposed ceilings are not the author's data and a
    caller could legitimately overwrite them. ``metadata`` is what migration 125 created
    for precisely this, and ``load_run_budget`` already carries the string-scalar defence.

    ⚠ MERGE, NEVER REPLACE, AND COALESCE FIRST. ``metadata`` is nullable with no default,
    and ``NULL || anything`` is ``NULL`` in Postgres — without the coalesce this would
    write nothing and report success. The merge is what lets
    ``record_circuit_breaker_trip`` later add its ``circuit_breaker`` key without
    clobbering the budget that armed it.

    ⚠ A PLAIN DICT IS BOUND, NEVER ``json.dumps``. The pool registers a jsonb codec
    (``dependencies.py::_init_pg_connection``), so pre-encoding stores a STRING SCALAR and
    every later arrow read returns NULL — the defect that shipped on 484 of 484
    ``workflow_phases.output`` rows and was repaired by migration 123.

    ⚠ THE ``WHERE`` CLAUSE IS THE ACCESS BOUNDARY. This module writes through a
    service-role pool that BYPASSES RLS; the predicate takes a key and no user-supplied
    filter, so ownership is the CALLER's (T-147-06).

    A ``None`` on either limit is written as SQL NULL, which ``load_run_budget``'s
    ``_positive_int`` already reads back as "no ceiling on this axis" — so a schedule with
    one cap set and one absent arms exactly one half of the breaker.
    """
    await pool.execute(
        "UPDATE workflow_runs "
        "SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now() "
        "WHERE id = $1",
        run_id,
        # THE PLAIN DICT — see the codec paragraph above.
        {
            "max_tokens_per_run": max_tokens_per_run,
            "max_duration_seconds": max_duration_seconds,
        },
    )


async def load_run_budget(pool: asyncpg.Pool, run_id: UUID) -> dict:
    """Read a run's circuit-breaker limits + its wall-clock anchor (SCHED-02).

    Returns ``{"max_tokens_per_run", "max_duration_seconds", "started_at"}`` — any of
    which may be ``None``. 204-03's scheduler writes the two limits into
    ``workflow_runs.metadata`` when it mints an unattended run; an interactive run has
    none and gets a disarmed breaker.

    ⚠ IT FAILS **OPEN**, AND THAT DIRECTION IS A DECISION WITH A COST WORTH STATING. If
    migration 125 has not been applied, or the column read raises for any other reason,
    this returns empty limits — so the breaker is DISARMED and the run behaves exactly as
    it did before Phase 204. Failing closed would mean a transient database blip killed
    every in-flight run across every worker at once, turning a hiccup into a fleet-wide
    outage; that is the same argument ``is_run_cancelled`` makes for its own fail-open
    (204-01). ⚠ THE COST IS REAL AND IS NOT HIDDEN: an unapplied migration silently
    disarms the spend cap. That is why the failure is logged at exception level with the
    run id, and why migration 125 is owed an apply before any scheduled run exists.

    ⚠ THE ANCHOR IS A SERVER TIMESTAMP, NEVER ``now()``. ``claimed_at ?? created_at`` are
    the same two columns the run page's elapsed reads (Phase 200 F3/F6). A resumed run
    that re-anchored on the current time would hand itself a fresh full wall-clock budget
    on every restart, which is precisely how a duration cap stops capping anything.
    """
    empty = {
        "max_tokens_per_run": None,
        "max_duration_seconds": None,
        "started_at": None,
    }
    try:
        row = await pool.fetchrow(
            "SELECT metadata, claimed_at, created_at FROM workflow_runs WHERE id = $1",
            run_id,
        )
    except Exception:
        logger.exception(
            "circuit-breaker budget read failed for run %s — the run proceeds with NO "
            "limits (fail-open). If migration 125 is unapplied, the spend cap is off.",
            run_id,
        )
        return empty
    if row is None:
        return empty

    meta = row.get("metadata")
    # The string-scalar defence, applied at the point of read rather than assumed away:
    # a row written by any path that pre-encoded would decode to a `str` here, and
    # `.get` on a string raises. 527 of 588 `workflow_phases.output` values were in
    # exactly that state (200.1), so this is a measured shape, not a hypothetical one.
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except (TypeError, ValueError):
            meta = None
    if not isinstance(meta, dict):
        meta = {}

    def _positive_int(value) -> int | None:
        # `bool` is excluded because it subclasses `int` — True would read as a 1-token
        # budget, which is the shape `declared_phase_measure` records being bitten by.
        if isinstance(value, bool) or value is None:
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed > 0 else None

    return {
        "max_tokens_per_run": _positive_int(meta.get("max_tokens_per_run")),
        "max_duration_seconds": _positive_int(meta.get("max_duration_seconds")),
        "started_at": row.get("claimed_at") or row.get("created_at"),
    }
