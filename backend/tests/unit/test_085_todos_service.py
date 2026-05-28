"""Phase 085 Plan 01 — todos_service unit tests.

Wave 0 scaffold: this file starts as a smoke import test that will fail until
Task 2 creates todos_service.py. After Task 2, the 6 behavior tests below cover:
  1. replace_todos empty list — DELETEs and returns {"accepted": 0, "version": <int>}
  2. replace_todos happy path — inserts N todos, returns {"accepted": N, ...}
  3. full-state-replace — second call with fewer rows shrinks the canonical set
  4. transactional atomicity — INSERT failure rolls back the DELETE
  5. insert_run accepts parent_run_id kwarg
  6. insert_run backward compat (parent_run_id default None still works)
"""
from __future__ import annotations

import pytest


def test_module_imports():
    """Smoke: todos_service module exists and exports replace_todos."""
    from app.services import todos_service
    assert hasattr(todos_service, "replace_todos")
