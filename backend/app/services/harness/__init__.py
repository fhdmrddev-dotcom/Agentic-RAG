"""Harness service package (Phase 091).

Sub-modules:
  - reachability   : publish-time reachability lint (pure function, HARNESS-07)
  - programmatic   : closed PROGRAMMATIC_PHASE_REGISTRY + split_topic (Plan 03)
  - phase_types    : the 5 phase-type executors; importing it registers them into
                     the engine's PHASE_TYPE_REGISTRY dispatch seam (Plan 03).
  - validator_kinds: the 5 library validation-gate kinds (Phase 102 / D-12);
                     importing it registers them into VALIDATOR_REGISTRY.

The engine itself lives one level up at ``app.services.harness_engine`` (mirrors
the existing flat service layout — ``app.services.*_service``).
"""

from __future__ import annotations

from .reachability import LintError, lint_workflow, parse_skip_target

# Importing phase_types runs its module-level register_all(), populating the
# engine's PHASE_TYPE_REGISTRY with the 5 real executors. Kept last so the
# pure-function reachability surface above stays import-light.
from . import phase_types  # noqa: E402,F401

# Phase 102 (D-12): importing validator_kinds registers the 5 library validation-gate
# kinds into VALIDATOR_REGISTRY by @register_validator side-effect — the same posture
# as phase_types above (side-effect registration at import time).
from . import validator_kinds  # noqa: E402,F401

__all__ = [
    "LintError",
    "lint_workflow",
    "parse_skip_target",
    "phase_types",
    "validator_kinds",
]
