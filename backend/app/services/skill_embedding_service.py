"""Phase 140 (TRIG-02 / Plan 02) — skill-vector embed source + backfill lifecycle.

The smart-dispatch pre-filter (Plan 04) ranks the ``## Available Skills`` catalog by
semantic relevance when it exceeds the token budget. That ranking needs ONE vector per
skill, kept fresh OFF the hot path — this module owns that data-population half.

Task 1 (this commit): the pure, DB-free signal-set builder + staleness fingerprint.
Task 2 (next): the ``reembed_service``-shaped backfill job + the fire-and-forget
``kick_skill_backfill`` self-heal primitive (Blocker-1, consumed by Plan 04).

  * ``build_skill_embed_source`` — the D-01 signal set: a skill's ``description`` +
    its owner-authored ``should_fire`` test-case prompts (``skill_test_cases.prompt``,
    migration 079), falling back to the skill ``name`` when both are absent. A huge
    test-suite can't dominate one embed — 4000-char cap.
  * ``skill_source_text_hash`` — a deterministic sha256 staleness fingerprint (a
    non-crypto fast hash; ASVS V6 confirms no crypto boundary — Pitfall 2 / D-10 pairs
    it with the embedding_model tag).

Migration 091 (the real ``skill_embeddings`` table + ``match_skills`` RPC) is applied in
the [BLOCKING] Plan 05, where the REAL vector round-trip is exercised. This module's tests
(``tests/integration/test_140_skill_embedding_service.py``) are mock/unit level.
"""

from __future__ import annotations

import hashlib

# The default embedding model, mirroring reembed_service.DEFAULT_MODEL — text-embedding-3
# vectors are L2-normalized, so cosine (<=>) ranks identically to a dot product.
DEFAULT_MODEL = "text-embedding-3-small"

# The maximum embed-source length. A modest cap so a pathological test-suite (dozens of
# long should_fire prompts) can't dominate one skill's single vector.
MAX_SOURCE_CHARS = 4000


def _current_model(app_settings) -> str:
    """The currently-configured embedding model (mirrors reembed_service._current_model)."""
    return getattr(app_settings, "embedding_model", "") or DEFAULT_MODEL


# ── D-01 embed-source builder + staleness fingerprint (pure) ──────────────────


def build_skill_embed_source(skill: dict, test_case_prompts: list[str]) -> str:
    """Build the single embed-source string for a skill (D-01 signal set).

    Concatenate the skill ``description`` with each non-empty ``should_fire``
    test-case prompt (``skill_test_cases.prompt``), one per line. If BOTH are absent
    (no description AND no cases), fall back to the skill ``name`` so a bare skill still
    produces a non-empty, embeddable source. Truncate to ``MAX_SOURCE_CHARS`` so a huge
    test-suite can't dominate one vector.
    """
    parts = [(skill.get("description") or "").strip()]
    parts += [(p or "").strip() for p in (test_case_prompts or [])]
    text = "\n".join(p for p in parts if p)
    if not text:  # no description AND no non-empty test cases
        text = (skill.get("name") or "").strip()
    return text[:MAX_SOURCE_CHARS]


def skill_source_text_hash(text: str) -> str:
    """Deterministic staleness fingerprint (sha256 hexdigest).

    A non-security fast hash — it only detects "did the embed source change?" so the
    job re-embeds a skill whose description/cases changed. NOT a crypto boundary
    (ASVS V6); D-10 pairs it with the ``embedding_model`` tag for cross-vector-space
    safety.
    """
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()
