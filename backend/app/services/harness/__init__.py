"""Harness service package (Phase 091).

Sub-modules:
  - reachability : publish-time reachability lint (pure function, HARNESS-07)
  - programmatic : closed PROGRAMMATIC_PHASE_REGISTRY + split_topic (Plan 03)
  - phase_types  : the 5 phase-type executors; importing it registers them into
                   the engine's PHASE_TYPE_REGISTRY dispatch seam (Plan 03).

The engine itself lives one level up at ``app.services.harness_engine`` (mirrors
the existing flat service layout — ``app.services.*_service``).
"""

from __future__ import annotations

from .reachability import LintError, lint_workflow, parse_skip_target

# Importing phase_types runs its module-level register_all(), populating the
# engine's PHASE_TYPE_REGISTRY with the 5 real executors. Kept last so the
# pure-function reachability surface above stays import-light.
from . import phase_types  # noqa: E402,F401

__all__ = ["LintError", "lint_workflow", "parse_skip_target", "phase_types"]
