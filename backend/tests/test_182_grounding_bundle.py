"""Phase 182 (VALID-01 / D-182-01 / D-182-05) — `GET /workflows/grounding-bundle`.

The cacheable server-sourced PALETTE the visual canvas binds its node-config dropdowns to
(Phase 184). Two properties are pinned here:

  1. **The gate (D-182-05, Pitfall 3).** While `visual_workflow_canvas` is off the route is a
     byte-identical **404 — never 403** — for an operator AND an end user, resolved BEFORE any
     auth can leak the route's existence. It carries `require_canvas` ALONE; stacking
     `require_visible` would raise 403 on deny and leak that the route exists.
  2. **The palette is SERVER-sourced, never a frontend constant (Pitfall 1 / SC#2).** The body
     is `{tools, folders, skills, template_placeholders}` taken off the ONE shared
     `grounding.assemble_grounding_bundle` — the SAME computation `/validate`'s fidelity rules
     and NL generation consume. `tools` is proven to be the REAL in-process tool registry (it
     contains `search_documents`), not a literal list authored in this route.
  3. **The rows are PROJECTED, never raw (CR-02).** `folders`/`skills` serialize through the
     explicit `PaletteFolder`/`PaletteSkill` models, so `org_id` and the seeding owner's
     `user_id` never reach the wire — the same owner-identity control `folders.py` / `kb.py` /
     `skills.py` enforce (SEED-091 / D-164-05 / D-165-05).

Runs fully OFFLINE. The 404-when-off probes need no DB (they 404 before the read). The
flag-on reads drive the real assembler against conftest's MagicMock supabase (folder/skill
reads resolve to `[]`, while `get_tools(None)` is the genuine registry) plus one fully-faked
bundle so the field mapping is provable independently of any registry contents. Modeled on
`test_revert_byte_identical.py` (`_cold_off`) + `test_181_flip_on.py` (`_flipped_on` + the
`authenticate_canvas_request` injection seam).
"""

from types import SimpleNamespace

_PATH = "/workflows/grounding-bundle"


async def _is_op_true(user_id):
    return True


async def _is_op_false(user_id):
    return False


def _cold_off(monkeypatch):
    """Flag off (cold default): an empty feature_visibility map -> canvas resolves "off"."""
    from app.models import user_settings as us

    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))


def _flipped_on(monkeypatch):
    """Operator On flip: a stored {"audience": "everyone"} record for the canvas key."""
    from app.models import user_settings as us

    monkeypatch.setattr(
        us,
        "load_app_settings",
        lambda: SimpleNamespace(
            feature_visibility={"visual_workflow_canvas": {"audience": "everyone"}}
        ),
    )


def _inject_caller(monkeypatch):
    """Inject a caller at the canvas ON-path auth seam (the test_181_flip_on posture).

    `require_canvas` validates the token only AFTER the off-flag check, so the OFF-path 404
    stays pre-auth. Patching this seam proves the flag-on no-op without a live token; the
    genuine pre-auth 404 path is exercised with this seam left REAL in
    `test_revert_byte_identical.py`.
    """
    import app.dependencies as deps

    async def _fake_caller(credentials, supabase):
        return {"id": "00000000-0000-0000-0000-000000000001", "email": "u@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)


# ── 1) the gate: 404 (never 403) while off, for operator AND user ──────────────


def test_grounding_bundle_404s_when_off_for_operator(client, monkeypatch):
    """Even an OPERATOR gets the byte-identical 404 while off ("off" resolves first, D-181-01)."""
    import app.dependencies as deps

    _cold_off(monkeypatch)
    monkeypatch.setattr(deps, "is_operator", _is_op_true)

    resp = client.get(_PATH)
    assert resp.status_code == 404, resp.text
    assert resp.status_code != 403  # a 403 would leak that the route exists


def test_grounding_bundle_404s_when_off_for_user(client, monkeypatch):
    """A non-operator gets a 404 (never 403) while off — indistinguishable from unbuilt."""
    import app.dependencies as deps

    _cold_off(monkeypatch)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    resp = client.get(_PATH)
    assert resp.status_code == 404, resp.text
    assert resp.status_code != 403
    # unbuilt-route parity: the body is the same 404 an unknown path returns. (A
    # single-segment probe would hit PATCH/DELETE /workflows/{definition_id} and get a
    # 405, so the parity probe uses a two-segment path no route can match.)
    unknown = client.get("/workflows/__nope__/__nope__")
    assert unknown.status_code == 404, unknown.text
    assert resp.json() == unknown.json() == {"detail": "Not Found"}


# ── 2) flag on: the real server-sourced palette shape ─────────────────────────


def test_grounding_bundle_returns_server_sourced_palette(client, monkeypatch):
    """Flag on -> 200 with `{tools, folders, skills, template_placeholders}` from the assembler.

    The load-bearing assertion is on `tools`: it is the REAL in-process tool registry
    (`get_tools(None)` inside `assemble_grounding_bundle`), sorted — proving the palette is
    computed server-side and is NOT a constant authored in the route or the frontend
    (Pitfall 1 / SC#2). Folder/skill reads resolve to `[]` against conftest's mock supabase.
    """
    _flipped_on(monkeypatch)
    _inject_caller(monkeypatch)

    resp = client.get(_PATH)
    assert resp.status_code == 200, resp.text

    body = resp.json()
    # `degraded` joined the contract in the round-3 gap closure (CR-02): the palette must be
    # able to say "we could not READ your folders/skills" rather than serve an outage as an
    # empty tree. A healthy read reports `[]` — see the assertion below.
    assert set(body) == {"tools", "folders", "skills", "template_placeholders", "degraded"}
    assert isinstance(body["tools"], list) and body["tools"]
    assert "search_documents" in body["tools"]  # the genuine registry, not a literal
    assert body["tools"] == sorted(body["tools"])
    assert isinstance(body["folders"], list)
    assert isinstance(body["skills"], list)
    # placeholders are PER-TEMPLATE: absent ?template_asset_id= -> [] (RESEARCH A3)
    assert body["template_placeholders"] == []
    # A resolvable read reports NO degradation. Empty is the only value that means "this
    # palette is complete" — the honesty field must not cry wolf on a healthy request.
    assert body["degraded"] == []


def test_grounding_bundle_fields_come_from_the_bundle(client, monkeypatch):
    """Every response field is mapped straight off the shared `GroundingBundle` — PROJECTED.

    Fakes the assembler so the mapping is provable independently of registry contents: a
    bundle carrying distinctive tool / folder / skill / placeholder values must appear
    verbatim on the wire (and `tool_names` / `skill_ids` — the fidelity-only membership sets —
    must NOT leak into the palette response).

    CR-02: the folder/skill rows here are REAL raw-row shapes (`fetch_all_folders(fields="*")`
    returns every column of `public.folders`; the skills registry read carries the owner +
    org columns its visibility post-filter needs). The response must carry ONLY the
    `PaletteFolder` / `PaletteSkill` projection — `org_id` and the seeding owner's `user_id`
    are the two fields this pins OUT. The ids are genuine UUIDs because the palette models
    type them as `UUID` (matching `FolderResponse.id`), which the previous `"f-1"` / `"s-1"`
    placeholders could not express.
    """
    from app.services.harness import grounding as g

    _flipped_on(monkeypatch)
    _inject_caller(monkeypatch)

    folder_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    skill_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    foreign_owner = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    org_id = "dddddddd-dddd-dddd-dddd-dddddddddddd"

    async def _fake_assemble(**_kwargs):
        return g.GroundingBundle(
            tools=["alpha_tool", "beta_tool"],
            tool_names={"alpha_tool", "beta_tool"},
            # a RAW `fields="*"` folder row, exactly as fetch_all_folders yields it
            folders=[
                {
                    "id": folder_id,
                    "user_id": foreign_owner,
                    "name": "Q3 Reports",
                    "parent_id": None,
                    "is_org_shared": True,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-02T00:00:00+00:00",
                    "org_id": org_id,
                }
            ],
            # a RAW skills-registry row, exactly as _skill_registry yields it
            skills=[
                {
                    "id": skill_id,
                    "name": "Legal Review",
                    "user_id": foreign_owner,
                    "is_org_shared": True,
                    "is_system": False,
                    "org_id": org_id,
                    "is_enabled": True,
                }
            ],
            skill_ids={skill_id},
            placeholders=["project_name", "report_date"],
        )

    monkeypatch.setattr(g, "assemble_grounding_bundle", _fake_assemble)

    body = client.get(_PATH).json()
    assert body == {
        "tools": ["alpha_tool", "beta_tool"],
        "folders": [{"id": folder_id, "name": "Q3 Reports", "parent_id": None}],
        "skills": [{"id": skill_id, "name": "Legal Review"}],
        "template_placeholders": ["project_name", "report_date"],
        # Mapped off `GroundingBundle.degraded` exactly like every field above it — this fake
        # bundle resolved cleanly, so the honest answer is the empty list (round-3 CR-02).
        "degraded": [],
    }
    # CR-02 stated as a negative, so a widened model fails HERE and not in review: neither the
    # tenant id nor the seeding owner may appear ANYWHERE in the serialized palette.
    raw = client.get(_PATH).text
    assert org_id not in raw, "org_id leaked into the palette (CR-02)"
    assert foreign_owner not in raw, "the seeding owner's user_id leaked into the palette (CR-02)"
    for row in body["folders"]:
        assert set(row) == {"id", "name", "parent_id"}, row
    for row in body["skills"]:
        assert set(row) == {"id", "name"}, row


def test_grounding_bundle_rejects_a_malformed_template_asset_id(client, monkeypatch):
    """A non-UUID `?template_asset_id=` is a 422 (V5 input validation), never a silent []."""
    _flipped_on(monkeypatch)
    _inject_caller(monkeypatch)

    resp = client.get(_PATH, params={"template_asset_id": "not-a-uuid"})
    assert resp.status_code == 422, resp.text


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 189 — V22 / D-20: THE AUTHOR-FACING TOOL RAIL MUST NOT WIDEN
# ══════════════════════════════════════════════════════════════════════════════
#
# `189-RESEARCH.md` § Security Domain names this the single NET-NEW security property
# Phase 189 introduces, and it is a STANDING FENCE authored BEFORE the change that could
# break it — not a Wave-0 RED. **It passes today. That is correct and deliberate.**
#
# THE THREAT, in full, because the assertion alone does not carry it:
#
#   * `GroundingBundle.tools` is `sorted(tool_names)` and is served on
#     `GET /workflows/grounding-bundle`.
#   * `WorkflowBuilderPage.tsx` binds that array straight into `PhaseFormPanel`'s
#     `toolOptions` — the AUTHOR-FACING WHITELIST RAIL for `llm_agent` and
#     `llm_batch_agents`, whose own docblock reads "THE OPTION SET IS THE SERVER'S".
#   * So anything in `tools` is a name an author may tick on ANY agent step.
#
# CONFLICT 2 (D-20) needs the three external-action capabilities to be in `tool_names`,
# or a workflow built on D-03 cannot publish (stage 2.6 rule 2 — see
# `tests/unit/test_103_grounding_fidelity.py`). **The cheapest way to achieve that is to
# add them to `get_tools()`, and it is a governance hole**: an author could then whitelist
# `send_email` on an ORDINARY, UNARMED `llm_agent` step, bypassing the `external_action`
# type's structural arming entirely. That is precisely the wire-around D-04 and SC#2
# forbid, and it would make `action_risk_armed` decorative.
#
# **THIS IS WHY THE D-20 FIX WIDENS `tool_names` AND NOT `tools`.** The two fields are
# equal today by construction, and `render_grounding_prompt`'s docstring asserts that
# identity in prose; plan 189-04 breaks it deliberately and must correct that prose in the
# same commit.
#
# The bundle is read OFFLINE here (a `MagicMock` supabase, the same posture the palette
# tests above use) rather than over HTTP: the route's own field mapping is already pinned
# by `test_grounding_bundle_fields_come_from_the_bundle`, and driving a second HTTP read
# would add a DB-dependent failure to a file whose failure set must stay at exactly the two
# pre-existing `pool is closing` rows.

# D-15's closed set, one collection. Kept in the shape `tests/unit/
# test_103_grounding_fidelity.py` and `tests/unit/test_189_external_action_model.py` use.
EXTERNAL_ACTION_CAPABILITIES = frozenset({"send_email", "create_ticket", "post_message"})


async def _bundle_tools() -> list[str]:
    """`GroundingBundle.tools` from the PRODUCTION assembler — the wire palette itself."""
    from unittest.mock import MagicMock

    from app.services.harness.grounding import assemble_grounding_bundle

    bundle = await assemble_grounding_bundle(
        supabase=MagicMock(), user_id="00000000-0000-0000-0000-0000000000a1"
    )
    return bundle.tools


def test_external_action_capabilities_are_absent_from_the_author_facing_tool_options():
    """V22 / D-20 — no external-action capability may reach the author-facing tool rail.

    See this section's header for the threat. Three assertions, and the first two exist so
    the third can never pass vacuously:

      1. `tools` is NON-EMPTY — a disjointness check against an empty list proves nothing,
         and a vacuous security guard is worse than none.
      2. `tools` contains a KNOWN SHIPPED tool (`search_documents`), so it is demonstrably
         the real registry rather than an arbitrary non-empty list.
      3. `tools` is DISJOINT from `EXTERNAL_ACTION_CAPABILITIES` — asserted on the SET, so
         a fix that leaks one of the three is caught as surely as one that leaks all three.

    ⚠ **This test PASSES at HEAD**, because nothing has yet tried to widen the palette. It
    is a regression fence around plan 189-04, not a falsification of current behaviour.
    Its non-vacuity was proved separately, by planting `send_email` into `get_tools()` and
    observing this guard go RED — recorded verbatim in `189-02-SUMMARY.md`; the plant was
    removed before commit.
    """
    import asyncio

    tools = asyncio.run(_bundle_tools())

    assert tools, (
        "GroundingBundle.tools is EMPTY — the disjointness assertion below would pass "
        "vacuously and this guard would silently stop protecting anything"
    )
    assert "search_documents" in tools, (
        f"GroundingBundle.tools does not contain a known shipped tool; it is not the real "
        f"registry, so the disjointness check measures nothing. Got: {tools!r}"
    )

    leaked = EXTERNAL_ACTION_CAPABILITIES & set(tools)
    assert leaked == set(), (
        f"D-20 GOVERNANCE HOLE: {sorted(leaked)} reached GroundingBundle.tools, which is "
        f"served on GET /workflows/grounding-bundle and bound straight into "
        f"PhaseFormPanel's author-facing whitelist rail. An author can now tick "
        f"{sorted(leaked)[0]!r} on an ORDINARY, UNARMED llm_agent step — bypassing the "
        f"external_action type's structural arming and wiring around the gate D-04 and "
        f"SC#2 make undisarmable. The stage-2.6 fidelity gate must be widened via "
        f"tool_names ONLY (a closed EXTERNAL_ACTION_CAPABILITIES frozenset unioned in for "
        f"the fidelity check), never via get_tools() / GroundingBundle.tools."
    )


# ── 3) the gate is require_canvas ALONE (Pitfall 3) ───────────────────────────


def test_grounding_bundle_gates_on_require_canvas_alone():
    """`GET /workflows/grounding-bundle` carries `require_canvas` and NOT `require_visible`.

    `require_visible` raises 403 on deny, which would leak the route's existence when the
    canvas is on but authoring visibility is restricted — and would couple canvas
    availability to a DIFFERENT feature's audience.
    """
    from app.main import app

    qualnames: set[str] | None = None
    for route in app.routes:
        if getattr(route, "path", None) == _PATH and "GET" in (
            getattr(route, "methods", None) or set()
        ):
            qualnames = {
                getattr(dep.call, "__qualname__", "") for dep in route.dependant.dependencies
            }
            break

    assert qualnames is not None, f"route GET {_PATH} is not mounted"
    assert any(q.startswith("require_canvas") for q in qualnames), qualnames
    assert not any(q.startswith("require_visible") for q in qualnames), qualnames
