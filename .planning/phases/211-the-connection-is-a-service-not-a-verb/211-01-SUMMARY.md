---
phase: 211-the-connection-is-a-service-not-a-verb
plan: 01
subsystem: api
tags: [connectors, mcp, json-schema, closed-set, allow-list, fences]

requires:
  - phase: 190-connector-adapters
    provides: "the three first-party adapters, each carrying CAPABILITY + INPUT_SCHEMA as frozen class attributes, and the lazy capability->adapter registry"
  - phase: 206-mcp-connections
    provides: "the MCP tool sanitizer and the `discovered_tools` jsonb shape every downstream reader was written against"
  - phase: 209-readonly-hints
    provides: "the `annotations` passthrough — the shape this plan's two new keys copy"
provides:
  - "`connectors/descriptors.py` — the static tool descriptor for a first-party capability connection, byte-compatible with a sanitized discovered tool"
  - "`descriptor_for(capability)` and `static_descriptors_for_capability(capability)` (the one-element list form `discovered_tools` actually holds)"
  - "a sanitizer that forwards `title` and `outputSchema` while still dropping every key nobody named"
  - "the first executable guard over migration 116's SQL `CHECK (capability IN (...))`"
  - "one file enumerating all seven backend spellings of the closed capability set"
affects: [211-02, 211-03, 211-04, 211-05, 212, 214]

tech-stack:
  added: []
  patterns:
    - "A descriptor DERIVES its schema from the adapter's own INPUT_SCHEMA rather than retyping it — D-211-06 satisfied by construction, so there is nothing to keep in sync"
    - "A cross-language fence falsifies its extractor on synthetic input BEFORE reading the real file, and distinguishes 'matched nothing' (None) from 'matched an empty set'"
    - "An allow-list is WIDENED key by key and never inverted into a deny-list; the emitted object stays an explicit dict literal"

key-files:
  created:
    - backend/app/services/connectors/descriptors.py
    - backend/tests/unit/test_211_static_descriptors.py
    - backend/tests/unit/test_211_closed_set_agreement.py
  modified:
    - backend/app/services/mcp_client.py
    - backend/tests/unit/test_mcp_connector_client.py
    - backend/tests/unit/test_190_connector_source_fence.py

key-decisions:
  - "`required` is never retyped — it arrives inside `inputSchema` because `inputSchema` IS the adapter's own declaration (RESEARCH §I). No REQUIRED_ARGS constant exists anywhere."
  - "The registry import in `descriptors.py` sits in the function body, and the file is pinned into `test_190`'s function-local importer set deliberately, in answer to that assertion's own instruction."
  - "`title` is coerced with `str(...).strip()` and contributes NO key when blank/non-string; `outputSchema` is forwarded only as a dict and is NEVER defaulted — the spec makes it optional while `inputSchema` is mandatory."
  - "`annotations` is untouched. D-211-10 permits carrying it and forbids depending on it; no read-ness or direction decision is taken from it here."
  - "No closed-set spelling was edited. `models/harness.py`'s `capability` annotation is byte-unchanged, proved by `git diff --numstat` printing nothing."

patterns-established:
  - "Descriptor-by-derivation: an advertisement of an action is computed from the thing that performs it, so it cannot advertise an argument the adapter refuses or hide one it requires"
  - "Enumerate-then-assert: a drift in one of N spellings reports as 'this spelling disagreed' rather than as an AssertionError that takes the whole suite down"

requirements-completed: [CONN-04, CONN-05]

duration: 41min
completed: 2026-08-26
---

# Phase 211 Plan 01: Static Descriptors + a Two-Key-Wider Sanitizer Summary

**A first-party capability connection can now advertise its one action in the exact JSON shape an MCP-discovered tool arrives in — schema derived from the adapter, never retyped — and migration 116's SQL `CHECK` is, for the first time since Phase 190, held by something executable.**

## Performance

- **Duration:** ~41 min
- **Tasks:** 3 / 3
- **Files created:** 3 · **Files modified:** 3
- **Commits:** 3

## Accomplishments

### Task 1 — `connectors/descriptors.py` (commit `4f414f2d`)

`descriptor_for(capability)` returns exactly four keys in the sanitizer's own order and casing —
`name` / `title` / `description` / `inputSchema` — and `static_descriptors_for_capability` returns
the one-element list form, because `discovered_tools` is a JSON array and every downstream reader
iterates it.

- `inputSchema` is a plain, JSON-serialisable **deep copy** of the adapter's own `INPUT_SCHEMA`,
  obtained through `registry.get_adapter`. Every nested `MappingProxyType` is converted; the round
  trip is asserted at the point of production rather than at the first `jsonb` write in plan 02.
- `title` and `description` are the only authored values, held by **two derived module-scope
  asserts** in the shape of `registry.py`'s D-04 assert. A fourth key, or a missing one, is an
  `AssertionError` at import.
- The registry import is **function-body only**. `grep -vE '^\s*#' … | grep -c "^from app.services.connectors.registry import"` → `0`.
- `grep -c "REQUIRED_ARGS" backend/app/services/connectors/descriptors.py` → `0`.

Acceptance probe, verbatim:

```
$ ./venv/Scripts/python.exe -c "import json, app.services.connectors.descriptors as d; print(json.dumps(d.static_descriptors_for_capability('send_email')))"
[{"name": "send_email", "title": "Send email", "description": "Send one plain-text email to exactly one recipient through this connection's configured mail server.", "inputSchema": {"type": "object", "additionalProperties": false, "required": ["to", "subject", "body"], "properties": {"to": {…}, "subject": {…}, "body": {…}}}}]
```

### Task 2 — the sanitizer, widened by exactly two keys (commit `4bf1142f`)

The emitted object stays an **explicit per-key dict literal**. No spread, no comprehension over the
server's keys, no deny-list vocabulary (`grep -c "deny\|blocklist\|blacklist" backend/app/services/mcp_client.py` → `0`).

`test_mcp_connector_client.py` went **21 → 41 cases**. Direct probe of the acceptance shape:

```
$ raw = {"name":"t","title":"T","outputSchema":{"type":"object"},"_meta":1,"execute":"x","__proto__":{}}
['description', 'inputSchema', 'name', 'outputSchema', 'title']
```

### Task 3 — the seven spellings, and the SQL hole (commit `bf06a2b1`)

`test_211_closed_set_agreement.py` — 12 cases. One per Python spelling, plus the disjointness
invariant, plus D-14's seven-executor red line, plus the descriptor names, plus **the migration-116
SQL `CHECK` extractor**, which is the only NEW guarantee in the file.

## Verbatim evidence (required by the plan's `<output>`)

### 1 · RED-first run of `test_211_static_descriptors.py`, before `descriptors.py` existed

```
ImportError while importing test module '…\backend\tests\unit\test_211_static_descriptors.py'.
Traceback:
C:\Python312\Lib\importlib\__init__.py:90: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
tests\unit\test_211_static_descriptors.py:32: in <module>
    from app.services.connectors.descriptors import (
E   ModuleNotFoundError: No module named 'app.services.connectors.descriptors'
=========================== short test summary info ===========================
ERROR tests/unit/test_211_static_descriptors.py
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 warning, 1 error in 3.51s
```

After the module landed: **27 passed**.

### 2 · RED run of the off-list-key drop case, taken before the widening landed

```
>       assert set(tools[0]) == {"name", "description", "inputSchema", "title", "outputSchema"}, (
E       AssertionError: the sanitizer emitted ['description', 'inputSchema', 'name']. The emitted
E       object is an explicit per-key dict literal and must stay one: widening it to a spread minus
E       a deny-list would carry every key a server invents, and the whole value of this function is
E       that a key nobody named cannot reach jsonb
E       assert {'description...hema', 'name'} == {'description...ema', 'title'}
E         Extra items in the right set:
E         'outputSchema'
E         'title'
tests\unit\test_mcp_connector_client.py:963: AssertionError
1 failed, 1 warning in 0.84s
```

The whole-file RED at that moment was `6 failed, 35 passed`; after the widening, `41 passed`.

⚠ **AN HONEST QUALIFICATION OF WHAT THAT RED PROVES.** The three off-list keys (`_meta`, `execute`,
`__proto__`) were **already** being dropped before the widening — the sanitizer was already an
allow-list. So the RED above is not evidence that the drop was broken; it is evidence that the
assertion is **sensitive to the emitted key set**, which is the property that makes it a real fence
after the widening. Asserting on the whole key set rather than on three individual absences is what
makes it catch an invented fourth key too. Stating this rather than letting the RED imply more than
it shows.

### 3 · `test_a_capability_outside_the_closed_set_is_refused` — OBSERVED GREEN, not assumed

```
$ ./venv/Scripts/python.exe -m pytest "tests/unit/test_189_external_action_model.py::test_a_capability_outside_the_closed_set_is_refused" -q
.                                                                        [100%]
1 passed, 1 warning in 0.15s
```

And the file it guards is byte-unchanged:

```
$ git diff --numstat backend/app/models/harness.py backend/app/services/harness/phase_types.py \
                    backend/app/services/harness/grounding.py backend/app/models/connector.py \
                    backend/tests/unit/test_189_external_action_model.py
(no output)
```

### 4 · The SQL extractor, driven against real / planted / dropped / removed input

The control inside the test falsifies the extractor on synthetic input before the real file is read.
Additionally driven by hand against the live migration, to prove it READS rather than guesses:

```
REAL                  -> ['create_ticket', 'post_message', 'send_email']
PLANTED (one member changed to 'wire_transfer')
                      -> ['create_ticket', 'send_email', 'wire_transfer']
DROPPED ONE ('post_message' line deleted)
                      -> ['create_ticket', 'send_email']
CLAUSE FULLY REMOVED  -> None      # distinct from set(), and asserted separately
```

⚠ **A first probe of mine was a bad probe and is recorded because it looked like a regex flaw.**
Replacing only the word `CHECK` left ` (capability IN (` intact on the same line, so the extractor
still matched — correctly. The migration file itself was never modified; all four rows above were
produced against in-memory copies.

### 5 · Backend unit suite vs the 68-failure rot baseline

```
68 failed, 2749 passed, 2 xfailed, 2 xpassed, 32 warnings in 97.55s (0:01:37)
```

| | `211-MEASUREMENTS.md` §1 baseline | measured at this plan's close |
|---|---|---|
| failed | **68** | **68** |
| passed | 2680 | **2749** |

**`failed` is identical, and no NEW failing file appeared.** Every failing file is in the known rot
families named in the measurement pack (`retrieval_service` 15, `sql_service` 12, `reembed_kickoff`
4, `sandbox_service` 3, `streaming_reliability` 1, plus the unattributed growth) — and none of this
plan's six files is among them.

⚠ **THE `passed` DELTA IS `+69` AND THIS PLAN ACCOUNTS FOR ONLY `+59`. The residual `+10` is
recorded rather than absorbed.** Derived, not estimated: `pytest --collect-only` reads **2821**, and
**2782** with this plan's two new files ignored — a difference of exactly `39` (`27` descriptors +
`12` closed-set), plus the `20` cases added to `test_mcp_connector_client.py` (21 → 41) = `59`. The
remaining `+10` predates this plan: the five commits between the measurement pack and this plan's
base (`5f2c7d8c`) are all planning docs and touch no test file, so the baseline's `2680` was
captured against a slightly different tree than `5f2c7d8c`. It is `passed` cases, not failures, and
it is named here so nobody later quotes `2749` as this plan's arithmetic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `test_190_connector_source_fence.py` had to be edited; it is not in `files_modified`**

- **Found during:** Task 1
- **Issue:** the fence pins the FILES holding a function-local registry import to an exact list, and
  a new one makes it RED. Observed verbatim:
  ```
  E AssertionError: the connector registry now has function-local importers in unexpected files:
    ['app/api/connectors.py:546', 'app/services/connectors/descriptors.py:160'] … but pin the new
    file here deliberately rather than letting the set drift.
  ```
- **Fix:** pinned `app/services/connectors/descriptors.py` into that list, and added `descriptors.py`
  to `_EXPECTED_MODULES` so the D-05 transport walk is known to visit it. Both are additions; nothing
  was loosened. **This is the fence working** — it fired in the commit that added the import and it
  asked, in its own words, for exactly this.
- **Files modified:** `backend/tests/unit/test_190_connector_source_fence.py`
- **Commit:** `4f414f2d`

**2. [Rule 1 — Bug] The deny-list source fence I wrote was falsified by its own control**

- **Found during:** Task 2
- **Issue:** `\b(deny|denylist|blocklist|blacklist)\b` does **not** match `_DENYLIST` — `_` is a word
  character, so no `\b` exists between `_` and `DENY`, and the single most likely spelling of the
  thing being fenced slipped straight past. Observed verbatim:
  ```
  E AssertionError: the deny-list matcher does not fire on a real deny-list declaration, so the
    walk below would report green against the very refactor it exists to catch
  E assert None
  ```
- **Fix:** matcher corrected to `(?i)(deny.{0,2}list|blocklist|blacklist)`. **The control was kept
  byte-identical and only the matcher moved**, and the original wrong matcher is recorded in a
  comment above it — a fence that had shipped without its control would have been dead on arrival.
- **Files modified:** `backend/tests/unit/test_mcp_connector_client.py`
- **Commit:** `4bf1142f`

### Explicitly NOT done

- **No closed-set spelling was edited**, in any file — proved by `git diff --numstat` printing
  nothing for all four (§3 above). `phase_types.py` was read-only throughout; no lock was taken on
  it and nothing was written to it, so Phase 210's open `BUS-008` is untouched.
- **`annotations` is unchanged.** No read-ness or direction decision is taken from it.
- **Nothing was "wired up".** A descriptor grants nothing: the executor's gate reads `tool_grants`
  only and a missing key DENIES (T-211-05). That asymmetry is the desirable direction and is stated
  in the module docstring so nobody closes it by accident.
- **No package was installed** (T-211-SC). No install task, no legitimacy checkpoint owed.

## Known Stubs

None. Every value this plan produces is derived from or authored against a live source; nothing
returns a hardcoded empty list, a placeholder string, or a `TODO`.

## Threat Flags

None. This plan opens no endpoint, adds no auth path, touches no file access and changes no schema.
The one trust-boundary change — the sanitizer's key set — is *narrowing-preserving*: two named keys
were added to an allow-list that still drops everything unnamed, proved by
`test_the_sanitizer_drops_every_key_nobody_named` and by a source-level fence that refuses deny-list
vocabulary outright.

## What the next plan inherits

- `static_descriptors_for_capability(capability)` returns exactly what plan **211-02** needs to write
  into `discovered_tools`, already proved `json.dumps`-safe.
- The sanitizer now emits `title`, which **211-03 / 212** can use as a catalog label — and which is
  **absent rather than empty** when the server sent nothing, so a `name` fallback stays reachable.
- ⚠ **RESEARCH §A.6's eighth reader is still unaddressed and is NOT this plan's to fix:**
  `McpToolPicker.tsx:302` early-returns on `!connection?.mcp_server_url`, so a legacy connection
  carrying a perfectly-shaped `discovered_tools` list renders **no tool picker at all**. Writing
  descriptors does not by itself make SC#2 true.

## Self-Check: PASSED

Files claimed created — all present:

- `backend/app/services/connectors/descriptors.py` — FOUND
- `backend/tests/unit/test_211_static_descriptors.py` — FOUND
- `backend/tests/unit/test_211_closed_set_agreement.py` — FOUND

Commits claimed — all present in `git log`:

- `4f414f2d` — FOUND
- `4bf1142f` — FOUND
- `bf06a2b1` — FOUND
