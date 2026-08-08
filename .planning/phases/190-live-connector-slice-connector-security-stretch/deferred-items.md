# Phase 190 — Deferred Items

Out-of-scope discoveries made during execution. Append-only; each entry names a concrete
re-open trigger, per the standing project rule.

---

## D-190-DEF-01 — `.planning/STATE.md` frontmatter is not valid YAML, and was not before this phase

**Found during:** plan 190-01, while hand-repairing STATE.md after the SDK verbs corrupted it.

**Measured, not assumed.** The frontmatter fails `yaml.safe_load` at **HEAD**, before this plan
touched anything:

```
HEAD frontmatter ALREADY BROKEN: ScannerError mapping values are not allowed here
  in "<unicode string>", line 6, column 331:
     ... d by MEASUREMENT, not preference: **a remote MCP server makes th ...
```

**Cause:** several long narrative values (`last_activity`, `stopped_at`) are *unquoted* scalars
containing `: ` sequences, and the `### Previous stopped_at …` narrative blocks sit **between**
the `---` fences. YAML reads the embedded colons as mapping separators.

**Why it is not fixed here:** pre-existing, unrelated to this plan's three test files, and
repairing it means re-quoting several multi-thousand-character values in a file that six SDK
verbs are already known to rewrite destructively. That is its own change with its own blast
radius, not a line item inside a security gate.

**Consequence to be aware of:** any tool that parses this frontmatter with a real YAML parser is
either failing silently or falling back to a regex. That is a plausible contributor to the
recurring corruption — a writer that cannot parse the file it is editing will not preserve it.

**Re-open trigger:** the next time an SDK state verb corrupts `STATE.md` (it has now done so at
189-16, 190-planning and 190-01), or the first time a consumer of this frontmatter is observed
reading a wrong value. Fix as its own `/gsd:fast`, not inside a feature phase.

---

## D-190-DEF-02 — `CONN-03` deliberately NOT marked complete by plan 190-01

**Found during:** plan 190-01 state updates.

`190-01-PLAN.md` frontmatter carries `requirements: [CONN-03]`, and the executor protocol marks
those complete at plan end. **It was not marked, on purpose.**

CONN-03 requires an unconditional SSRF/egress guard, org-scoped Fernet-encrypted credentials
resolved server-side by reference, sandboxed template evaluation, a cross-org credential-leak
test, **and** `/gsd:secure-phase` with `threats_open: 0`. Plan 190-01 delivered the **drives** for
one of those and nothing else — no `egress.py`, no `connector_service.py`, no adapters, no
migrations. Checking the box now would assert a security property that does not exist, in the
one phase whose entire discipline is not over-claiming (D-31), and it is precisely the
false-completion class this plan's own RED observations exist to prevent.

This also matches the shipped project practice recorded in STATE.md for Phase 184:
*"REQUIREMENTS.md is deliberately untouched and the orchestrator marks them at phase end after
live verification."*

**Re-open trigger:** phase close — `/gsd:verify-work 190` + `/gsd:secure-phase 190` returning
`threats_open: 0`. CONN-02 and CONN-03 are marked together, then, by the orchestrator.

---

## D-190-DEF-03 — `graphify update .` not run for this plan

**Found during:** plan 190-01 close.

CLAUDE.md asks for `graphify update .` after modifying code files. This plan modified **test
files only** and its `files_modified` contract names exactly three of them; regenerating
`graphify-out/` would put a large unrelated artefact inside a security-gate commit, and
test-only changes alter no architecture the graph indexes.

**Re-open trigger:** the first plan in Phase 190 that lands production source — `190-02`
(`backend/app/security/egress.py`) is the expected one. Run it there.

---

## D-190-DEF-04 — `backend/tests/test_dual_mode_wiring.py` is ROTTED, 15 failures, all pre-existing

**Found during:** plan 190-03, while checking every consumer of the audit vocabulary after
migration 117 widened it.

**Measured, and explicitly NOT caused by this plan.** `pytest tests/test_dual_mode_wiring.py -q`
reports **15 failed, 38 passed**. The failure-reason histogram is
`32 AttributeError · 8 KeyError · 3 AssertionError · 2 ConnectError`, and the dominant one is:

```
AttributeError: <module 'app.api.threads'> does not have the attribute 'insert_run'
httpx.ConnectError: [Errno 11001] getaddrinfo failed
```

`insert_run` moved out of `threads.py` during the **Phase 162.5** extraction (2444 → 1204 lines);
the file still `monkeypatch`es it by name. The two `ConnectError`s are tests that reach the real
network from a machine with no DNS answer for the host.

**Proof this plan did not cause it:** the four tests in that file that DO touch the audit
vocabulary are green — `pytest tests/test_dual_mode_wiring.py -k "audit or event_type"` →
**4 passed, 49 deselected**. The file references `_AUDIT_EVENT_TYPES` exactly once, in a
docstring at `:214`, and pins no count. The two tests that DID pin a count
(`test_harness_audit_102.py:65`, `test_harness_audit_emit.py:60`) were caused by this plan, were
observed RED, and were fixed in commit `0e5a62a9` under deviation Rule 3 — they are not deferred.

**Why it is not fixed here:** out of scope by the executor's own scope boundary (a pre-existing
failure in an unrelated file), and re-pointing 32 monkeypatches at the post-162.5 seams is its own
change with its own blast radius. It also matches the recorded project finding that the backend
suite is not a regression backstop.

**Re-open trigger:** the first plan that needs `test_dual_mode_wiring.py` as evidence for a claim
— or `/gsd:verify-work 190`, if the verifier tries to read a whole-suite number from it. Fix as
its own `/gsd:fast` (re-point the `insert_run` monkeypatches; mark the two network-reaching tests).
