"""SEED-125 (CR-01) / Phase 182 (CR-01) — the ONE org-gated skill-visibility rule.

Every skill read that runs on the **service-role** (BYPASSRLS) Supabase client must
re-implement in-app the org gate that RLS enforces on ordinary request paths, because
``auth.uid()`` / ``current_user_org_ids()`` never resolve there. Without it, the legacy
predicate::

    .or_("user_id.eq.<caller>,is_org_shared.eq.true")

matches **ANY** org's ``is_org_shared`` skill — a disjoint-org caller reads another org's
skill rows. Since mig 105 gave every user a personal org, "another org" is effectively "any
other user who shared a skill". This is the SKILLS analog of the SEED-124 folder leak.

**THE RULE** — mirrors the live SELECT policy on ``public.skills`` verbatim
(``full-schema.sql:4833``, mig-109 skill_files shape / FIX-A / D-165-02)::

    visible  iff  is_system = true
                  OR (org_id ∈ caller_org_ids AND (user_id = caller OR is_org_shared = true))

``is_system`` is a platform-universal escape deliberately OUTSIDE the org gate (the built-in
skill-creator is legitimately cross-org). **Fail-closed:** an EMPTY caller org set resolves
ONLY ``is_system`` skills — over-restrict, never over-share.

WHY THIS MODULE EXISTS (the anti-drift seam). The rule was born inside
``tool_dispatcher.py``, whose six service-role resolution sites were the only consumers. It
now has a second consumer — ``services/harness/grounding.py``, which feeds the
``/workflows/validate`` + ``/workflows/grounding-bundle`` canvas seam. ``grounding.py`` CANNOT
import ``tool_dispatcher``: the dispatcher transitively pulls ``harness.scope`` →
``task_service`` → back to itself (a documented real cycle, see the ``_ensure_resolver`` note
in tool_dispatcher), and ``grounding.py`` is deliberately import-light. Rather than copy the
predicate a second time — the exact drift Phase 182 exists to prevent — it is hoisted HERE, to
an import-light home both consumers can reach. There is exactly ONE copy of this rule.

**TWO ENCODINGS, ONE RULE.** ``build_skill_visibility_or`` pushes the gate DOWN to PostgREST;
``skill_row_visible`` is the same predicate in Python, for call sites that also post-filter
rows in process. They MUST agree — a post-filter looser than the query re-opens the leak the
moment the query is bypassed, degraded, or widened. Change one, change both, in one commit.
"""

from __future__ import annotations

from app.utils.db import coerce_uid


def build_skill_visibility_or(user_id: str, org_ids: set[str]) -> str:
    """Build the PostgREST ``.or_()`` predicate string that org-gates skill resolution.

    Pure + unit-testable. ``coerce_uid`` UUID-validates every runtime value spliced into
    the ``.or_()`` grammar (a malformed id raises rather than breaking out of the DSL —
    the service-role client has no RLS backstop). Empty ``org_ids`` returns the bare
    ``is_system.eq.true`` term: no empty ``in.()`` (a PostgREST syntax error) AND
    fail-closed (0 shared cross-org). Applied identically at every resolution site.
    """
    caller = coerce_uid(user_id)
    if not org_ids:
        return "is_system.eq.true"
    org_list = ",".join(coerce_uid(o) for o in sorted(org_ids))
    return (
        f"is_system.eq.true,"
        f"and(org_id.in.({org_list}),or(user_id.eq.{caller},is_org_shared.eq.true))"
    )


def skill_row_visible(row: dict, *, caller_id: str, org_ids: set[str]) -> bool:
    """``build_skill_visibility_or`` evaluated in Python against ONE already-fetched row.

    For service-role call sites that ALSO filter in process (e.g. a read that selects a
    superset and narrows afterwards): the in-Python check must be exactly as tight as the
    pushed-down one, or the post-filter silently re-admits the very rows the org gate
    excluded. Term-for-term identical to the predicate above and to the live RLS policy:

        is_system  OR  (org_id ∈ org_ids  AND  (user_id == caller  OR  is_org_shared))

    ``caller_id`` and ``org_ids`` are expected to be canonical UUID strings (run them
    through ``coerce_uid`` once at the call site — which the caller must do anyway to build
    the query predicate). Does NOT check ``is_enabled``: enablement is a separate concern
    from visibility, and only some call sites filter on it.
    """
    if row.get("is_system"):
        return True  # platform-universal escape, OUTSIDE the org gate
    if str(row.get("org_id")) not in org_ids:
        return False  # fail-closed: an unknown / foreign / NULL org is never visible
    return str(row.get("user_id")) == str(caller_id) or bool(row.get("is_org_shared"))
