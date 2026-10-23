"""Phase 286 (REG-07, plan 286-01, 2026-10-18) — the ``/workflows`` wire models and pure helpers.

Moved VERBATIM out of ``app/api/workflows.py`` (the G-5 extraction owed since Phase 214), in
base order, each with the comment lines that sat directly above it. ``workflows.py`` re-imports
every name, so ``app.api.workflows.<Name>`` resolves to the SAME object it always did, and the
routes there still name these models as ``response_model`` / body types. Their field sets and
docstrings are unchanged, so the OpenAPI schema is byte-identical to the base — pinned by
``tests/unit/test_286_workflows_seam_pins.py``, committed before this module existed.

What lives here (20 symbols): ``_coerce_definition``, ``_caller_uuid``, ``_iso_or_none``,
``DraftCreateResponse``, ``Verdict``, ``ValidateResponse``, ``PaletteFolder``, ``PaletteSkill``,
``GroundingBundleResponse``, ``PublishRequest``, ``BlockedStep``, ``PublishVerdict``,
``_coerce_user_id``, ``_ALREADY_PUBLISHED_DETAIL``, ``DeletePreview``, ``_owned_slug_or_404``,
``_TEMPLATE_MIME_BY_EXT``, ``TemplateAssetRef``, ``TemplatePlaceholdersResponse``,
``_TEMPLATE_MAX_UNCOMPRESSED_BYTES``.

⚠ ``_owned_slug_or_404`` is the owner-gate for the stored-template doors and the delete/preview
routes: its ``created_by = $2`` WHERE is the ONLY authorization boundary on a service-role pool.
It takes the pool as a PARAMETER, so it reads no module-level name a test could patch, and its
body is byte-identical to the base (AST pin).

What STAYED in ``workflows.py``, and the fence or patch that pins it there:
  * ``PublishedWorkflow``, ``DraftRow`` — ``test_library_run_facts.py`` counts their
    ``has_any_run: bool | None = None`` declarations (== 2) in ``inspect.getsource(workflows)``.
  * the severity block, its six code sets and ``_severity`` — ``test_187_route_assigned_reach.py``
    pins the block's "the 3 codes THIS route mints itself" line in workflows.py's text.
  * ``validate_workflow`` — ``test_publish_service.py`` asserts ``__module__ == "app.api.workflows"``.
  * ``get_grounding_bundle`` and every draft/publish/delete handler — tests patch
    ``app.api.workflows.get_pg_pool`` and friends for them (D-03).

⛔ A LEAF. Imports only stdlib, pydantic and fastapi. It never imports ``app.api.workflows`` or
``app.api.workflow_authoring_doors`` — both import THIS module.
"""
from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field


def _coerce_definition(raw: object) -> dict | None:
    """Decode the ``definition`` JSONB column to a dict for the wire.

    asyncpg returns the JSONB column as a raw JSON string when no pool codec is
    registered (db/workflows.py:278) — mirror publish_service's defensive decode
    (:103-109): a string is ``json.loads``-ed, a dict passes through, anything
    unparseable degrades to ``None`` (the client tolerates a missing definition).
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            import json

            decoded = json.loads(raw)
            return decoded if isinstance(decoded, dict) else None
        except (ValueError, TypeError):
            return None
    return None


def _caller_uuid(current_user: dict) -> UUID | None:
    """The authenticated caller's id as a ``UUID`` — the one coercion both feeds share.

    Phase 192 (D-04): ``get_published_workflows`` already normalises ``current_user["id"]``
    through ``UUID(...)`` when it is a ``str`` before handing it to the db layer. ``is_mine``
    must be computed IDENTICALLY in ``/published`` and ``/starters``, so the coercion lives
    in ONE place rather than being retyped per handler (a retyped coercion is how the two
    endpoints silently disagree). Returns ``None`` when the id is absent or unparseable, so
    ``is_mine`` degrades to ``False`` — never to a 500 on a read path the RUN CARVE-OUT
    protects.
    """
    raw = current_user.get("id")
    if isinstance(raw, UUID):
        return raw
    if isinstance(raw, str):
        try:
            return UUID(raw)
        except ValueError:
            return None
    return None


def _iso_or_none(raw: object) -> str | None:
    """A row's ``updated_at`` as an ISO-8601 ``str`` — the ONE coercion all THREE feeds share.

    Phase 192.1 (LIB-05 / D-15). It lives in one place for the reason ``_caller_uuid`` above
    does: ``updated_at`` is serialized by ``/published``, ``/starters`` AND ``/drafts``, and a
    coercion retyped per handler is how three endpoints silently come to disagree about the
    same column. asyncpg decodes ``timestamptz`` to a ``datetime``, so the live path is
    ``.isoformat()``.

    TYPED ``str`` ON THE WAY OUT, NEVER ``datetime``, AND THAT IS BINDING — see the field
    docblocks on ``PublishedWorkflow.updated_at`` and ``DraftRow.updated_at``. A
    ``datetime``-typed model field re-serializes through Pydantic and DROPS the fractional
    part when microseconds are 0, so the wire string's width would vary with the clock.
    Formatting HERE makes the wire value exactly what the database returned.

    Tolerates a ``str`` already (a hand-built row dict in a test, or a driver configured with
    a text codec) and answers ``None`` for a missing/NULL column, so a caller degrades to "no
    changed segment" rather than raising on a read path the RUN CARVE-OUT protects.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw
    isoformat = getattr(raw, "isoformat", None)
    return isoformat() if callable(isoformat) else None


# ── Phase 103 (REQ-1 / WFAUTH-01) — draft CRUD response shapes ────────────────
class DraftCreateResponse(BaseModel):
    """The create/PATCH return — the new (or updated) draft id + its version.

    Phase 186 (CONCUR-02 / D-186-07): ``token`` is the ADDITIVE opaque optimistic
    concurrency token of the row AS OF THIS RESPONSE. On a PATCH it is the POST-write
    value, so the client chains its next autosave with no extra read. Old callers that
    ignore the field stay valid — nothing about ``id``/``version`` changed.

    TYPED ``str``, NEVER ``datetime``, AND THAT IS BINDING. A ``datetime``-typed field
    re-serializes through Pydantic, which DROPS the fractional part when microseconds are
    0 — the token width would then vary with the clock and a save could compare unequal to
    itself. The client echoes this string VERBATIM and must never parse it (a JS ``Date``
    truncates to milliseconds; probed, it matches 0 rows)."""

    id: UUID
    version: int
    token: str


class Verdict(BaseModel):
    """One static-gauntlet finding, per-node (SC#4).

    ``code`` is the machine literal, and every one of them is OWNED by the module that emits
    it (WR-05): the 5 ``reachability.LINT_CODES`` values, the 3
    ``grounding.GROUNDING_VERDICT_CODES`` values (``folder_scope`` / ``unregistered_tool`` /
    ``unregistered_skill``), and the 3 ``_ROUTE_ASSIGNED_CODES`` this route mints itself
    (``business_requirement`` / ``interactive_phase`` / ``unbound_retrieval``). ``phase`` is
    the phase ``slug`` — the
    node identity the canvas paints on (the 181/183 ``node id == phase.slug`` contract) — or
    ``None`` for a workflow-global finding. ``severity`` is the ONLY net-new field (D-182-03):
    an ORTHOGONAL UI hint (``error`` = broken/red, ``incomplete`` = still-building/grey), NOT
    a pass/fail axis — both severities block a publish."""

    code: str
    phase: str | None = None
    message: str
    severity: Literal["error", "incomplete"]


class ValidateResponse(BaseModel):
    """The ``{ok, verdicts}`` envelope — vocabulary aligned with the existing
    ``{ok, error, detail}`` grounding shape + the D-08 publish verdict (no new vocabulary).

    ``ok == (verdicts == [])``: the FULL static gauntlet is clean, i.e. "this can pass the
    static half of publish now". An ``incomplete``-only verdict set still sets ``ok False``
    (an unfinished draft cannot publish either)."""

    ok: bool
    verdicts: list[Verdict] = Field(default_factory=list)


class PaletteFolder(BaseModel):
    """One KB folder the canvas may bind a ``project_folder_id`` / ``folder_scope`` to.

    An EXPLICIT projection (CR-02). ``bundle.folders`` are raw
    ``fetch_all_folders(supabase, fields="*")`` rows — i.e. EVERY column of ``public.folders``
    (``id, user_id, name, parent_id, is_org_shared, created_at, updated_at, org_id``). Raw DB
    rows must NEVER reach the wire on this surface:

      * ``org_id`` is deliberately absent — ``FolderResponse`` does not expose it either, and a
        tenant identifier is not a palette field.
      * the owner ``user_id`` is deliberately absent — SEED-091 / D-164-05 (TEN-06): a
        non-owner reader of an org-shared folder must not learn who seeded it. Omitting the
        column outright is strictly stronger than nulling it.
      * ``created_at`` / ``updated_at`` are noise the palette never renders.

    ``id`` / ``name`` / ``parent_id`` is not a guess at what the canvas needs — it is exactly
    what ``grounding._render_folder_tree`` consumes to build the tree, so the picker can render
    the full hierarchy from this and nothing more."""

    id: UUID
    name: str
    parent_id: UUID | None = None


class PaletteSkill(BaseModel):
    """One enabled skill eligible for a phase ``skill_ref`` — id + display name ONLY (CR-02).

    ``bundle.skills`` rows carry the owner ``user_id`` (and, post-CR-01, ``org_id`` /
    ``is_system`` / ``is_enabled``, which the org-gated visibility post-filter needs). None of
    that is palette data. ``skill_ref`` binds to the ``id``; the name is the label
    ``render_grounding_prompt`` also shows. ``name`` is Optional purely so a degenerate row can
    never 500 a read-only palette."""

    id: UUID
    name: str | None = None


class GroundingBundleResponse(BaseModel):
    """The server-sourced PALETTE of valid building blocks (D-182-01).

    This is what Phase 184's node-config dropdowns bind to — the tool names eligible for an
    ``available_tools`` whitelist, the KB folder tree (name + id), the enabled owner/org-shared
    skills eligible for ``skill_ref``, and (only when a ``template_asset_id`` is supplied) that
    template's placeholder fields. **It is NEVER a frontend constant** (Pitfall 1 / SC#2): KB
    content can never whitelist itself, so the valid sets are computed server-side by the ONE
    shared ``grounding.assemble_grounding_bundle``.

    Kept a SEPARATE cacheable ``GET`` rather than embedded in the ``/validate`` response
    (D-182-01): ``/validate`` fires on every canvas edit; the palette is near-static."""

    tools: list[str] = Field(default_factory=list)
    # Phase 185 (D-185-09 / GOVERN-01) — the KB-READING tool names. The client intersects
    # this with a phase's ``available_tools`` so the grounding dial, the strike-through on the
    # loose side and the canvas seal all move on the SAME render as a tool chip: no debounce,
    # no reload, and no network hop just to print a refusal reason.
    #
    # THE CLIENT NEVER ENFORCES. Req 4's run-time gate is unconditional and server-side, so a
    # wrong client read is a DISPLAY bug by construction and never a safety hole. What the
    # client must not do is own the LIST — a hardcoded frontend copy is a second copy of the
    # safety-defining names, and the day a 6th KB tool lands backend-side the canvas silently
    # stops marking it (the exact drift D-182-06's RED LINE was written against).
    #
    # NOT filtered by ``tools``, and NOT suppressed when ``degraded`` is non-empty: this is the
    # safety-DEFINING list, not a per-caller registry read, and a degraded folder/skill read
    # must never silently un-mark a locked step.
    kb_tools: list[str] = Field(default_factory=list)
    # CR-02: EXPLICIT per-row models, never ``list[dict]``. A bare ``list[dict]`` shipped the raw
    # ``folders``/``skills`` DB rows verbatim — leaking ``org_id`` + the seeding owner's
    # ``user_id`` on a brand-new surface, bypassing the projection every sibling read applies.
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)
    # Round-3 CR-02 / verification Truth 8: the names of the registries that could NOT be
    # resolved for this request (``"folders"`` / ``"skills"``), sorted for a stable payload.
    # EMPTY is the only value that means "this palette is complete".
    #
    # Without this field the route was a LIAR AT SCALE, and specifically a liar this phase
    # introduced: plan 182-11 moved the folders/skills read failure OUT of an exception
    # (a loud 500 the canvas could not mistake for data) and INTO ``GroundingBundle.degraded``
    # — a field this handler then never read. A PostgREST blip therefore rendered as
    # ``{"folders": [], "skills": []}`` at HTTP 200: byte-indistinguishable from an author who
    # genuinely owns nothing, on the exact surface whose whole job is to tell the canvas which
    # building blocks are valid. The canvas would have drawn empty dropdowns and the author
    # would have concluded their KB was gone. Degrading LOUDLY is the same contract
    # ``/validate`` already keeps with ``grounding_unavailable`` — "we could not check" is a
    # different sentence from "there is nothing", and the palette must be able to say it.
    degraded: list[str] = Field(default_factory=list)


class PublishRequest(BaseModel):
    """The publish body — the author-supplied representative kickoff prompt (D-05)
    the golden run executes against the project KB."""

    golden_input: str


class BlockedStep(BaseModel):
    """WHICH step of the AUTHOR'S OWN workflow stopped a publish, and why (BUG-260828-09).

    ── WHY THIS IS A FIELD OF ITS OWN AND NOT ANOTHER ``named_failures`` ENTRY ────────────
    ``named_failures`` is POLYMORPHIC across the gauntlet's stages and its consumers are
    required to detect shape PER ENTRY, never to switch on ``blocked_stage``
    (``PublishGauntlet.tsx`` docblock rule 4). Adding a sixth shape to that array would make
    every consumer's detection set grow, and a refusal that leads the surface is exactly the
    thing that must not be reachable only by a successful shape guess. So the array is
    UNTOUCHED — every existing entry renders byte-for-byte as it did — and the step identity
    rides its own optional field.

    ⚠ **``step_name`` IS ``None`` WHEN THE AUTHOR NAMED NOTHING, AND IS NEVER THE SLUG.**
    That is property (1) of the report — *by the author's step name, never a slug or a stage
    index* — enforced at the producer rather than trusted at the consumer. The client resolves
    the visible face through ``phaseVocabulary.nodeTitle``, the shipped four-tier ladder whose
    stated floor is that the slug never appears in its output. ``step_slug`` and ``step_index``
    are carried for correlation (a run link, a canvas focus), NOT for display.

    ⚠ **``cause`` LEADS AND ``reason`` IS DEMOTED — BOTH ARE SENT.** ``reason`` is the engine's
    verbatim sentence including its ``Phase {n} ({slug}) …:`` prefix; ``cause`` is that sentence
    with the prefix removed. When the prefix does not match, ``cause`` IS ``reason``, so a
    surface leading with ``cause`` can never render empty.
    """

    step_slug: str | None = None
    step_index: int | None = None
    step_name: str | None = None
    reason: str | None = None
    cause: str | None = None


class PublishVerdict(BaseModel):
    """The D-08 structured verdict. A block names the stage + the failures + the
    golden run id (a real, browsable run); a success carries the published version.
    Machine-renderable for 103 (nothing prose-only)."""

    published: bool
    version: int | None = None
    golden_run_id: UUID | None = None
    blocked_stage: str | None = None
    named_failures: list = Field(default_factory=list)
    # ── BUG-260828-09 — THE JOIN NOTHING PERFORMED ───────────────────────────────────────
    # ``verdictModel.ts``'s ``structural_gate`` docblock records the gap from the client side
    # verbatim: *"The precise cause lives in `workflow_phases` / `harness_audit` against the
    # `golden_run_id` the response already carries, and NOTHING joins them today — that is the
    # report's requirements 1 and 2 and it is a SERVER change."* This field is that change, and
    # that paragraph is corrected in the same commit.
    #
    # ⚠ OPTIONAL, and every stage that cannot name a step sends ``None`` — a lint block, a
    # judge block, a crash before any phase ran. A ``None`` renders as the surface that
    # shipped, so no stage gains an empty card it has nothing to put in.
    blocked_step: BlockedStep | None = None
    # ── 288-02 (D-07 / A-04) — pauses the golden run answered FOR the author ─────────────
    # Success-only; ``{phase, message}`` entries (same shape as ``named_failures``) whose
    # words come from the server. Empty for every workflow without a pause.
    auto_answered: list = Field(default_factory=list)


def _coerce_user_id(current_user: dict) -> UUID:
    """The get_published_workflows boilerplate: the trusted owner id as a UUID."""
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id


# Phase 186 (D-186-09): the published-row 409 keeps its shipped, operator-verified
# SENTENCE and its shipped STATUS; only its SHAPE changes, from a bare string to an
# object, so the client can branch on a machine code instead of matching prose. One
# constant because the same refusal is raised from two places (the ``already_published``
# cause and the CheckViolationError race backstop) and two spellings of one locked string
# is how a locked string stops being locked.
_ALREADY_PUBLISHED_DETAIL = {
    "code": "already_published",
    "message": "workflow is published and cannot be modified",
}


class DeletePreview(BaseModel):
    """The victim-naming sheet's exact Removed/Kept counts (D-LOCK-03). ``versions`` +
    ``runs`` are Removed; ``threads`` are Kept (they become normal chats); ``in_flight``
    is the count of runs STILL LIVE — the honest signal the sheet's amber cancel-first
    banner gates on (D-LOCK-05). Defaults to 0 so an older client that ignores it is
    unaffected (additive field)."""

    name: str
    versions: int
    runs: int
    threads: int
    in_flight: int = 0


async def _owned_slug_or_404(pool, definition_id: UUID, user_id: UUID) -> str:
    """Resolve the slug of an OWNED definition, or raise a uniform 404.

    Owner-gated (``created_by = $2``) — a non-owner / unknown id resolves to ``None`` →
    404, indistinguishable from not-found (no existence leak; the ``get_definition``
    404-collapse precedent). The service role bypasses RLS, so this WHERE is the ONLY
    authorization boundary (T-152-02-01)."""
    row = await pool.fetchrow(
        "SELECT slug FROM workflow_definitions WHERE id = $1 AND created_by = $2",
        definition_id,
        user_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    return row["slug"]


_TEMPLATE_MIME_BY_EXT = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
# Spelled out rather than derived from ``mimetypes.guess_type`` (workspace_service:99):
# the stdlib map has no OOXML entries and falls back to the Windows registry, so the
# guessed value varies by machine. The mime is persisted INTO the definition and read
# back by the render path — it must be identical on every box.


class TemplateAssetRef(BaseModel):
    """The four keys ``resolve_template_source`` Branch 1 reads off an ``AssetRef``.

    Field-for-field identical to ``app.models.harness.AssetRef`` (models/harness.py:512)
    so the Builder can drop this object straight into ``definition.assets[]`` and the
    ``extra='forbid'`` WorkflowDefinition will accept it unchanged. ``kind`` is a
    single-value Literal — this door mints templates, never ``reference`` assets.
    """

    kind: Literal["template"] = "template"
    asset_id: str
    filename: str
    mime: str


class TemplatePlaceholdersResponse(BaseModel):
    """What a bound template asks the step to fill in — and whether we could read it.

    ``read`` is the whole point of the model. An empty ``placeholders`` list is
    ambiguous on its own: it could mean *we opened the document and it carries no
    fill-in fields*, or *we never opened it at all*. Collapsing those two into one
    wire shape lets an author conclude their template is field-less when the read
    simply failed — and they then ship a workflow that fills nothing. The two
    states are therefore carried separately and rendered as different sentences on
    different nodes by the client.

    ``"not_requested"`` is deliberately NOT in this Literal: the route always
    supplies an ``asset_id``, so that arm of the resolver is unreachable here.
    """

    read: Literal["ok", "unreadable"]
    placeholders: list[str] = Field(default_factory=list)


# Phase 193.1 (AUTH-03, D-05) — the uncompressed-size cap the SHIPPED doors do not have.
# ``zipfile.ZipFile.read()`` decompresses without a bound: ``parse_docx_template_variables``
# (``template_render_service.py:387``) calls ``zf.read(n)`` on ``word/document.xml`` plus
# every header/footer, so a 10 MB OOXML container declaring a multi-GB ``document.xml``
# passes BOTH size gates above and then materialises in RAM. 50 MB is ~5x the compressed
# cap — far beyond any real brief, far below a bomb.
_TEMPLATE_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024


# ── Phase 291 (AUTH-02, plan 291-01) — the describe-door read ─────────────────
# A NEW constant rather than a widened ``_TEMPLATE_MIME_BY_EXT``: that one is pinned (286) and
# read by the template upload door, whose accepted set is a decision of its own.
_DESCRIBE_MIME_BY_EXT = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
}


class DescribeField(BaseModel):
    """One field found in an attached form.

    ``origin`` is server-stamped: ``exact`` when the file DECLARES the field (a PDF AcroForm
    field or a ``{{ }}`` token, so the key is the file's own name), ``ai_proposed`` when the
    read model named it (Word blanks, flat or scanned PDFs, D-01b/c). ``line_before`` /
    ``line_after`` are the document's own line split around the blank (Word blanks, D-27)."""

    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    type: Literal["text", "number", "date", "enum"]
    enum_options: list[str] = Field(default_factory=list)
    origin: Literal["exact", "ai_proposed"]
    line_before: str | None = None
    line_after: str | None = None
    anchor_kind: Literal["line", "cell"] | None = None
    anchor_label: str | None = None


class DescribeUnplaced(BaseModel):
    """A blank the server could not place exactly, and the server sentence saying so (D-28)."""

    model_config = ConfigDict(extra="forbid")

    label: str
    sentence: str


class DescribeReadResponse(BaseModel):
    """What one attached file holds, read before any draft exists (D-04).

    A file that never opened is an HTTP 422 with a server sentence, never an arm: ``none``
    means only *opened, and no fields found* (D-02). ``filename`` is the server-sanitised
    name. ``cut_short`` / ``refused`` are server sentences the client renders verbatim."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["form", "reference"]
    arm: Literal[
        "template_fields",
        "form_fields",
        "suggested_fields",
        "blanks",
        "none",
        "not_word",
        "scan_unreadable",
        "copy_refused",
        "reference",
    ]
    suggested_from: Literal["text", "scan"] | None = None
    filename: str
    fields: list[DescribeField] = Field(default_factory=list)
    unplaced: list[DescribeUnplaced] = Field(default_factory=list)
    text: str = ""
    cut_short: str | None = None
    refused: str | None = None


class ReferenceAssetRef(BaseModel):
    """The ``AssetRef`` a reference upload mints (``kind="reference"``). Its own model, so
    ``TemplateAssetRef``'s "never mints references" stays true."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["reference"] = "reference"
    asset_id: str
    filename: str
    mime: str


class WordAnchorIn(BaseModel):
    """One ticked Word blank the author confirmed (D-26 / D-27); the server places it."""

    model_config = ConfigDict(extra="forbid")

    key: str
    anchor_kind: Literal["line", "cell"]
    anchor_label: str
