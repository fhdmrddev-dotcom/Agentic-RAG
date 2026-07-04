"""Phase 123 (TRIG-01) — the Skill Trigger Tuner backend orchestration core.

This is the genuinely net-new logic of TRIG-01: the held-out split/repeat scoring
math, the per-case "did it fire?" measurement, the N-column configured-target
adaptivity, and the owner-scoped sibling auto-seed. Everything emission-related is a
THIN orchestration over the SHIPPED ``forced_emit`` substrate — exactly like
``workflow_authoring.py``.

  - ``resolve_skill_builder_model`` (D-08) mirrors ``resolve_authoring_model``
    verbatim: explicit setting -> first strong forced_emission default -> honest
    ``None``. Selectable across the FULL provider list incl. local; NO paid-provider
    single-point-of-failure; DECOUPLED from the benchmark targets.
  - ``build_candidates`` forces ONE emission on the BUILDER model returning <=N
    rewritten descriptions.
  - ``classify_fires`` forces a TriggerDecision on each TARGET model, with the
    classifier prompt mirroring the REAL production ``LOAD_SKILL_POLICY`` (imported
    from ``skill_lint`` — Pitfall 1 fidelity guard).
  - ``split_held_out`` / ``aggregate_repeats`` / ``score_candidate`` / ``pick_winner``
    are the PURE 60/40 train-held-out / 3-repeat scoring math; the winner is picked by
    HELD-OUT score, NEVER by train (Pitfall — pick-by-train forbidden).
  - ``configured_targets`` derives the N-column provider set from API-key / base_url
    PRESENCE only (Pattern 4): one representative model per configured provider,
    OpenRouter distinct from native deepseek/zhipu/moonshot/minimax, N=1 the clean
    single-provider baseline (NOT degraded).
  - ``auto_seed_cases`` seeds should-fire + should-NOT cases; siblings come from the
    owner-scoped ``.or_(user_id.eq.{id}, is_global.eq.true)`` catalog query ONLY (D-04 /
    V4 — never leaks another user's private skills).

RED LINE (D-14 / G-5): this REUSES ``forced_emit`` -> the Phase 092.5 provider gateway.
It NEVER opens the agent loop, NEVER imports a raw provider SDK client, NEVER touches
the gateway internals. Provider differences stay at the gateway boundary; this service
never forks the shared path. (Verified by the acceptance grep gate — no raw SDK client
import and no agent-loop entry appears anywhere in this module.)
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel

from app.services.forced_emit import forced_emit
# Pitfall 1 fidelity guard: the classifier measures the REAL production firing policy
# by importing the SAME constant agent_loop.py interpolates into the "## Available
# Skills" catalog note. NEVER duplicate or paraphrase the policy string.
# MAX_DESCRIPTION_CHARS is the SHARED portability bound (D-13 i / STD-01) — build_candidates
# caps its output at the same length skill_lint flags as `too_long`, so ONE source of truth.
from app.services.skill_lint import LOAD_SKILL_POLICY, MAX_DESCRIPTION_CHARS

logger = logging.getLogger(__name__)

# Default number of candidate descriptions the builder proposes (A4 — tunable knob).
DEFAULT_CANDIDATE_COUNT = 3

# The 60/40 train/held-out ratio + the repeat count (Pitfall — winner by held-out).
DEFAULT_HELD_OUT_TRAIN_RATIO = 0.6
DEFAULT_REPEATS = 3

# Phase 123.1-05 (BUG-260624-01 HIGH #1) — the named cap on the SIBLING-sourced should_not
# set (sketch 045-B default). It keeps the pre-run benchmark focused so a large skill library
# doesn't seed an illegible wall of cases AND doesn't blow up the RUN TIME (each sibling case
# runs cross-provider × 3 repeats; slow coerce-tier providers make an uncapped seed take many
# minutes — see 123.1-AUDIT-BACKLOG §5). It applies to BOTH the editor seed (the GET) AND the
# run path (auto_seed_cases) so the editor shows EXACTLY what runs (honest). The cap slices
# ONLY the already-owner-scoped, leak-safe sibling list — it never re-reads the DB or widens
# scope. The fixed generic off-topic baseline below is ALWAYS kept on top (never capped) so the
# false-fire baseline never disappears.
MAX_SEEDED_SHOULD_NOT = 8

# A small fixed generic off-topic should-NOT set (D-04 / Open-Q2) — prompts that should
# NEVER fire ANY skill, independent of the sibling catalog. Padding so a skill with no
# siblings still gets a real false-fire rail.
_GENERIC_OFF_TOPIC: tuple[str, ...] = (
    "What's the weather like today?",
    "Tell me a joke.",
    "What time is it in Tokyo?",
    "Summarize the last email I sent.",
    "How do I make a cup of coffee?",
)


# ── D-08 builder-model resolver (mirrors resolve_authoring_model verbatim) ───────
def resolve_skill_builder_model(settings) -> str | None:
    """Resolve the skill-builder model (D-08) the same way the authoring model resolves
    (``resolve_authoring_model`` — workflow_authoring.py:83). A model id is a VALUE, not a
    secret -> a Settings knob, not env.

    Resolution order:
      1. ``settings.skill_builder_model`` if set -> returned VERBATIM (incl. a local
         model id like ``ollama/llama3.1`` — NO paid-provider hardcoding, NO SPOF).
      2. else the first registry default in
         ``("claude-haiku-4-5-20251001", "gpt-5.4-mini")`` whose
         ``get_model_capability(candidate).get("forced_emission")`` is truthy (A7 —
         a strong, forceable default).
      3. else ``None`` — honest: the caller emits a "no builder model resolved" failure
         (never fabricate a model; no SPOF).

    D-08: selectable across the FULL provider list incl. local; decoupled from the
    benchmark targets (the builder WRITES, the targets MEASURE).
    """
    model = getattr(settings, "skill_builder_model", None)
    if model:
        return model

    from app.config import get_model_capability  # function-local (Pitfall-4 discipline)

    for candidate in ("claude-haiku-4-5-20251001", "gpt-5.4-mini"):
        cap = get_model_capability(candidate) or {}
        if cap.get("forced_emission"):
            return candidate
    return None


# ── FLAT, single-typed Pydantic schemas (Gemini trap — Pitfall 4) ───────────────
# No discriminated multi-model unions and no multi-type ``type: [...]`` arrays at the
# property level. ``str | None`` -> a plain nullable string is fine
# (reference_gemini_schema_type_array_trap). The test asserts the flat shape.
class CandidateDescriptions(BaseModel):
    """The builder model's proposed rewritten descriptions (<=N)."""

    candidates: list[str]


class TriggerDecision(BaseModel):
    """A single per-case firing decision from a TARGET model."""

    would_load: bool
    skill_name: str | None = None


# ── System prompts (NON-EMPTY required — anthropic empty-block 400, eval rig :1400) ─
_BUILDER_SYSTEM_PROMPT = (
    "You are a skill-description editor for a knowledge-base agent platform. Given a "
    "skill's name and current description, you write alternative one-sentence "
    "descriptions that make the agent fire the skill on the RIGHT requests and NOT on "
    "unrelated ones. Each candidate must name the concrete task and a clear trigger; "
    "keep them distinct from one another. Emit them via the provided tool."
)

# The classifier system prompt MIRRORS the real production firing policy by interpolating
# the shared LOAD_SKILL_POLICY (Pitfall 1) — it measures what production actually does.
_CLASSIFIER_SYSTEM_PROMPT = (
    "You are the skill-triggering decision layer of a knowledge-base agent. You decide "
    "whether the user's request should load one of the available skills.\n\n"
    f"{LOAD_SKILL_POLICY}\n\n"
    "Emit your decision via the provided tool: set would_load=true and skill_name to the "
    "matching skill's name when the request clearly matches a skill description; otherwise "
    "set would_load=false and skill_name=null."
)


def _flatten_nullable(node):
    """Rewrite Pydantic's nullable ``{"anyOf": [{...}, {"type": "null"}]}`` into its single
    non-null branch so strict OpenAI-compatible tool-schema validators (minimax/moonshot) and
    Google's pre-sanitizer don't reject the ``anyOf``/multi-type shape
    ([[reference_gemini_schema_type_array_trap]]). Recursive; returns a NEW structure (never
    mutates the model's cached schema). TT-02 companion to the TT-01 wrapper fix below."""
    if isinstance(node, dict):
        any_of = node.get("anyOf")
        if isinstance(any_of, list):
            non_null = [b for b in any_of if not (isinstance(b, dict) and b.get("type") == "null")]
            if len(non_null) == 1:
                # A plain nullable (X | None): collapse to X. Carry over sibling keys
                # (title/description) but drop the now-meaningless anyOf + null default.
                collapsed = {k: v for k, v in node.items() if k not in ("anyOf", "default")}
                collapsed.update(non_null[0])
                return _flatten_nullable(collapsed)
        return {k: _flatten_nullable(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_flatten_nullable(v) for v in node]
    return node


def _emit_tool(emitter: str, schema_model: type[BaseModel]) -> list[dict]:
    """Build the single forced-emit tool spec in the CANONICAL OpenAI shape —
    ``{"type": "function", "function": {"name", "description", "parameters"}}`` — the SAME
    shape every working ``forced_emit`` caller uses (``workflow_authoring.EMIT_TOOL``) and the
    shape the shared gateway + per-provider adapters expect (``forced_emit._coerce_schema_block``
    reads ``t["function"]``).

    TT-01: the earlier Anthropic-native top-level shape (``{name, description, input_schema}``)
    reached the openai-compat wire un-normalized → 400 on strict validators (minimax/moonshot),
    while the NATIVE converters silently DROPPED the malformed tool (google: empty name → 0
    declarations → narrates; anthropic: ``fn["name"]`` KeyError → honest-fail) → vacuous
    all-"did-not-fire" cells across every provider. TT-02: ``_flatten_nullable`` collapses the
    nullable ``anyOf`` so the emitted ``parameters`` also clears strict tool-schema validation.

    Caller-side only — NEVER touches the shared gateway/adapters (red line D-14 / G-5)."""
    return [
        {
            "type": "function",
            "function": {
                "name": emitter,
                "description": f"Emit the structured result per the {schema_model.__name__} schema.",
                "parameters": _flatten_nullable(schema_model.model_json_schema()),
            },
        }
    ]


# ── Candidate generation (one forced_emit shot on the BUILDER model) ────────────
async def build_candidates(
    name: str,
    description: str,
    builder_model: str,
    user_settings: Any,
    n: int = DEFAULT_CANDIDATE_COUNT,
) -> list[str]:
    """Force ONE emission on the builder model returning <=N rewritten descriptions.

    An honest-fail (``emitted`` is None) yields ZERO candidates, never a crash.
    ``builder_model`` resolution + provider derivation is the caller's job (it passes the
    resolved D-08 model). Always sends a NON-EMPTY system prompt (anthropic empty-block 400).
    """
    from app.config import get_model_capability

    provider = (get_model_capability(builder_model) or {}).get("provider", "unknown")
    prompt = (
        f"Skill name: {name}\n"
        f"Current description: {description}\n\n"
        f"Write up to {n} alternative one-sentence descriptions that improve when the "
        f"agent should load this skill (and when it should NOT). Return them as candidates."
    )
    result = await forced_emit(
        messages=[{"role": "user", "content": prompt}],
        model=builder_model,
        provider=provider,
        emitter="emit_candidates",
        tools=_emit_tool("emit_candidates", CandidateDescriptions),
        user_settings=user_settings,
        system_prompt=_BUILDER_SYSTEM_PROMPT,
        schema_model=CandidateDescriptions,
        # Force-without-strict for the optional-heavy schema (mirrors workflow_authoring's
        # Pitfall-1 fix): skips the doomed strict_force rung so OpenAI/DeepSeek don't waste a
        # strict-400 round-trip per call (live-verify follow-on to the TT-01 shape fix).
        strict=False,
    )
    emitted = result.get("emitted")
    if emitted is None:
        return []  # honest-fail floor — never crash
    candidates = [c for c in (emitted.candidates or []) if isinstance(c, str) and c.strip()][:n]
    # D-13 (i): cap candidates at MAX_DESCRIPTION_CHARS (the shared portability bound — the
    # same length skill_lint flags as `too_long`). A builder model can over-write; an
    # over-long candidate would trip the lint AND bloat the catalog note. When any candidate
    # exceeds the cap, run ONE bounded auto-shorten retry and then hard-truncate anything
    # still over — the honest-fail floor above is preserved (the retry is best-effort).
    if any(len(c) > MAX_DESCRIPTION_CHARS for c in candidates):
        candidates = await _shorten_over_cap(
            candidates, name, builder_model, provider, user_settings, n
        )
    return candidates


async def _shorten_over_cap(
    candidates: list[str],
    name: str,
    builder_model: str,
    provider: str,
    user_settings: Any,
    n: int,
) -> list[str]:
    """Bounded auto-shorten for over-cap candidates (D-13 i). ONE re-emit asks the builder to
    rewrite ONLY the offenders under ``MAX_DESCRIPTION_CHARS``; then anything still over is
    hard-truncated so NO returned candidate ever exceeds the cap. Best-effort + never-crash:
    an honest-fail (``emitted`` is None) or an exception on the retry skips straight to
    truncation (mirrors the ``build_candidates`` floor). Returns <=N candidates, de-duped,
    order-preserving (already-fine first, then fitting rewrites, then truncated originals)."""
    ok = [c for c in candidates if len(c) <= MAX_DESCRIPTION_CHARS]
    over = [c for c in candidates if len(c) > MAX_DESCRIPTION_CHARS]

    shortened: list[str] = []
    if over:
        prompt = (
            f"Skill name: {name}\n"
            f"These candidate descriptions are too long (over {MAX_DESCRIPTION_CHARS} "
            f"characters). Rewrite EACH as ONE focused sentence UNDER "
            f"{MAX_DESCRIPTION_CHARS} characters, keeping the concrete task + trigger. "
            f"Return the shortened rewrites as candidates:\n\n"
            + "\n".join(f"- {c[:200]}…" for c in over)
        )
        try:
            result = await forced_emit(
                messages=[{"role": "user", "content": prompt}],
                model=builder_model,
                provider=provider,
                emitter="emit_candidates",
                tools=_emit_tool("emit_candidates", CandidateDescriptions),
                user_settings=user_settings,
                system_prompt=_BUILDER_SYSTEM_PROMPT,
                schema_model=CandidateDescriptions,
                strict=False,
            )
            emitted = result.get("emitted")
            if emitted is not None:
                shortened = [
                    c for c in (emitted.candidates or []) if isinstance(c, str) and c.strip()
                ]
        except Exception:  # pragma: no cover — best-effort; fall through to hard-truncation
            logger.debug("auto-shorten retry failed; hard-truncating over-cap candidates", exc_info=True)

    # Guarantee: every returned candidate is <= the cap. Prefer already-fine candidates, then
    # the fitting rewrites, then hard-truncated originals as the never-crash backstop.
    fits = [c for c in shortened if len(c) <= MAX_DESCRIPTION_CHARS]
    truncated = [c[:MAX_DESCRIPTION_CHARS] for c in over]
    out: list[str] = []
    seen: set[str] = set()
    for c in (*ok, *fits, *truncated):
        if c and c not in seen:
            seen.add(c)
            out.append(c)
        if len(out) >= n:
            break
    return out


# ── Per-case classification (one forced_emit shot on each TARGET model) ──────────
async def classify_fires(
    target_model: str,
    catalog_lines: str,
    user_prompt: str,
    user_settings: Any,
) -> TriggerDecision:
    """Force a TriggerDecision on the TARGET model for ONE case.

    The classifier context is assembled from the SAME pieces as the live path — the
    owner-scoped catalog lines + the imported ``LOAD_SKILL_POLICY`` (Pitfall 1). The
    target model gets NO tools beyond the emitter (V5 — no privilege boundary; worst case
    is a wrong cell, visible to the author who picks the winner). An honest-fail returns a
    safe ``would_load=False`` decision (never crash).
    """
    from app.config import get_model_capability

    provider = (get_model_capability(target_model) or {}).get("provider", "unknown")
    prompt = (
        f"## Available Skills\n{catalog_lines}\n\n"
        f"User request: {user_prompt}\n\n"
        f"Should you load one of the available skills for this request?"
    )
    result = await forced_emit(
        messages=[{"role": "user", "content": prompt}],
        model=target_model,
        provider=provider,
        emitter="emit_trigger_decision",
        tools=_emit_tool("emit_trigger_decision", TriggerDecision),
        user_settings=user_settings,
        system_prompt=_CLASSIFIER_SYSTEM_PROMPT,
        schema_model=TriggerDecision,
        # Force-without-strict (optional skill_name): skip the doomed strict_force rung — OpenAI
        # strict 400s on the optional field — so each per-case classification is one clean
        # forced call (mirrors workflow_authoring; live-verify follow-on to the TT-01 shape fix).
        strict=False,
    )
    emitted = result.get("emitted")
    if emitted is None:
        # Honest-fail floor: a never-reached model is treated as "did not fire".
        return TriggerDecision(would_load=False, skill_name=None)
    return emitted


# ── Owner-scoped sibling auto-seed (D-04 / V4 — leak-safe) ──────────────────────
def auto_seed_cases(skill: dict, sibling_skills: list[dict]) -> dict[str, list[str]]:
    """Seed the benchmark cases for a skill.

    - ``should_fire``: paraphrases of THIS skill's description (the recall rail).
    - ``should_not``: paraphrased trigger prompts derived from the SIBLING catalog
      (the false-fire rail) + the fixed generic off-topic set.

    ``sibling_skills`` MUST come from the owner-scoped
    ``.or_(user_id.eq.{id}, is_global.eq.true).eq(is_enabled, True)`` query
    (see ``fetch_owner_scoped_siblings``) — this function NEVER reads the DB itself, so a
    caller cannot accidentally widen the scope here. A sibling's own name/description is the
    only thing seeded; another user's private skill never reaches this list.
    """
    name = (skill.get("name") or "").strip()
    description = (skill.get("description") or "").strip()

    should_fire: list[str] = []
    if description:
        should_fire.append(description)
        should_fire.append(f"I need to {description[0].lower() + description[1:]}"
                            if description else description)
    if name:
        should_fire.append(f"Use the {name} skill.")

    # Phase 123.1 (WR-02): de-dup the sibling-sourced descriptions PRESERVING ORDER before the
    # cap. Two owner/global siblings can share an identical description (common boilerplate); a
    # plain (un-deduped) list would let the cap count a duplicate while ``seed_cases_with_provenance``
    # reports ``should_not_total = len(set(...))`` (de-duped) — so the editor's "showing N of M"
    # banner math disagreed (N could exceed the true distinct M). De-duping here makes the run
    # path (auto_seed_cases), the GET-seed path, and ``should_not_total`` all agree on the SAME
    # distinct set. Mirrors the order-preserving ``seen: set`` de-dupe used for candidates.
    sibling_sourced: list[str] = []
    _seen_sib: set[str] = set()
    for sib in sibling_skills:
        sib_desc = (sib.get("description") or "").strip()
        if sib_desc and sib_desc != description and sib_desc not in _seen_sib:
            _seen_sib.add(sib_desc)
            sibling_sourced.append(sib_desc)
    # Cap the SIBLING-sourced false-fire bait at MAX_SEEDED_SHOULD_NOT (Phase 123.1-05 /
    # BUG-260624-01 #1). A pure post-fetch slice of the already-leak-safe owner-scoped list —
    # never re-reads the DB, never widens scope. The run path uses this same capped set so the
    # editor (the GET) shows exactly what runs.
    should_not: list[str] = sibling_sourced[:MAX_SEEDED_SHOULD_NOT]
    # The generic off-topic baseline is ALWAYS kept in full (never part of the cap accounting).
    should_not.extend(_GENERIC_OFF_TOPIC)

    return {
        "should_fire": [c for c in should_fire if c],
        "should_not": [c for c in should_not if c],
    }


# Provenance labels for the seeded cases (Phase 123.1 / D-05). NEVER ``"held"`` — the 60/40
# held-out split is computed at SCORING time (split_held_out), not authored into the seed.
PROVENANCE_SEEDED = "seeded"    # this skill's own description/paraphrase + the generic off-topic set
PROVENANCE_SIBLING = "sibling"  # a sibling skill's description (the owner-scoped false-fire rail)


def seed_cases_with_provenance(
    skill: dict, sibling_skills: list[dict]
) -> dict[str, list[dict[str, str]]]:
    """Provenance-carrying variant of ``auto_seed_cases`` (Phase 123.1 / D-05).

    Returns ``should_fire`` / ``should_not`` as lists of ``{"prompt", "provenance"}`` dicts so
    the editor can SHOW (and edit) the seeded cases with their origin before a run (HIGH #2 /
    WR-05 — the editor previously showed "0 cases"):

      - the skill's own description / paraphrase / ``"Use the {name} skill."`` → ``"seeded"``
      - each sibling's description (the false-fire rail)                        → ``"sibling"``
      - the fixed ``_GENERIC_OFF_TOPIC`` set                                    → ``"seeded"``

    ``"held"`` is NEVER authored here — the held-out partition is a scoring-time concept
    (``split_held_out`` takes a deterministic 60/40 cut), not a seed provenance.

    Like ``auto_seed_cases``, this function NEVER reads the DB itself — ``sibling_skills`` MUST
    arrive only from the owner-scoped ``fetch_owner_scoped_siblings`` so a caller cannot widen
    the scope here (D-04 / V4 leak gate preserved). A reused thin string-only contract:
    ``auto_seed_cases`` is unchanged and still drives the run path.
    """
    base = auto_seed_cases(skill, sibling_skills)
    description = (skill.get("description") or "").strip()

    # Reconstruct which should_not entries came from a sibling (vs the generic off-topic set):
    # mirror auto_seed_cases' membership test (sib_desc present AND != this skill's description).
    sibling_descs = {
        d
        for d in (
            (sib.get("description") or "").strip() for sib in sibling_skills
        )
        if d and d != description
    }

    should_fire = [
        {"prompt": p, "provenance": PROVENANCE_SEEDED} for p in base["should_fire"]
    ]
    should_not = [
        {
            "prompt": p,
            "provenance": PROVENANCE_SIBLING if p in sibling_descs else PROVENANCE_SEEDED,
        }
        for p in base["should_not"]
    ]
    # The FULL uncapped sibling-sourced count (Phase 123.1-05 / BUG-260624-01 #1) — the route
    # turns this into the GET's top-level `total` so the editor can show "showing N of M —
    # capped" honestly. `sibling_descs` is the de-duped uncapped sibling membership (the same
    # filter auto_seed_cases applies: present AND != this skill's description) — `base`'s
    # should_not is already SLICED to MAX_SEEDED_SHOULD_NOT, so derive the total from the
    # pre-cap set, not from the (capped) base output. Only sibling-sourced entries count
    # toward the cap; the constant generic off-topic set is never part of the accounting.
    should_not_total = len(sibling_descs)
    return {
        "should_fire": should_fire,
        "should_not": should_not,
        "should_not_total": should_not_total,
    }


def fetch_owner_scoped_siblings(supabase, user_id: str, exclude_skill_id: str | None = None) -> list[dict]:
    """Fetch the requesting owner's + global skills via the EXACT owner-scoped catalog
    query (D-04 / V4 / T-123-03-01). ``get_supabase()`` is the SERVICE-ROLE client (RLS
    bypassed) — this app-code ``.or_(user_id.eq.{id}, is_global.eq.true)`` scoping is the
    SOLE leak gate. A user must NEVER see another user's private skill as bait.

    Degrades to ``[]`` on read failure (the auto-seed stays advisory; never crashes).
    """
    try:
        resp = (
            supabase.table("skills")
            .select("id, name, description")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")
            .eq("is_enabled", True)
            .execute()
        )
        rows = list(resp.data or [])
    except Exception:  # pragma: no cover — defensive; leak-safe degradation
        logger.debug("fetch_owner_scoped_siblings swallowed a read error", exc_info=True)
        return []
    if exclude_skill_id is not None:
        rows = [r for r in rows if str(r.get("id")) != str(exclude_skill_id)]
    return rows


# ── PURE scoring math (60/40 split + 3-repeat aggregate + winner-by-held-out) ───
def split_held_out(
    cases: list[Any],
    ratio: float = DEFAULT_HELD_OUT_TRAIN_RATIO,
) -> tuple[list[Any], list[Any]]:
    """Partition ``cases`` into (train, held_out) DETERMINISTICALLY: the first
    ``floor(ratio * n)`` cases are train, the rest are held-out. A 60/40 split by default.

    Deterministic (no shuffle) so a re-run scores the SAME partition — the held-out set is
    the honest generalization signal, and the author can reproduce a verdict.
    """
    n = len(cases)
    if n == 0:
        return [], []
    cut = int(n * ratio)
    # Guarantee at least one held-out case when there are >=2 cases (a 1-case held-out is
    # the minimum honest generalization signal).
    if cut >= n and n >= 2:
        cut = n - 1
    return list(cases[:cut]), list(cases[cut:])


def aggregate_repeats(repeat_scores: list[float], repeats: int = DEFAULT_REPEATS) -> float:
    """Average a list of per-repeat scores. ``repeats`` documents the intended repeat
    count; the function averages whatever it is given (the caller drives the repeat loop).
    An empty list -> 0.0 (no signal)."""
    if not repeat_scores:
        return 0.0
    return sum(repeat_scores) / len(repeat_scores)


def _score_axis(decisions: list[bool], expected: bool) -> float:
    """Fraction of decisions matching ``expected`` (recall for should-fire, precision for
    should-NOT). Empty -> 1.0 (a vacuous axis does not drag the score down)."""
    if not decisions:
        return 1.0
    correct = sum(1 for d in decisions if d == expected)
    return correct / len(decisions)


def build_cell(
    provider: str,
    model: str,
    fire_decisions: list[bool],
    no_false_decisions: list[bool],
    fire_error_count: int = 0,
    no_false_error_count: int = 0,
) -> dict:
    """Assemble one per-provider scoreboard cell carrying BOTH sub-scores (042-A — the
    false-fire rail is NEVER hidden). ``fires`` = recall over should-FIRE cases (fraction
    that fired); ``no_false`` = precision over should-NOT cases (fraction that did NOT
    fire). Mirrors the ``_build_forced_emit_cell`` axes-dict shape, but the Tuner's axes
    are fires/no_false (not trigger/force/recovery/honest_fail).

    Phase 123.1-06 HONESTY (backlog §2):

    * **TT-05 — honest empty axis.** An axis with NO aggregated decisions is rendered as the
      unmeasured sentinel ``None`` (the frontend shows "n/a"), NEVER a fabricated ``1.0``.
      ``None`` means "no cases of that class were scored" — DISTINCT from a measured ``0.0``
      (the model genuinely scored badly). The internal ``_score_axis`` 1.0-empty floor is for
      the held-out math only; the TOP-LEVEL cell must not read that floor as a real score.
      The combined ``score`` is computed from the MEASURED axes only: both measured -> mean of
      the two; exactly one measured -> that one; neither measured -> ``None`` (wholly unmeasured).

    * **TT-12 — per-cell error accounting.** ``fire_error_count`` / ``no_false_error_count``
      are the counts of held-out classify CALLS that RAISED for each axis (the caller computes
      them — an exception is "we could not measure", NOT "the model said no"). The cell carries
      ``measured`` (True when at least one REAL aggregated decision landed on at least one axis;
      False when EVERY call across both axes raised) and ``error_count`` (the summed raise count)
      so the route can exclude an all-error column from ``target_count`` and the UI can explain
      "could not measure". An empty-but-no-error axis (a candidate that simply had no cases of a
      class) is NOT all-error — ``measured`` is driven by "had at least one real decision".
    """
    fires = (
        _score_axis(fire_decisions, expected=True)  # should-fire -> should fire
        if fire_decisions else None                  # TT-05: no cases -> unmeasured, NOT 1.0
    )
    no_false = (
        _score_axis(no_false_decisions, expected=False)  # should-NOT -> should NOT fire
        if no_false_decisions else None                   # TT-05: no cases -> unmeasured, NOT 1.0
    )

    # TT-05: the combined score is the mean of the MEASURED axes only (a None axis is excluded);
    # if NEITHER axis measured, the whole cell is unmeasured -> score None.
    measured_axes = [a for a in (fires, no_false) if a is not None]
    score = (sum(measured_axes) / len(measured_axes)) if measured_axes else None

    # TT-12: the cell measured iff at least one REAL aggregated decision landed (an all-error
    # column has BOTH decision lists empty AND error_count > 0 -> measured=False).
    measured = (len(fire_decisions) + len(no_false_decisions)) > 0

    return {
        "provider": provider,
        "model": model,
        "axes": {
            "fires": fires,
            "no_false": no_false,
        },
        "score": score,
        "measured": measured,
        "error_count": int(fire_error_count) + int(no_false_error_count),
    }


def cell_score(cell: dict) -> float | None:
    """The combined held-out score for a cell — the SINGLE stored value (TT-15: one source of
    truth). Returns ``cell["score"]`` verbatim when present (no recomputation that could drift
    from what ``build_cell`` stored). ``None`` propagates for a wholly-unmeasured cell (the
    caller skips it in the held-out mean). Only when ``score`` is ABSENT (a legacy/hand-built
    cell that predates the stored field) does it fall back to the ``(fires+no_false)/2``
    recompute over MEASURED axes — treating a ``None`` axis as ``0.0`` for that fallback only."""
    if "score" in cell:
        return cell["score"]
    axes = cell.get("axes", {})
    fires = axes.get("fires")
    no_false = axes.get("no_false")
    return (float(fires or 0.0) + float(no_false or 0.0)) / 2.0


def _candidate_is_measured(candidate: dict) -> bool:
    """True iff a scored candidate has AT LEAST ONE measured cell. The job marks the candidate
    with a ``measured`` flag (preferred), but fall back to inspecting the cells so a hand-built
    candidate dict still works: a candidate is measured iff any of its cells is measured=True
    (an all-error / wholly-unmeasured candidate has ZERO measured cells).

    Legacy/hand-built candidates that carry neither a ``measured`` flag nor ``cells`` (e.g. the
    Phase-123 ``pick_winner`` unit tests, or any caller that supplies only an aggregated
    ``held_out_score``) are treated as measured when ``held_out_score`` is non-None — that real
    score is itself the measured signal, distinct from the 0.0 unmeasured FALLBACK the WR-05 path
    guards against. Real all-error candidates from ``_run_tuner_job`` always carry
    ``measured=False`` and so are still correctly excluded by the first branch."""
    if "measured" in candidate:
        return bool(candidate["measured"])
    if "cells" in candidate:
        return any(c.get("measured") for c in candidate.get("cells", []))
    return candidate.get("held_out_score") is not None


def pick_winner(candidates: list[dict]) -> dict | None:
    """Pick the winning candidate by HELD-OUT score, NEVER by train (Pitfall —
    pick-by-train forbidden). Each candidate dict must carry a ``held_out_score`` (the
    aggregated held-out number). A candidate that wins TRAIN but loses HELD-OUT is NOT
    selected. Returns the winning candidate dict, or None when there are no candidates.

    WR-05 (honest winner): a winner is only picked from candidates that ACTUALLY measured
    something. When NO candidate has any measured cell (e.g. every provider all-errored), every
    ``held_out_score`` is the 0.0 unmeasured FALLBACK — picking index 0 from that would badge a
    "winner" chosen by noise (the same lie TT-12 closes for cells, leaking back at the candidate
    level). In that case return ``None`` so the route records ``winner_index = None`` and the UI
    renders "could not measure — no winner" instead of confirming a noise winner. When at least
    one candidate measured, the winner is picked from the MEASURED candidates only (a measured
    0.0 still beats an unmeasured one)."""
    if not candidates:
        return None
    measured = [c for c in candidates if _candidate_is_measured(c)]
    if not measured:
        # No candidate measured anything — there is no honest winner (do not default to index 0).
        return None
    return max(measured, key=lambda c: c.get("held_out_score", 0.0))


# ── N-column configured-target adaptivity (Pattern 4 / 042-A) ───────────────────
# One representative model per provider (mirrors _SUB_AGENT_MODEL_DEFAULTS / 096 curation).
_REPRESENTATIVE_MODEL: dict[str, str] = {
    "openai": "gpt-5.4-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "google": "gemini-3.5-flash",
    # Phase 123 (CR-02): OpenRouter is a DISTINCT first-class target (gateway), so it
    # needs a CONCRETE representative model — an empty string made the job's
    # ``if not model: continue`` skip the lane entirely (no cell, frontend lane stuck
    # "queued" forever, OpenRouter-only installs scored ZERO columns). ``deepseek/deepseek-chat``
    # is an openrouter-provider registry row with ``forced_emission: True`` / ``emit_tier: "force"``
    # (config.py) — i.e. it can actually be forced to emit the TriggerDecision, unlike the
    # ``moonshotai/kimi-*`` coerce rows. This mirrors the one-representative-per-provider
    # pattern used for every other column.
    "openrouter": "deepseek/deepseek-chat",
    "deepseek": "deepseek-v4-flash",
    "moonshot": "kimi-k2.6",
    "minimax": "MiniMax-M2.7-highspeed",
    "zhipu": "glm-5-turbo",
}

# Each provider's API-key attribute on Settings (presence-only probe — T-123-03-02:
# read PRESENCE, never the value, never log it). Local providers have a base_url instead.
_PROVIDER_KEY_ATTR: dict[str, str] = {
    "openai": "openai_api_key",
    "anthropic": "anthropic_api_key",
    "google": "google_api_key",
    "openrouter": "openrouter_api_key",
    "deepseek": "deepseek_api_key",
    "moonshot": "moonshot_api_key",
    "minimax": "minimax_api_key",
    "zhipu": "zhipu_api_key",
}

# Local providers are configured by a base_url, not a key.
_PROVIDER_BASE_URL_ATTR: dict[str, str] = {
    "ollama": "ollama_base_url",
    "lmstudio": "lmstudio_base_url",
}


def configured_targets(settings) -> list[dict]:
    """Derive the N-column benchmark target set from configured-provider PRESENCE
    (Pattern 4 / D-05 / 042-A band).

    A provider appears IFF it has a non-empty API key OR (for local) a non-empty
    base_url — read by PRESENCE only (truthy check), never the value (T-123-03-02). One
    representative model per provider. OpenRouter (gateway) and native
    deepseek/zhipu/moonshot/minimax are DISTINCT entries. N=1 (single configured provider)
    is a VALID clean result — the single-provider baseline, NOT a degraded one. A provider
    the org doesn't run NEVER appears.

    Phase 123 (CR-01): DUCK-TYPED across two settings shapes so the tuner job can pass the
    DB-effective ``UserEffectiveSettings`` (where provider keys live in ``.providers``, a list
    of ``LLMProvider`` — there is NO flat ``{provider}_api_key`` attribute) WITHOUT breaking
    the env-level ``app.config.settings`` callers (flat ``{provider}_api_key`` attrs) or the
    existing SimpleNamespace unit tests:
      • If the passed object exposes a truthy ``providers`` list → derive the present-provider
        set from ``[p.id for p in providers if p.api_key]`` (keyed providers) plus any LOCAL
        provider (ollama/lmstudio) whose ``base_url`` is truthy.
      • OTHERWISE fall back to the flat ``_PROVIDER_KEY_ATTR`` / ``_PROVIDER_BASE_URL_ATTR``
        getattr probe.

    Returns a list of ``{provider, model}`` dicts (the scoreboard columns).
    """
    present: list[str] = []

    providers = getattr(settings, "providers", None)
    if isinstance(providers, list) and providers:
        # DB-effective (UserEffectiveSettings) shape — keys live on the LLMProvider list.
        local_ids = set(_PROVIDER_BASE_URL_ATTR.keys())  # {"ollama", "lmstudio"}
        for p in providers:
            pid = getattr(p, "id", "") or ""
            api_key = (getattr(p, "api_key", "") or "").strip()
            base_url = (getattr(p, "base_url", "") or "").strip()
            if pid in local_ids:
                # Local providers are configured by base_url (no paid SPOF — D-08).
                if base_url:
                    present.append(pid)
            elif pid in _PROVIDER_KEY_ATTR and api_key:
                present.append(pid)
    else:
        # Env-level Settings / SimpleNamespace shape — flat per-provider attrs.
        for provider, key_attr in _PROVIDER_KEY_ATTR.items():
            if (getattr(settings, key_attr, "") or "").strip():
                present.append(provider)
        for provider, url_attr in _PROVIDER_BASE_URL_ATTR.items():
            if (getattr(settings, url_attr, "") or "").strip():
                present.append(provider)

    # Map each present provider through its single representative model (presence-only —
    # never reads/logs the key value, T-123-03-02). De-dupe preserving first-seen order.
    targets: list[dict] = []
    seen: set[str] = set()
    for provider in present:
        if provider in seen:
            continue
        seen.add(provider)
        targets.append({"provider": provider, "model": _REPRESENTATIVE_MODEL.get(provider, "")})
    return targets
