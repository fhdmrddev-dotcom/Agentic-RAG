"""Phase 123 Plan 03 Task 2 — PURE scoring math for the Skill Trigger Tuner.

These tests drive the NET-NEW pure scoring functions with NO LLM and NO I/O:
  - split_held_out: deterministic 60/40 train/held-out partition.
  - aggregate_repeats: 3-repeat averaging.
  - build_cell: each per-provider cell carries BOTH sub-scores (fires recall +
    no_false precision) — the false-fire rail is NEVER dropped (042-A).
  - pick_winner: the winner is selected by HELD-OUT score, NEVER by train; a
    candidate that wins TRAIN but loses HELD-OUT is NOT selected (Pitfall —
    pick-by-train forbidden).

CONVENTION: imports INSIDE the test bodies.
"""

from __future__ import annotations


# ── 60/40 deterministic split ───────────────────────────────────────────────
def test_split_held_out_is_60_40_deterministic():
    from app.services.skill_tuner_service import split_held_out

    cases = list(range(10))
    train, held = split_held_out(cases, ratio=0.6)
    assert train == [0, 1, 2, 3, 4, 5], "first 60% are train"
    assert held == [6, 7, 8, 9], "remaining 40% are held-out"
    # Deterministic — a second call yields the SAME partition.
    train2, held2 = split_held_out(cases, ratio=0.6)
    assert (train, held) == (train2, held2), "split must be deterministic (no shuffle)"


def test_split_held_out_guarantees_a_held_out_case():
    """A small case set must still produce at least one held-out case (the minimum
    honest generalization signal)."""
    from app.services.skill_tuner_service import split_held_out

    train, held = split_held_out([1, 2], ratio=0.6)
    assert len(held) >= 1, ">=2 cases must leave at least one held-out case"
    train, held = split_held_out([], ratio=0.6)
    assert train == [] and held == [], "empty input -> empty partitions, no crash"


# ── per-class held-out split (WR-02 — recall axis must not be vacuous) ─────────
def test_per_class_held_out_carries_both_rails():
    """Phase 123 (WR-02): cases are assembled class-sorted ([should_fire...] +
    [should_not...]). A SINGLE deterministic 60/40 cut put ~100% should-NOT in the
    held-out tail, leaving the should-fire (recall) axis empty -> a vacuous 1.0. The
    job's per-class split (mirrored here) must leave BOTH classes represented in
    held-out whenever the source has both."""
    from app.services.skill_tuner_service import split_held_out

    # Class-sorted exactly as start_tuner_run builds ``cases``.
    cases = (
        [{"prompt": f"fire-{i}", "should_fire": True} for i in range(5)]
        + [{"prompt": f"nofire-{i}", "should_fire": False} for i in range(5)]
    )

    # ── the OLD single-cut behaviour (what WR-02 flagged) ──
    _, old_held = split_held_out(cases)
    assert not any(c["should_fire"] for c in old_held), (
        "single ordered cut leaves the held-out tail all should-NOT (the vacuous-recall bug)"
    )

    # ── the FIXED per-class split (mirrors skill_tuner._run_tuner_job) ──
    fire = [c for c in cases if c.get("should_fire")]
    nofire = [c for c in cases if not c.get("should_fire")]
    _, ho_f = split_held_out(fire)
    _, ho_n = split_held_out(nofire)
    held_out = ho_f + ho_n

    assert any(c["should_fire"] for c in held_out), "held-out must carry should_fire cases"
    assert any(not c["should_fire"] for c in held_out), "held-out must carry should_not cases"


# ── 3-repeat aggregation ──────────────────────────────────────────────────────
def test_aggregate_repeats_averages():
    from app.services.skill_tuner_service import aggregate_repeats

    assert aggregate_repeats([1.0, 0.0, 0.5], repeats=3) == 0.5
    assert aggregate_repeats([]) == 0.0, "no signal -> 0.0, never a crash"


# ── both sub-scores present in every cell (042-A) ─────────────────────────────
def test_cell_carries_both_fires_and_no_false():
    from app.services.skill_tuner_service import build_cell

    # 3 should-fire cases: 2 fired (True) -> fires recall = 2/3.
    # 4 should-NOT cases: 1 wrongly fired (True) -> no_false precision = 3/4.
    cell = build_cell(
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        fire_decisions=[True, True, False],
        no_false_decisions=[False, False, True, False],
    )
    assert "fires" in cell["axes"], "the fires (recall) sub-score must be present"
    assert "no_false" in cell["axes"], "the no_false (precision) sub-score must be present"
    assert abs(cell["axes"]["fires"] - (2 / 3)) < 1e-9
    assert abs(cell["axes"]["no_false"] - (3 / 4)) < 1e-9
    assert cell["provider"] == "anthropic"
    assert cell["model"] == "claude-haiku-4-5-20251001"


def test_no_false_never_hidden_when_all_fire():
    """Even when the skill fires on everything (great recall), the no_false rail must
    still be computed and shown — never silently dropped."""
    from app.services.skill_tuner_service import build_cell

    cell = build_cell(
        provider="openai",
        model="gpt-5.4-mini",
        fire_decisions=[True, True, True],     # perfect recall
        no_false_decisions=[True, True, True],  # but fires on everything = 0 precision
    )
    assert cell["axes"]["fires"] == 1.0
    assert cell["axes"]["no_false"] == 0.0, (
        "a skill that fires on the should-NOT cases must score 0 no_false (the false-fire "
        "rail is never hidden)"
    )


# ── winner-by-held-out (Pitfall — pick-by-train forbidden) ────────────────────
def test_winner_picked_by_held_out_not_train():
    from app.services.skill_tuner_service import pick_winner

    candidates = [
        {"description": "A", "train_score": 0.99, "held_out_score": 0.40},  # overfits train
        {"description": "B", "train_score": 0.70, "held_out_score": 0.85},  # generalizes
    ]
    winner = pick_winner(candidates)
    assert winner["description"] == "B", (
        "the held-out winner (B) must be selected even though A wins train — a "
        "train-winner/held-out-loser is NOT picked"
    )


def test_pick_winner_empty_returns_none():
    from app.services.skill_tuner_service import pick_winner

    assert pick_winner([]) is None, "no candidates -> None, never a crash"


def test_cell_score_is_mean_of_axes():
    from app.services.skill_tuner_service import build_cell, cell_score

    cell = build_cell("google", "gemini-3.5-flash", [True, True], [False, False])
    assert cell_score(cell) == 1.0, "perfect on both axes -> 1.0"
    cell2 = build_cell("google", "gemini-3.5-flash", [True, False], [False, True])
    assert abs(cell_score(cell2) - 0.5) < 1e-9, "0.5 recall + 0.5 precision -> 0.5 mean"
