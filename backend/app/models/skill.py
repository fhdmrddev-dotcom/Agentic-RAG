from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SkillCreate(BaseModel):
    name: str
    description: str = ""
    instructions: str = ""
    is_global: bool = False


class SkillUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None


class SkillResponse(BaseModel):
    id: UUID
    # SEED-091 / D-164-05 (TEN-06): nullable owner. A non-owner reader of an is_global OR
    # is_system skill gets user_id=None at serialize time (the seeding owner — e.g. the
    # built-in skill-creator's admin — is not disclosed). Mirrors ViewResponse.user_id.
    user_id: UUID | None
    name: str
    description: str
    instructions: str
    is_enabled: bool
    is_global: bool
    # CREATE-01 (D-01): OUTPUT-ONLY "Built-in" trust badge. The client READS this
    # (GET /skills carries it); it is NEVER accepted from a request body — SkillCreate
    # /SkillUpdate deliberately omit it (badge-spoofing mitigation, threat T-137.2-02).
    # The `= False` default is load-bearing: pre-migration-087 DB rows and older mocked
    # test rows omit the column and must keep deserializing.
    is_system: bool = False
    created_at: datetime
    updated_at: datetime
    # TRIG-03 (D-09): non-blocking save-time description lint warnings.
    # Always populated by create/update; None on rows that did not run the lint.
    lint_warnings: list[dict] | None = None


class SkillFileResponse(BaseModel):
    id: UUID
    skill_id: UUID
    # SEED-091 / D-164-05 (TEN-06, A3-confirmed): nullable owner. list_skill_files surfaces
    # the seeding owner's user_id on a non-owner's read of a global skill's files (the parent
    # skill is reachable via the is_global branch), so the foreign owner is nulled there.
    user_id: UUID | None
    filename: str
    file_path: str
    file_size: int
    mime_type: str
    created_at: datetime


class PublishGate(BaseModel):
    """GATE-01 publish-gate read model (Phase 136, computed by publish_gate_service).

    ``met`` is recomputed from the NUMERIC ``eval_runs.passed_count`` / ``measured_count``
    columns (D-03 — never the ``verdict_summary`` display text) and bound to the skill's
    CURRENT instructions by content-equality (D-04). ``last_override`` is the most-recent
    owner-visible force-publish record for this skill (``{gate_state, created_at}``), or
    None when never overridden (D-02/D-06).
    """

    met: bool
    # Literal union: "never_evaled" | "latest_failed" | "passed_on_older_version" | "passed"
    state: str
    measured: int | None
    passed: int | None
    passing_run_id: str | None
    reason: str
    last_override: dict | None = None


class TogglePublishBody(BaseModel):
    """Optional body for the gated private→global toggle: an EXPLICIT force-publish flag.

    The server ignores everything else — it recomputes the gate itself (a client can never
    fabricate a passing eval, D-07); ``override=True`` only reaches the write path after
    ownership + gate recompute, and is RECORDED in skill_publish_overrides (D-01/D-02).
    """

    override: bool = False


class SkillImportError(BaseModel):
    skill: str
    error: str


class SkillImportResult(BaseModel):
    created: list[SkillResponse]
    errors: list[SkillImportError]
