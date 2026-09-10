---
phase: 239
plan: 12
subsystem: connectors / mcp source
tags: [security, mcp, fences, CR-01, CR-02, SEED-270]
requires: [239-02, 239-06, 239-08]
provides:
  - "a structural fence that fails when either MCP-source module reads a server-authored `description`"
affects:
  - backend/tests/unit/services/sources/test_239_mcp_source_adapter.py
tech-stack:
  added: []
  patterns: ["AST fence over a trust class, with a positive control planted as the defect actually looked"]
key-files:
  created: []
  modified:
    - backend/tests/unit/services/sources/test_239_mcp_source_adapter.py
decisions:
  - "D-239-12-01 — CR-01 and CR-02 were ALREADY FIXED at HEAD; the task premise was stale and is corrected rather than re-implemented"
  - "D-239-12-02 — CR-02 option (2), the allow-list of shapes, was the one already shipped; option (1) is NOT taken"
  - "D-239-12-03 — `description` joins `_HINT_KEYS`, accepting that neither fenced module may DISPLAY a description either"
metrics:
  duration: ~50m
  completed: 2026-09-10
---

# Phase 239 Plan 12: CR-01 / CR-02 — verified closed, and the one half nobody closed

Both CRITICALs were already fixed in the product at `fe6da7122`; what was still open was the
structural half of CR-02 — `description` was absent from the hint fence, so the fix was enforced
by a docstring and by nothing else.

## ⛔ The finding that came first: the task premise was stale

The brief, and `.planning/v4.0-MILESTONE-AUDIT.md` Gap 1 (escalated one hour before this plan
started, at `552314598`), both state that CR-01 and CR-02 are **open**. They are not, and have not
been since **2026-09-08 04:12** — commit `fe6da7122`, *"fix(239): a server may no longer choose
which of its tools we run (CR-01, CR-02)"*, which is an ancestor of the base SHA the brief names.

I established that by **driving the reviewer's own inputs against the shipped functions at
`f1367cdf4`**, not by reading the commit message:

```
--- CR-01: delete_file as read_tool through the boundary ---
REFUSED: source_tools.read_tool names 'delete_file', whose own name says it CHANGES something…
--- CR-01 positive control: read_file is still accepted ---
ACCEPTED (correct)
--- CR-02: hostile description (purge_documents + "Retrieve the contents of a file…") ---
None
--- CR-02 positive control: ordinary read_file/list_directory still bind ---
{'list_tool': 'list_directory', 'read_tool': 'read_file'}
```

⚠ **The audit made the same class of mistake the audit itself was written to catch, one level
up.** Its own correction commit says *"the scan asked whether a FILE was present and never opened
the review that was there"* — and then it opened the review and never opened the **code**. Reading
an artifact that says *"broken"* is not measuring the thing. SEED-270 again, third register.

I have added a dated correction beside Gap 1 rather than overwriting it, per this project's
convention: the prediction being wrong is the finding.

## What was actually still open, and what I did about it

CR-02's last paragraph asks for one more thing than the code fix:

> Also extend the `_hint_comparisons` fence in `test_239_mcp_source_adapter.py` to cover
> `connector_service.infer_source_tools`, so `description` gains the same structural treatment
> `annotations` has.

`fe6da7122` did something better for half of it — it **moved** the detector into `mcp_source.py`
(ME-05), which the fence already scans — and nothing at all for the other half: `_HINT_KEYS` held
`readonlyhint`, `annotations`, `destructivehint`, `idempotenthint`, `openworldhint` and **not
`description`**. So if the `f"{name} {description}"` haystack came back tomorrow, in either module,
every gate would stay green. The `infer_source_tools` docstring explains at length why the field is
not read; a docstring is not a guard, and **that is the entire content of SEED-270**.

### RED, driven against the shipped fence

```
_hint_comparisons('… description = str(item.get("description") or "") …')  ->  []
AssertionError: the hint fence cannot see a server-authored `description` being read
assert []
```

Committed as `46f598adf` before any fix existed.

The plant is **the shipped code as it actually looked**, restored from `fe6da7122^`, not a
paraphrase. ⚠ One honest limitation is written into the test body rather than left for a reader to
discover: the `f"{name} {description}"` line itself is invisible to an AST fence — inside an
f-string `description` is a `Name`, not a string constant. What the fence sees is the **fetch**
(`item.get("description")`, `item["description"]`, `k == "description"`), which is the entry point:
a server-authored field cannot decide anything without first being read out of the server's dict.

### GREEN

`1f84411db`. `description` joins `_HINT_KEYS`, and the scan runs over **two** modules —
`mcp_source.py` and `connector_service.py`. The second is load-bearing, not belt-and-braces: the
defect lived in `connector_service.py`, discovery still runs there
(`discover_connection_tools` writes `config["source_tools"]`), and a fence over only the file the
code was moved *into* goes green the moment it moves back out.

### Both arms driven RED against the REAL modules

Not only against a synthetic string:

```
# planted item.get("description") in mcp_source.py
AssertionError: app.services.sources.adapters.mcp_source branches on a field the REMOTE SERVER
authors: line 364: 'description', line 447: 'description'

# planted item["description"] in connector_service.py only
AssertionError: app.services.connector_service branches on a field the REMOTE SERVER authors:
line 418: 'description'
```

Both source files restored **md5-identical** (`md5sum -c` → `OK` on both, twice).

### Positive controls — all four fired

| Control | Result |
|---|---|
| `read_file` still accepted at the write boundary | ACCEPTED (correct) |
| `read_file` / `list_directory` still auto-bind | `{'list_tool': 'list_directory', 'read_tool': 'read_file'}` |
| fence does **not** fire on `filename` (a field the server does not author) | `[]` — negative control, so the fence is not just "reads a dict" |
| fence **does** fire on a planted read in each real module | red in both, independently |

⚠ The negative control is there deliberately because the opposite error — an assertion so strict it
would fail a correct implementation — is the one this session was warned about. `filename` comes off
a listing entry exactly as `description` comes off a tool descriptor; a fence that caught both would
be catching *"reads a dict"*, which was never in doubt.

## Which CR-02 option was taken, and why

**Option (2), the allow-list of shapes** — and it was already shipped, so this is a report rather
than a choice. `mcp_source.infer_source_tools` binds by exact known name or by **shape**: a
path-ish parameter present, **no** content-ish parameter (`_WRITE_PARAMS`), and the tool's own
**name** tokenising to a list-word or a read-word. A name this app cannot recognise binds nothing
and falls to the operator's picker, which is fail-closed.

**Option (1) — propose-then-confirm — is NOT taken, and that is a real residual.** Auto-binding
still writes to `config` on one press of *Refresh actions*, without a human confirming the value.
What changed is that a server can no longer *steer* that write with prose: it must publish a tool
whose **name** says it lists or reads and whose **schema** accepts no content. The remaining risk
is a hostile server naming a destructive tool `read_file` — irreducible at this layer, since that
string is also what a legitimate server calls its reader.

## The known cost of this change, stated rather than discovered later

`_hint_comparisons` cannot distinguish a **display** from a **decision**. So neither fenced module
may now read `description` even to show it to a person. `annotations` has always carried the same
cost in this file. If a future phase needs to surface what a server said about its own tool, it does
so **above** these two modules — the discovery cache already holds the raw list — or it adds a named
exemption with its reason in the test body. That instruction is written into `_HINT_KEYS` itself.

## Deviations from Plan

**1. [Rule 3 — blocking] The work the brief asked for was already done.**
- **Found during:** the first read of `connector_service.py`, whose docstrings already cited
  *"review CR-01"*.
- **Action:** did not re-implement. Drove the reviewer's inputs to establish the true state, then
  scoped to the one prescription genuinely unclosed. Re-implementing a shipped fix would have been
  a same-file conflict for no behaviour change.
- **Files modified:** none beyond the fence.

**2. [Rule 2 — missing critical] The audit still asserts these CRITICALs are open.**
- Corrected in place, beside the original, dated. A false CRITICAL left standing costs the next
  agent a whole session — it cost this one most of a run.

## Out of scope — noted, not fixed

Per the brief, 239's High / Medium / Low findings were not touched. Spot-checked while establishing
the baseline, and they appear to have been discharged by plans `239-04` … `239-11`: **HI-01**
(`PROTOCOL_SERVICE_IDS` narrowing in `sourceCapability.ts`), **HI-02** (`sourceToolsFromDraft` now
called from both `configFromDraft` arms), **HI-03**, **HI-04**, **ME-02**, **ME-03**, **ME-04**,
**ME-05** (`TOOL_FENCED_MODULES` covers `connector_service.py`), **LO-04**, **LO-06** all have
behavioural cases in the suites. ⚠ **Spot-checked, not verified** — stated as an observation, in the
same spirit as the finding above: I read the code, I did not drive each one.

## Known Stubs

None.

## Threat Flags

None. No new network surface, no schema change, no new endpoint. The change is a test-only fence
that narrows what the two existing modules are permitted to read.

## Gates

| Gate | Before | After |
|---|---|---|
| `pytest tests/unit -q --continue-on-collection-errors` | 71 failed / 4515 passed / 2 xfailed / 2 xpassed | **71 failed / 4517 passed / 2 xfailed / 2 xpassed** |
| failing SET | 24 distinct files | **identical** — 0 failures in any file this plan touched; `+2` passed is exactly the two new cases |
| `pytest tests/unit/services/sources tests/unit/test_239_*` | 400 passed | **402 passed** |
| `tsc -p tsconfig.app.json --noEmit` | 67 errors | **67 errors** — set-diff empty; **zero frontend files modified** |

⚠ `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` was **NOT** run, deliberately and
recorded as a decision rather than an omission: this plan modifies **no frontend file** (`git diff
--numstat` over both commits names one backend test file), the gate is RED at base on
provably-unmodified SEED-171 flakes, and a ~10-minute red run would have produced no information
about this change. The typecheck figure above is the frontend measurement that is actually
informative.

⚠ `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery` — the known flake
— did **not** fail on this run and is absent from the failing set.

## Commits

| Commit | Gate | What |
|---|---|---|
| `46f598adf` | RED | the fence cannot see a server-authored `description` — `assert []` |
| `1f84411db` | GREEN | `description` joins `_HINT_KEYS`; the scan covers both modules |

## Self-Check: PASSED
