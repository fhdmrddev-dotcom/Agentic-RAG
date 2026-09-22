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
(``full-schema.sql:4833``, mig-109 skill_files shape / FIX-A / D-165-02), plus the Phase 264
opt-in provenance arm::

    visible  iff  is_system = true
                  OR (org_id ∈ caller_org_ids
                      AND (user_id = caller
                           OR is_org_shared = true
                           OR (born_for_expert_bundle_id = <the caller's ACTIVE bundle>
                               AND is_enabled = true)))

``is_system`` is a platform-universal escape deliberately OUTSIDE the org gate (the built-in
skill-creator is legitimately cross-org). **Fail-closed:** an EMPTY caller org set resolves
ONLY ``is_system`` skills — over-restrict, never over-share.

WHY THIS MODULE EXISTS (the anti-drift seam). The rule was born inside
``tool_dispatcher.py``, whose service-role resolution sites were the only consumers. It
now has a second consumer — ``services/harness/grounding.py``, which feeds the
``/workflows/validate`` + ``/workflows/grounding-bundle`` canvas seam. ``grounding.py`` CANNOT
import ``tool_dispatcher``: the dispatcher transitively pulls ``harness.scope`` →
``task_service`` → back to itself (a documented real cycle, see the ``_ensure_resolver`` note
in tool_dispatcher), and ``grounding.py`` is deliberately import-light. Rather than copy the
predicate a second time — the exact drift Phase 182 exists to prevent — it is hoisted HERE, to
an import-light home both consumers can reach. There is exactly ONE copy of this rule.

⚠ The consumer count in this paragraph used to read *"five call sites"* in the two docstrings
that quoted it. Measured 2026-09-22 (RESEARCH §2.3): there are **four**
``_resolve_skill_visibility_or(ctx)`` calls in ``tool_dispatcher`` (``:1315``, ``:1459``,
``:1589``, ``:2197``) feeding **six** ``.or_(...)`` applications. Call sites and applications
are different numbers and the old prose conflated them.

⛔ **AND THE REPLACEMENT NUMBER WAS WRONG TOO — THE APPLICATIONS ARE SEVEN, NOT SIX.** Found by
264-03, corrected here by 264-04; the sentence above stands unedited rather than being fixed in
place, because *"the second wrong number inside one already-corrected sentence"* is the finding.
The enumeration omitted ``_handle_save_skill``'s single ``.or_(_sibling_filter)`` — which the
same paragraph's own prose already says exists. Re-measured at 264's close with
``grep -n "^\\s*\\.or_(" app/services/tool_dispatcher.py``: **SEVEN** applications, at ``:1373``,
``:1401``, ``:1533``, ``:1671``, ``:1683``, ``:2293``, ``:2305`` — ``_skill_filter`` ×4,
``_sf_filter`` ×2, ``_sibling_filter`` ×1 — fed by **four** call sites at ``:1369``, ``:1529``,
``:1666``, ``:2283``. ⚠ The ``:1315``/``:1459``/``:1589``/``:2197`` above are PRE-264-03 line
numbers and have all moved; re-derive rather than trust either list.

⭐ **The ``four call sites`` figure is CORRECT and UNAFFECTED — say so, because a reader who finds
half a sentence wrong will distrust the other half.** Four is the number every D-264-04 per-site
decision rests on: three sites pass ``born_for=True`` (``load_skill``, ``read_skill_file``, the
``execute_code`` skill-file injection) and the fourth, ``_handle_save_skill``'s lint corpus,
refuses IN SOURCE. Only the APPLICATIONS count was ever wrong, and it is now pinned executably at
**7** by ``tests/unit/test_264_load_skill_born_for.py::test_no_or_application_line_moved`` — so
the figure is defended by a test even when this prose next rots.

⛔ **IMPORT-LIGHT IS A CONSTRAINT, NOT A PREFERENCE.** This module must not import anything
under ``app.services.`` (nor ``app.models.expert``), or the cycle above closes and every
consumer of the rule breaks at import time. The only import here is ``coerce_uid``.

**TWO ENCODINGS, ONE RULE.** ``build_skill_visibility_or`` pushes the gate DOWN to PostgREST;
``skill_row_visible`` is the same predicate in Python, for call sites that also post-filter
rows in process. They MUST agree — a post-filter looser than the query re-opens the leak the
moment the query is bypassed, degraded, or widened. Change one, change both, in one commit.
``tests/unit/test_264_one_home_born_for_predicate.py`` makes that rule executable: one fixture
table drives both encodings and goes red on a disagreement, naming the row.

**THE BORN-FOR ARM IS OPT-IN BY KEYWORD (Phase 264 / D-264-01).** ``expert_bundle_id`` defaults
to ``None`` on both encodings, and with it omitted the emitted predicate is **byte-identical**
to this module's pre-264 output. That is a claim about a string, so it is pinned as a string:
``tests/unit/test_seed125_skill_visibility_filter.py`` asserts ``==`` against three frozen
literals measured from the real function. ⭐ Phase 263 argued this arm could not live here
because hoisting it would widen the agent loop and workflow grounding; that argument was
correct for an **unconditional** arm and is refuted by an **optional** one — a caller that does
not pass the keyword cannot be widened by it, and the frozen literal is the proof rather than
the argument (D-264-02, the SEED-177 retire-deliberately rule; precedent D-206-07).

**WHERE THE ARM SITS, AND WHY THAT IS THE WHOLE SAFETY PROPERTY.** The born-for term is a THIRD
disjunct INSIDE the existing inner ``or(...)``, structurally beneath ``org_id.in.(...)``. A
fourth TOP-LEVEL branch would let a foreign-org row carrying the marker through — precisely the
SEED-125 shape. With an EMPTY org set there is no gate to nest inside, so the term is emitted
not at all and the output stays the bare ``is_system.eq.true``.

**WHY THE ARM CARRIES ITS OWN ``is_enabled`` TERM** (RESEARCH §2.7 / §8.5, measured). The four
``_resolve_skill_visibility_or`` call sites in ``tool_dispatcher`` do NOT agree about
enablement: ``_handle_load_skill`` adds ``.eq("is_enabled", True)`` to its query, while
``_handle_read_skill_file`` and ``_handle_execute_code`` add no enablement filter at all. A
BARE born-for disjunct would therefore admit a **disabled** born-for skill's bundled files at
two of the four sites — rows ``expert_service.filter_visible_skill_names`` (which requires
``is_enabled``) strips. Carrying ``is_enabled`` inside the arm closes that at the arm, leaves
the default path byte-identical, and makes the one-home claim semantically true rather than
merely syntactically true. Both candidate forms were sent to a live local PostgREST against the
real ``public.skills`` and returned HTTP 200 (with an unknown-column and an unbalanced-paren
negative control returning 400, so the 200 is a real parse and a real column resolution).
"""

from __future__ import annotations

from app.utils.db import coerce_uid


def build_skill_visibility_or(
    user_id: str,
    org_ids: set[str],
    *,
    expert_bundle_id: str | None = None,
) -> str:
    """Build the PostgREST ``.or_()`` predicate string that org-gates skill resolution.

    Pure + unit-testable. ``coerce_uid`` UUID-validates every runtime value spliced into
    the ``.or_()`` grammar (a malformed id raises rather than breaking out of the DSL —
    the service-role client has no RLS backstop). Empty ``org_ids`` returns the bare
    ``is_system.eq.true`` term: no empty ``in.()`` (a PostgREST syntax error) AND
    fail-closed (0 shared cross-org). Applied identically at every resolution site.

    ``expert_bundle_id`` is the caller's ACTIVE, already-access-checked Expert bundle id, or
    ``None`` when no Expert is active — which is every caller that has not opted in. With it
    omitted this function returns exactly what it returned before Phase 264, byte for byte;
    see the three frozen literals in ``tests/unit/test_seed125_skill_visibility_filter.py``.
    Like ``user_id`` and each org id it is annotated ``str`` and normalised by ``coerce_uid``,
    so a ``uuid.UUID`` is tolerated — but callers should pass a canonical string, and the
    module deliberately imports nothing (not even ``uuid``) beyond ``coerce_uid``.

    ⛔ The ``None`` case is handled STRUCTURALLY, by a branch, not by a coercion:
    ``coerce_uid(None)`` raises, and ``None`` is the normal, overwhelmingly common input.

    ⛔ The empty-``org_ids`` arm returns BEFORE the bundle is examined, and that ordering is
    deliberate: with no org gate the term is not emitted at all, so nothing is spliced and
    there is nothing to validate. The fail-closed arm stays byte-identical whatever is passed.
    """
    caller = coerce_uid(user_id)
    if not org_ids:
        return "is_system.eq.true"
    org_list = ",".join(coerce_uid(o) for o in sorted(org_ids))
    born_for = ""
    if expert_bundle_id is not None:
        bundle = coerce_uid(expert_bundle_id)
        # Nested INSIDE the inner or(...), never a fourth top-level branch (T-264-06), and
        # carrying its own enablement term because two of the four dispatcher sites filter
        # enablement nowhere (T-264-11).
        born_for = f",and(born_for_expert_bundle_id.eq.{bundle},is_enabled.is.true)"
    return (
        f"is_system.eq.true,"
        f"and(org_id.in.({org_list}),"
        f"or(user_id.eq.{caller},is_org_shared.eq.true{born_for}))"
    )


def skill_row_visible(
    row: dict,
    *,
    caller_id: str,
    org_ids: set[str],
    expert_bundle_id: str | None = None,
) -> bool:
    """``build_skill_visibility_or`` evaluated in Python against ONE already-fetched row.

    For service-role call sites that ALSO filter in process (e.g. a read that selects a
    superset and narrows afterwards): the in-Python check must be exactly as tight as the
    pushed-down one, or the post-filter silently re-admits the very rows the org gate
    excluded. Term-for-term identical to the predicate above and to the live RLS policy:

        is_system  OR  (org_id ∈ org_ids
                        AND (user_id == caller
                             OR is_org_shared
                             OR (born_for == expert_bundle_id AND is_enabled)))

    ``caller_id`` and ``org_ids`` are expected to be canonical UUID strings (run them
    through ``coerce_uid`` once at the call site — which the caller must do anyway to build
    the query predicate). ``expert_bundle_id`` is the caller's active Expert bundle id, or
    ``None``; omitted, this function behaves exactly as it did before Phase 264.

    Does NOT check ``is_enabled`` on the owner / ``is_org_shared`` arms: enablement is a
    separate concern from visibility there, and only some call sites filter on it. The
    BORN-FOR arm is the exception and checks it inline, mirroring the query encoding — see
    the module docstring for the two dispatcher sites that filter enablement nowhere.

    ⛔ BOTH ``is not None`` guards on the born-for arm are load-bearing, and the second one is
    specific to this encoding. ``expert_bundle_id is not None`` is the ``T-263-02`` trap: at
    Expert-save time no bundle exists and every unstamped row carries ``None``, so a bare
    ``==`` would admit every other user's private skill in the org. The row-side guard closes
    the ``str()`` variant of the same trap, which 263's asyncpg comparison did not have:
    ``str(None) == str(None)`` is ``"None" == "None"`` → ``True``.

    ⚠ ``.get()``, never ``row[...]`` — every pre-263 mock fixture is a plain dict without the
    provenance key, and a ``KeyError`` here surfaces as a handler crash, not a visibility miss.
    ``is_enabled`` defaults to ``True`` when absent, matching the column's ``NOT NULL DEFAULT
    true`` and keeping pre-263 fixtures meaningful.
    """
    if row.get("is_system"):
        return True  # platform-universal escape, OUTSIDE the org gate
    if str(row.get("org_id")) not in org_ids:
        return False  # fail-closed: an unknown / foreign / NULL org is never visible
    if str(row.get("user_id")) == str(caller_id) or bool(row.get("is_org_shared")):
        return True
    row_bundle = row.get("born_for_expert_bundle_id")
    return (
        expert_bundle_id is not None
        and row_bundle is not None
        and str(row_bundle) == str(expert_bundle_id)
        and bool(row.get("is_enabled", True))
    )
