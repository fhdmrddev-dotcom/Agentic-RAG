"""asyncpg-backed helpers for the harness workflow tables (Phase 091 / HARNESS-03).

These typed helpers mirror ``backend/app/db/runs.py`` (the D-073 asyncpg hot-path
precedent): an asyncpg pool, parameterized ``$N`` placeholders only (no f-strings
on SQL — T-073-02 / T-091-03), and small return shapes the Phase 091 engine
(``harness_engine.run_workflow``) consumes.

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
from uuid import UUID

import asyncpg

from app.models.harness import WorkflowDefinition

# harness_audit.event_type CHECK (migration 059 = 9 kinds; migration 069 = +7 emit
# kinds → 16; migration 070 = +6 judge/publish/policy/ask_user-approval kinds → 22;
# migration 114 = +1 armed action-risk pause kind → 23 total). Validate in code so a
# typo fails fast in tests, not as a Postgres 23514 mid-run (Pitfall 6). MUST stay IN
# LOCKSTEP with the 069 + 070 + 114 CHECK — a mismatch is the exact fail-fast this set
# exists for (Phase 101.1 D-12 / Phase 102 D-12).
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

    Returns the new workflow_run id.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            run_id = await con.fetchval(
                """
                INSERT INTO workflow_runs (thread_id, definition_id, status, inputs, model, user_id, is_golden_run)
                VALUES ($1, $2, 'active', $3::jsonb, $4, $5, $6)
                RETURNING id
                """,
                thread_id,
                definition_id,
                json.dumps(inputs),
                model,
                user_id,
                is_golden_run,
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
        sql = (
            "SELECT id, slug, name, definition FROM workflow_definitions "
            "WHERE status = 'published' AND created_by = $1"
        )
    else:
        sql = (
            # Phase 103-06 (REQ-7 D9/D10): the Workflows page card derives the
            # client-side strictness tier (deriveTier) + the phase-type chain from
            # the REAL definition JSONB, so the list additionally returns
            # ``definition``. This is purely ADDITIVE — the pre-103 id/slug/name
            # picker callers ignore the extra column (asyncpg's pool codec decodes
            # the JSONB to a dict).
            "SELECT id, slug, name, definition FROM workflow_definitions "
            "WHERE status = 'published' AND (is_system_global = true OR created_by = $1)"
        )
    params: list = [user_id]
    if project_folder_id is not None:
        params.append(str(project_folder_id))  # definition->>'key' returns TEXT → bind str
        sql += f" AND definition->>'project_folder_id' = ${len(params)}"
    sql += " ORDER BY name"
    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


async def list_starter_workflows(pool: asyncpg.Pool) -> list[dict]:
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
    """
    rows = await pool.fetch(
        "SELECT id, slug, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND is_system_global = true "
        "AND definition->>'category' = 'starter' "
        "ORDER BY name"
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

    Returns ``{id, slug, version, name, status, definition, created_by}`` or
    ``None``. ``definition`` is the JSONB the caller ``model_validate``s into a
    ``WorkflowDefinition`` (asyncpg's pool codec decodes it to a dict).
    """
    row = await pool.fetchrow(
        "SELECT id, slug, version, name, status, definition, created_by "
        "FROM workflow_definitions "
        "WHERE id = $1 AND (created_by = $2 OR (is_system_global = true AND status = 'published'))",
        definition_id,
        user_id,
    )
    return dict(row) if row is not None else None


async def publish_definition(pool: asyncpg.Pool, definition_id: UUID) -> int:
    """Flip a definition ``status`` draft -> published (D-07), RETURNING the version.

    The ONLY draft->published flip site. Mirrors ``finish_run``'s
    ``UPDATE ... SET ... WHERE id=$1`` status-flip shape (``$N`` only). The
    ``workflow_definitions_block_published_update`` immutability trigger ALLOWS
    this transition (it only blocks an UPDATE where ``OLD.status='published'`` —
    a published->edit), so the draft->published flip is the allowed path while a
    published row stays frozen (T-102-05-05 / the 091 immutability invariant).

    The ``status='draft'`` WHERE guard makes a double-publish a no-op (idempotent):
    a re-flip finds 0 matching rows and returns ``-1``. The caller (publish_service)
    has already owner-checked + state-checked, so ``-1`` here means "not a draft /
    already published / not found" — a defensive sentinel, not the happy path.

    Returns the published ``version`` (for the D-08 success verdict), or ``-1``.
    """
    row = await pool.fetchrow(
        "UPDATE workflow_definitions SET status = 'published' "
        "WHERE id = $1 AND status = 'draft' RETURNING version",
        definition_id,
    )
    return row["version"] if row is not None else -1


# ── draft CRUD (Phase 103 / REQ-1 / WFAUTH-01) ───────────────────────────────
# The authoring substrate the Workflows page (Plan 06) + Builder (Plan 04) sit on.
# Mirror the in-file owner-scoped ``$N``-only precedent (get_definition /
# list_published_workflows / create_workflow_run). The service-role engine bypasses
# RLS, so EVERY query self-scopes ``created_by = $N`` (a second user's draft is
# absent — T-103-01-01). ``$N`` placeholders only (no f-string on SQL).
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

    Returns ``{id, version}``.
    """
    row = await pool.fetchrow(
        "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
        "VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, false) "
        "RETURNING id, version",
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
        "SELECT id, slug, version, name, definition FROM workflow_definitions "
        "WHERE status = 'draft' AND created_by = $1 "
        "ORDER BY name",
        user_id,
    )
    return [dict(r) for r in rows]


async def update_workflow_definition(
    pool: asyncpg.Pool, definition_id: UUID, *, definition: WorkflowDefinition, user_id: UUID
) -> dict | None:
    """UPDATE a DRAFT's ``name`` + ``definition`` JSONB (REQ-1 PATCH), RETURNING
    ``{id, version}`` or ``None``.

    Owner-scoped + draft-only (``id = $1 AND created_by = $2 AND status = 'draft'``):
    a row not owned by the caller, not a draft, or not found matches 0 rows -> ``None``
    (the route maps ``None`` -> 404; no existence leak — the get_definition precedent).

    PUBLISHED-ROW FREEZE (T-103-01-02): the immutability trigger
    ``workflow_definitions_block_published`` raises Postgres ``23514`` on a published-row
    UPDATE. The ``status='draft'`` WHERE guard makes the normal published-row PATCH a
    0-row no-op (-> ``None`` -> 404). The trigger is NOT caught here — it is left to
    PROPAGATE as ``asyncpg.exceptions.CheckViolationError`` so the route maps it to HTTP
    409 (mirroring ``publish_definition``'s draft->published trigger note: the trigger is
    the source of truth; the route maps the exception, never a silent overwrite or a 500).
    ``$N`` placeholders only.

    Returns ``{id, version}`` or ``None``.
    """
    row = await pool.fetchrow(
        "UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
        "WHERE id = $1 AND created_by = $2 AND status = 'draft' "
        "RETURNING id, version",
        definition_id,
        user_id,
        definition.name,
        json.dumps(definition.model_dump(mode="json")),
    )
    return dict(row) if row is not None else None


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
        SELECT id, slug, phase_index, status, output
        FROM workflow_phases
        WHERE workflow_run_id = $1
        ORDER BY phase_index
        """,
        run_id,
    )
    return [dict(r) for r in rows]


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
    """
    rows = await pool.fetch(
        """
        SELECT wr.id AS run_id, wr.thread_id, wr.current_phase_id, wr.inputs,
               wr.org_id, t.user_id
        FROM workflow_runs wr
        JOIN threads t ON t.id = wr.thread_id
        WHERE wr.status IN ('active', 'paused')
          AND t.active_workflow_run_id = wr.id
          AND EXISTS (
            SELECT 1 FROM workflow_phases wp
            WHERE wp.workflow_run_id = wr.id
              AND wp.status = 'active'
          )
        """
    )
    return [dict(r) for r in rows]


async def get_active_phase(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The single ``status='active'`` phase row for a stranded run (resume target).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — column does not exist
    on workflow_phases; would raise Postgres 42703). Returns id/slug/phase_index/
    status/output, or ``None`` if no phase is active (already advanced).
    """
    row = await pool.fetchrow(
        """
        SELECT id, slug, phase_index, status, output
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
async def mark_phase_active(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Flip a phase to ``active`` BEFORE its work runs (Pitfall 1: durable-first).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='active', updated_at=now() WHERE id = $1",
        phase_id,
    )


async def complete_phase(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    """Flip to ``completed`` AND write ``output`` in ONE atomic UPDATE.

    Called ONLY after the output is durable. The status flip and the output
    write are a single statement (never two) so a crash between them is
    impossible — the resumability invariant (HARNESS-03).
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(output),
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
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(payload),
    )


async def skip_phase(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Mark a phase ``skipped`` (skip_to_phase routing — Plan 05).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='skipped', updated_at=now() WHERE id = $1",
        phase_id,
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


async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None:
    """Terminal run status write (``completed`` / ``failed``) + lock-clear (SC#2).

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
            await con.execute(
                "UPDATE workflow_runs SET status = $2 WHERE id = $1",
                run_id,
                status,
            )
            # Clear the per-thread lock anchor in the SAME transaction — no
            # dangling lock survives a terminal run (SC#2). Keyed by the FK
            # target (= this run id), so it only clears the thread this run owns.
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

    ``event_type`` MUST be one of the kinds in the 059 + 069 + 070 + 114 CHECK (9
    harness lifecycle/gate kinds + 7 Phase-101.1 emit-transition kinds + 6
    Phase-102 judge/publish/policy/ask_user-approval receipt kinds + the 1
    Phase-185 armed-action-risk-pause kind) — asserted here against
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
            f"(059 + 069 + 070 + 114), got {event_type!r}"
        )
    await pool.execute(
        "INSERT INTO harness_audit (run_id, user_id, event_type, metadata) "
        "VALUES ($1, $2, $3, $4::jsonb)",
        run_id,
        user_id,
        event_type,
        json.dumps(metadata),
    )
