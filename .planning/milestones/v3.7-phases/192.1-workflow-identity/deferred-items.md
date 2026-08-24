# Phase 192.1 — deferred items

Out-of-scope discoveries logged during execution. Per the executor SCOPE BOUNDARY rule these
are **not** fixed by the plan that found them.

---

## DEF-192.1-01 — `test_published_workflows_list_endpoint` is RED at HEAD (pre-existing)

**Found during:** plan `192.1-01`, Task 1 (backend `updated_at` projection).
**File:** `backend/tests/test_dual_mode_wiring.py:262-281`
**Status at base commit `8fc9bd74`:** already failing, before this plan changed anything.

The test asserts the `/workflows/published` response body is EXACTLY `id` + `slug` + `name`:

```python
assert body == [
    {"id": str(wf_id), "slug": "research_summarize", "name": "Research -> Summarize"}
]
```

Phase 192 added `definition`, `is_mine` and `is_system_global` to `PublishedWorkflow` and did
not update this expectation, so the assertion has been diverged since 192 shipped. Measured at
the base commit, BEFORE any edit in this plan:

```
FAILED tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint
At index 0 diff: {'id': …, 'slug': …, 'name': …, 'definition': None,
                  'is_mine': False, 'is_system_global': False}
              != {'id': …, 'slug': …, 'name': …}
1 failed, 1 passed, 51 deselected
```

**What this plan changed about it:** nothing structural — `updated_at: None` becomes a fourth
key in the actual dict. The test fails for the identical reason and in the identical way; it
was not made red by this plan and is not made green by it.

**Why it is not fixed here.** It sits in `backend/tests/test_dual_mode_wiring.py`, which is
outside this plan's `files_modified`, outside the plan's verification scope
(`tests/unit/ -k workflow`), and is a pre-existing failure in an unrelated file — exactly the
case the SCOPE BOUNDARY rule names. Repairing another plan's stale expectation from inside a
wave-1 worktree also risks colliding with a sibling agent editing the same file.

**Re-open trigger / suggested fix:** the next phase that touches
`backend/tests/test_dual_mode_wiring.py` replaces the exact-equality assertion with a subset
assertion over the three fields the test actually cares about (`id` / `slug` / `name`), so the
case stops re-breaking every time `PublishedWorkflow` legitimately gains an additive field. It
has now re-broken twice for that reason (192's two ownership bits, 192.1's one timestamp),
which is the signal that the assertion shape — not the model — is the defect.

**Sizing:** ~3 lines in 1 file, no schema and no API surface → `/gsd:fast` under G-3.
