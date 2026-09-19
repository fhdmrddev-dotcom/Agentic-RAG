"""ROADMAP SC#1 as an ENFORCED property, not a one-time seed (Phase 257.1 / METER-01).

SC#1: "Every model the product can run has an input and output rate with an effective
date, and repricing a model adds a new effective-dated row."

⚠ WHY A FENCE AND NOT JUST A MIGRATION. Phase 257 satisfied the *shape* of SC#1 and
missed its *substance*: migration 183 seeded five rates, and measured against 1,595 real
runs on 2026-09-19 exactly ONE of the 78 models actually in use had a rate — 98.3% of
runs read as unrated and the dashboard's headline figure was $0.2666. A seed is a
snapshot; the roster moves. **The next model added to MODEL_CAPABILITIES would silently
reintroduce the same hole**, and nothing in the repository would notice. This test is the
thing that notices.

⛔ IT IS DELIBERATELY A STATIC FENCE — it reads `MODEL_CAPABILITIES` and the migration
files, never the database. A test that needs Postgres is a test that SKIPS in CI, and a
skip reads as "not failing" (the same trap named in `uat_257_scenarios.py`'s skipif).

⛔ AND IT FAILS ON A STALE EXEMPTION, NOT ONLY ON A MISSING RATE. An allowlist nobody can
be forced to revisit is how "temporarily unrated" becomes permanent. If an exempt model
gains a rate, or leaves the roster, this test fails and the entry must be removed.
"""

from __future__ import annotations

import ast
import pathlib
import re

_REPO = pathlib.Path(__file__).resolve().parents[3]
_CONFIG = _REPO / "backend" / "app" / "config.py"
_MIGRATIONS = _REPO / "supabase" / "migrations"

# ─────────────────────────────────────────────────────────────────────────────
# The ONLY models permitted to have no rate, each with the reason it cannot have
# one. A bare id with no reason is not an exemption, it is an oversight.
# ─────────────────────────────────────────────────────────────────────────────
UNRATED_BY_DESIGN: dict[str, str] = {
    # OpenRouter is a ROUTER. What a request costs depends on which upstream provider
    # serves it, so a single effective-dated row would be a fiction dressed as a fact.
    # The product already renders these honestly as "Unrated" (SC#2 holds for them).
    "deepseek/deepseek-chat": "openrouter: price depends on upstream routing",
    "deepseek/deepseek-r1": "openrouter: price depends on upstream routing",
    "deepseek/deepseek-v4-pro": "openrouter: price depends on upstream routing",
    "minimax/minimax-01": "openrouter: price depends on upstream routing",
    "minimax/minimax-m2.7": "openrouter: price depends on upstream routing",
    "moonshotai/kimi-k2.5": "openrouter: price depends on upstream routing",
    "moonshotai/kimi-k2.6": "openrouter: price depends on upstream routing",
    "z-ai/glm-5.1": "openrouter: price depends on upstream routing",
    "z-ai/glm-5.2": "openrouter: price depends on upstream routing",
    # Retired / unlisted upstream. Inventing a number for a model whose vendor no longer
    # publishes one is precisely the failure this phase exists to prevent.
    "kimi-k2.5": "not on Moonshot's current pricing page (retired) as of 2026-09-19",
    "moonshot-v1-8k": "not on Moonshot's current pricing page (retired) as of 2026-09-19",
    "glm-5-turbo": "not on z.ai's published pricing table as of 2026-09-19",
}


def _roster() -> dict[str, str]:
    """model_id -> provider, read from MODEL_CAPABILITIES via ast.

    ⛔ ast, not a regex over the source. This file's sibling fence
    (`test_257_single_token_conversion_home.py`) carries the same note for the same
    reason: a text scan cannot tell a live dict entry from one sitting in a comment.
    """
    tree = ast.parse(_CONFIG.read_text(encoding="utf-8"), filename=str(_CONFIG))
    for node in ast.walk(tree):
        targets = (
            node.targets if isinstance(node, ast.Assign)
            else [node.target] if isinstance(node, ast.AnnAssign)
            else []
        )
        if not any(isinstance(t, ast.Name) and t.id == "MODEL_CAPABILITIES" for t in targets):
            continue
        value = node.value
        assert isinstance(value, ast.Dict), "MODEL_CAPABILITIES is no longer a dict literal"
        out: dict[str, str] = {}
        for k, v in zip(value.keys, value.values):
            if not isinstance(k, ast.Constant) or not isinstance(k.value, str):
                continue
            provider = ""
            if isinstance(v, ast.Dict):
                for vk, vv in zip(v.keys, v.values):
                    if (
                        isinstance(vk, ast.Constant)
                        and vk.value == "provider"
                        and isinstance(vv, ast.Constant)
                    ):
                        provider = str(vv.value)
            out[k.value] = provider
        return out
    raise AssertionError("MODEL_CAPABILITIES not found in config.py")


def _seeded_model_ids() -> set[str]:
    """Every model_id inserted into public.model_rates by any migration."""
    seeded: set[str] = set()
    for path in sorted(_MIGRATIONS.glob("*.sql")):
        sql = path.read_text(encoding="utf-8")
        if "model_rates" not in sql:
            continue
        # rows look like:  ('gpt-4o', 'openai', 2.500000, 10.000000, '...'),
        for m in re.finditer(r"^\s*\('([^']+)'\s*,\s*'([^']*)'\s*,\s*[\d.]+", sql, re.M):
            seeded.add(m.group(1))
    return seeded


def test_every_runnable_model_has_a_rate_or_a_stated_reason():
    """SC#1: no model in MODEL_CAPABILITIES is silently unpriced."""
    roster = _roster()
    seeded = _seeded_model_ids()
    assert roster, "roster came back empty — the ast walk is broken, not the data"
    assert seeded, "no seeded rates found — the migration scan is broken, not the data"

    missing = sorted(
        f"{provider or '?'}/{model}"
        for model, provider in roster.items()
        if model not in seeded and model not in UNRATED_BY_DESIGN
    )
    assert not missing, (
        "ROADMAP SC#1: these models are runnable but have NO rate and NO stated reason.\n"
        "Add an effective-dated row in a new migration, or add the id to "
        "UNRATED_BY_DESIGN WITH the reason it cannot be priced:\n  "
        + "\n  ".join(missing)
    )


def test_no_exemption_has_gone_stale():
    """An allowlist nobody revisits is how 'temporarily unrated' becomes permanent."""
    roster = _roster()
    seeded = _seeded_model_ids()

    now_rated = sorted(m for m in UNRATED_BY_DESIGN if m in seeded)
    assert not now_rated, (
        "these models are exempted from SC#1 but DO now have a seeded rate — "
        "remove them from UNRATED_BY_DESIGN so the exemption list keeps meaning "
        f"something: {now_rated}"
    )

    gone = sorted(m for m in UNRATED_BY_DESIGN if m not in roster)
    assert not gone, (
        "these models are exempted from SC#1 but are no longer in MODEL_CAPABILITIES — "
        f"the product cannot run them, so the exemption is dead weight: {gone}"
    )


def test_every_exemption_states_a_reason():
    """A bare id is not an exemption, it is an oversight with an allowlist entry."""
    empty = sorted(m for m, why in UNRATED_BY_DESIGN.items() if not why or not why.strip())
    assert not empty, f"exempted with no reason given: {empty}"
