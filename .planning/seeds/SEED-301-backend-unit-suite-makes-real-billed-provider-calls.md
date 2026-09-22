---
seed_id: SEED-301
title: The backend unit suite makes real, billed provider calls — and one test asserts on the model's output
created: 2026-09-19
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase that touches `backend/tests/conftest.py`, adds a unit test that reaches a provider path, moves the backend unit baseline ceiling, or proposes running `pytest tests/unit` in CI.
trigger_paths: ["backend/tests/conftest.py", "backend/tests/unit/test_email_ingestion.py", "backend/app/services/ingest_enrich.py", "backend/app/services/forced_emit.py", ".github/workflows/**"]
trigger_surfaces: ["ingestion", "provider", "deployment"]
migration_note:
relates_to: ["backend/tests/conftest.py:12", "backend/tests/unit/test_email_ingestion.py:242", "backend/app/services/ingest_enrich.py:263", "backend/app/services/forced_emit.py:487", "Phase 256 wave 1 post-merge gate"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-301: The backend unit suite makes real, billed provider calls

## The finding

`backend/tests/unit/test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`
makes **two real `POST https://api.openai.com/v1/chat/completions` calls on every run** and then
asserts on what the model returned:

```
backend/tests/unit/test_email_ingestion.py:242
    assert final_meta["title"] == "Client Deliverable Signed"
E   AssertionError: assert 'Subject: Cli...erable Signed' == 'Client Deliverable Signed'
```

Measured with `--log-cli-level=INFO` on the single test, nothing else running:

```
INFO httpx: HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 200 OK"
INFO app.services.forced_emit:forced_emit.py:487 forced_emit: emit_rung=non_strict_force emit_tier=force_strict provider=openai
```

⭐ **It is NOT order-dependent and it is NOT caused by any code change.** Four consecutive runs of
that ONE test, in isolation, at one commit (`0bb517072`): **pass · pass · FAIL · pass**. Four at its
parent commit (`902701e89`): **pass · pass · pass · pass**. Same test, same tree, different verdicts
— the variable is the model's output, not the repository.

The enabling condition is in the shared fixture:

```python
backend/tests/conftest.py:12
os.environ.setdefault("LLM_API_KEY", "test-llm-api-key")
```

`setdefault` — so a real key already in the environment **wins**, and `backend/.env` supplies one.
There is no network guard anywhere in `backend/tests/`: nothing blocks sockets, nothing asserts that
a unit test made no outbound request. Any unit test whose code path reaches a provider will make a
real billed call and nobody will be told.

## Why it matters

Three separate costs, and the third is the one that bites quietly:

1. **Money.** Every `pytest tests/unit` run spends the operator's OpenAI credit. The canonical gate
   is run many times per phase, by every executor, in every worktree.
2. **CI is not safely runnable.** `pytest tests/unit` in GitHub Actions would either need the real
   key (billed, and a secret in a runner) or would fail differently than it does locally — which is
   part of why `backend-tests` CI has never been green.
3. ⛔ **The locked baseline is not reproducible by construction.** CLAUDE.md pins the gate at
   *"71 failed … zero headroom"* and tells every agent to diff the failing SET. But this test can
   join or leave that set on a coin flip, so a phase can read **72** with a clean diff and spend an
   hour proving its own innocence. Phase 256's wave-1 post-merge gate did exactly that: two full-suite
   runs read `72 failed`, and the extra name was this one. The source change was proven clean by a
   separate run with the phase's five new test FILES removed — `71 failed`, metering changes all in
   place.

## When to surface

Any phase that touches `backend/tests/conftest.py`; any phase that adds a unit test reaching a
provider path; any proposal to move the 71-name baseline ceiling; any phase that wires
`pytest tests/unit` into CI.

⚠ **The ceiling must not be raised to 72 to absorb this.** That would pin a coin flip as a constant
and make the gate unable to fail honestly. The fix is to stop the call, not to budget for it.

## Scope estimate

**Small for the symptom, Medium for the class.**

- *Small:* patch the metadata-extraction LLM call inside `test_email_ingestion.py` so the test
  asserts on the email-header path it actually names (`ingest_enrich.py:263` —
  `if parsed_email.subject and not metadata_dict.get("title")`). One file, no product change.
- *Medium:* an autouse fixture in `backend/tests/conftest.py` that fails any unit test making an
  outbound socket connection, plus a deliberate allowlist. This is the one that closes the class —
  and it must be driven RED against a planted live call, or it is a guard nobody has seen fire.
  ⚠ It may turn other tests red; that is the point, and each one is a finding.

## Breadcrumbs

- Phase 256, wave 1 post-merge gate, 2026-09-19. Orchestrator transcript.
- Full suite at merged HEAD: `72 failed, 4947 passed` — twice, same extra name.
- Full suite at merged HEAD minus the five `test_256_*` files: **`71 failed, 4349 passed`**, source
  changes present. This is what proves the metering change innocent.
- Full suite at base `902701e89`: `71 failed, 4906 passed`; the email test not among the failures.
- Four single-test runs at HEAD: pass/pass/FAIL/pass. Four at base: pass ×4.
- ⚠ A trap worth not repeating: `grep -c 'api.openai.com'` over pytest output reads **0** for a
  passing run, because pytest only prints captured logs for FAILING tests. The call is made either
  way. Do not read that zero as "no network".
