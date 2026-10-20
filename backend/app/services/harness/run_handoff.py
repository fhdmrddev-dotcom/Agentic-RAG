"""What one step hands the next re-run of itself — a PURE LEAF (Phase 295, plan 295-03).

289-02's rule, applied: *branching lives in a helper module*, so the hot executor file
(``phase_types.py``, G-5 FIRING) spends ONE call substitution and gains no branch. This module
imports nothing from ``app`` — it reads attributes off the run ``ctx`` and nothing else, so it
can never close the harness-package import cycle.
"""
from __future__ import annotations

__all__ = ["phase_scope_ids"]


def phase_scope_ids(ctx, phase):
    """The folder ids this step searches: a per-run folder override for THIS step, else the
    run's resolved project subtree.

    D-03: "Search another folder" re-runs the step once over the chosen folder's subtree,
    which ``engine_ask.consume_engine_answer`` puts on ``ctx.phase_scope_override[slug]`` (a
    LIST — Pitfall 1: a set would break the RPC's JSON param). The override lives on the ctx
    of this re-drive only; it is recorded in the approval receipt and never written to the
    definition. The step's own ``folder_scope`` intersection still applies on top, so the
    result only narrows from what the override names.
    """
    override = (getattr(ctx, "phase_scope_override", None) or {}).get(getattr(phase, "slug", None))
    return override if override is not None else getattr(ctx, "folder_subtree_ids", None)
