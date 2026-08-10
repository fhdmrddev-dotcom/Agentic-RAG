---
phase: 190-live-connector-slice-connector-security-stretch
plan: 02
subsystem: backend-security
tags: [ssrf, egress, ipaddress, dns, security, conn-03, red-first, falsification]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 01
    provides: "the W0-3 ordering drive whose import contract (EgressRefused with reason_code + host) this plan satisfies"
provides:
  - "backend/app/security/egress.py — the SINGLE home of connector destination validation (D-05), sibling to secret_cipher.py"
  - "refuse_reason(ip) -> str | None — the auditable address predicate, driven 29/29"
  - "validate_destination(capability, url_or_host, port=None, *, allowed_host=None, resolver=None) -> PinnedDestination — the ordered guard (D-07)"
  - "EgressRefused — keyword-only, no **kwargs, reason_code validated against the closed table at RAISE time (D-08)"
  - "REFUSAL_REASONS — UI-SPEC §4c's closed six-code table, asserted at import"
  - "PinnedDestination(ip, hostname, port, scheme) — the triple both 190-07 binders consume"
  - "backend/tests/unit/test_190_egress.py — the 29-address corpus, the label-boundary + parsed-host + scheme tables, 71 tests"
  - "SIX driven falsifications in production source, each observed RED individually"
affects: [190-07, 190-13, 190-connector-service, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unwrap-then-test address validation: peel every IPv4-embedding form CPython does not peel, THEN apply the property"
    - "A clause can be load-bearing for the AUDITED ADDRESS rather than for the verdict — and that is still a security property under D-08"
    - "Falsification by clause deletion in production source, restored byte-identical, measured with a LINE-ENDING-STABLE hash"
    - "An injectable resolver seam, because a resolve step exercisable only against the live internet is untested in CI"
    - "Closed-table enforcement at RAISE time, not merely at declaration"

key-files:
  created:
    - backend/app/security/egress.py
    - backend/tests/unit/test_190_egress.py
  modified: []

key-decisions:
  - "The plan's PLANT-1 expectation is FALSE and was corrected by measurement: CPython's IPv6Address.is_global ALREADY unwraps IPv4-mapped, so deleting the ipv4_mapped clause does not flip ::ffff:127.0.0.1 to allow"
  - "The corpus's 29th address is ::ffff:224.0.0.1 — the plan enumerated 28 and required 29, and this is the only measured address that flips REFUSE->allow without the ipv4_mapped clause"
  - "A bare md5 over the working file is NOT a valid identity measure on this platform: git checkout restores CRLF. The LF-normalised md5 and git-blob hash are"
  - "TLS is STATED, never assumed — a destination with no scheme is refused (scheme_not_tls) for every capability"
  - "An unknown capability fails closed at step 0, before the scheme check, with host_not_allowed"
  - "validate_destination takes an injectable resolver keyword-only, with a stdlib default; production callers never pass it"
  - "PinnedDestination added to __all__ as a 7th name — it is the return type, and the public contract is unstateable without it"

patterns-established:
  - "Every clause of a security predicate carries a driven case AND names it in the failure text, so a deleted clause names itself"
  - "A source-reading fence extracts CODE via ast.unparse, never by splitting on '#' — a docstring is a string literal, not a comment"
  - "A recorded RED transcript is frozen once the observation is past; later drift is STATED, never retro-fitted"

requirements-completed: [CONN-03]

# Metrics
duration: 55min
completed: 2026-08-08
---

# Phase 190 Plan 02: Egress Destination Validator Summary

**The connector egress guard now exists as one module beside `secret_cipher.py`, and it is defensible because of a 29-address corpus rather than because of its predicate — a claim proved by deleting each clause out of production source and watching the corpus name the missing clause, six times.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3
- **Files:** 2 created (`egress.py` 421 L · `test_190_egress.py` 616 L), **zero modified**
- **Suite:** `tests/unit/test_190_egress.py` — **71 passed, 0 failed**
- **Dependencies added:** none (`git diff --numstat backend/requirements.txt` → empty)

## Task Commits

1. **Task 1: author the 29-address corpus RED-first** — `d67bb34b` (test)
2. **Task 2: build the validator, drive the corpus green** — `36a2bb14` (feat)
3. **Task 3: six driven falsifications + the standing fence** — `388032b4` (test)

## The 29/29 result, INDEPENDENTLY REPRODUCED

RESEARCH §R14's figure was re-derived from scratch before any of it was trusted, in a
scratch probe outside the watched tree:

```
corpus size: 29
corrected predicate: 29/29
naive `not is_global` HOLES: [('224.0.0.1', True), ('fec0::1', True), ('::ffff:0:7f00:1', True),
                              ('64:ff9b::7f00:1', True), ('64:ff9b::a9fe:a9fe', True), ('ff02::1', True)]
```

**Six ADDRESSES across the FOUR hole classes** — §R14 counts classes, the probe counts
addresses, and the two agree. `is_global` answers `True` for every one of them.

## ⚠ THE PLAN'S OWN FALSIFICATION EXPECTATION WAS WRONG, AND IT WAS MEASURED

Plan Task 3 states: *"PLANT 1 — delete the `ipv4_mapped` clause. Expect `::ffff:127.0.0.1` and
`::ffff:169.254.169.254` to flip to allow."*

**They do not flip.** A per-clause disable probe was run BEFORE the test file was written,
rather than assuming the plan's expectation:

```
--- disable ipv4_mapped: 3 change(s)
       ('::ffff:127.0.0.1',      "reason '…(127.0.0.1)' -> '…(::ffff:7f00:1)'")
       ('::ffff:169.254.169.254', "reason '…(169.254.169.254)' -> '…(::ffff:a9fe:a9fe)'")
       ('::ffff:224.0.0.1', 'REFUSE->allow')
```

CPython's `IPv6Address.is_global` **already unwraps IPv4-mapped**, so the verdict survives.
What does not survive is (a) the **audited address** — the refusal would name `::ffff:7f00:1`,
which an operator cannot act on (D-08) — and (b) the **multicast** case, because `ff00::/8`
does not contain `::ffff:e000:1`. Two consequences, both carried into the artefact:

1. **The corpus's 29th address is `::ffff:224.0.0.1`.** The plan enumerates 28 addresses and
   then asserts `len(_IP_CORPUS) == 29`; the gap is closed with the one address measured to
   flip REFUSE→allow for this clause, not with filler.
2. **A new test exists that the plan did not ask for** —
   `test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper` — which makes the
   `ipv4_mapped`, `sixtofour` and `teredo` clauses individually falsifiable via the reason
   string. Without it, three of the five `_unwrap` clauses would have had **no** driven case.

The same probe showed `sixtofour` and `teredo` are load-bearing for the audited address only,
and that deleting `sixtofour` makes the guard *over*-refuse (`2002:0101:0101::1`, a 6to4
wrapper around public `1.1.1.1`, flips allow→REFUSE). Both facts are recorded at their clauses
in `egress.py` rather than left for the next reader to rediscover.

## THE SIX RED OBSERVATIONS (Task 3 — this plan's security evidence)

Each is a real deletion in **`backend/app/security/egress.py` itself**, never a copy, run as
plant → observe → `git checkout -- <file>`.

### PLANT 1 — the `ipv4_mapped` clause of `_unwrap` deleted → **3 failed, 67 passed**

```
E  AssertionError: ::ffff:224.0.0.1 was ALLOWED - the `ipv4_mapped` clause of _unwrap is
   missing or inert. This is one of the four holes RESEARCH §R14 measured in a bare
   `not ip.is_global`; the naive predicate reports is_global=True for it.
E  assert '127.0.0.1' in 'not globally routable (::ffff:7f00:1)'
FAILED tests/unit/test_190_egress.py::test_every_corpus_address_gets_the_right_verdict[::ffff:224.0.0.1]
FAILED tests/unit/test_190_egress.py::test_each_of_the_four_unwrap_clauses_is_load_bearing
FAILED tests/unit/test_190_egress.py::test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper
```

### PLANT 2 — the `_V4_TRANSLATED` membership branch deleted → **3 failed, 67 passed**

**THIS IS THE HOLE THAT WOULD HAVE SHIPPED** — `::ffff:0:0/96` (mapped) and `::ffff:0:0:0/96`
(translated) differ by one 16-bit group, and `ipv4_mapped` returns `None` for the second.

```
E  AssertionError: ::ffff:0:7f00:1 was ALLOWED but must be refused - IPv4-TRANSLATED (SIIT)
   - HOLE 3: ipv4_mapped returns None
E  AssertionError: ::ffff:0:7f00:1 was ALLOWED - the `_V4_TRANSLATED` membership branch of
   _unwrap is missing or inert. …the naive predicate reports is_global=True for it.
E  AssertionError: ::ffff:0:7f00:1 was allowed - _V4_TRANSLATED is gone
FAILED tests/unit/test_190_egress.py::test_every_corpus_address_gets_the_right_verdict[::ffff:0:7f00:1]
FAILED tests/unit/test_190_egress.py::test_each_of_the_four_unwrap_clauses_is_load_bearing
FAILED tests/unit/test_190_egress.py::test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper
```

### PLANT 3 — the `_NAT64` membership branch deleted → **4 failing tests**

```
E  AssertionError: 64:ff9b::7f00:1 was ALLOWED but must be refused - NAT64 embedding 127.0.0.1 - HOLE 2
E  AssertionError: 64:ff9b::a9fe:a9fe was ALLOWED but must be refused - NAT64 embedding 169.254.169.254 - HOLE 2
E  AssertionError: 64:ff9b::7f00:1 was ALLOWED - the `_NAT64` membership branch of _unwrap is missing or inert.
E  AssertionError: 64:ff9b::a9fe:a9fe was allowed - _NAT64 is gone
FAILED …::test_every_corpus_address_gets_the_right_verdict[64:ff9b::7f00:1]
FAILED …::test_every_corpus_address_gets_the_right_verdict[64:ff9b::a9fe:a9fe]
FAILED …::test_each_of_the_four_unwrap_clauses_is_load_bearing
FAILED …::test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper
```

⚠ The summary line for this run was truncated by the capture filter; the four `FAILED` lines
above are the enumerated result and are what is claimed. The other five plants carry their
counts verbatim.

### PLANT 4 — the `_SITE_LOCAL` pre-check deleted → **2 failed, 68 passed**

```
E  AssertionError: fec0::1 was ALLOWED but must be refused - site-local - HOLE 4:
   deprecated RFC 3879, is_global says True
E  AssertionError: fec0::1 was ALLOWED - the `_SITE_LOCAL` pre-check in refuse_reason is
   missing or inert. …the naive predicate reports is_global=True for it.
FAILED tests/unit/test_190_egress.py::test_every_corpus_address_gets_the_right_verdict[fec0::1]
FAILED tests/unit/test_190_egress.py::test_each_of_the_four_unwrap_clauses_is_load_bearing
```

### PLANT 5 (T1) — the `refuse_reason` call deleted from the resolve step → **3 failed, 67 passed**

```
E  Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>
E  Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>
E  Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>
FAILED tests/unit/test_190_egress.py::test_every_resolved_address_is_checked_not_just_the_first
FAILED tests/unit/test_190_egress.py::test_T1_the_cloud_metadata_endpoint_is_refused_by_the_resolve_step
FAILED tests/unit/test_190_egress.py::test_a_refusal_never_carries_a_credential
```

`create_ticket`/`send_email` aimed at `169.254.169.254` stopped refusing — T1 exactly.

### PLANT 6 (T14) — match the RAW URL STRING instead of `httpx.URL(u).host` → **13 failed, 57 passed**

```
E  Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>   (×5, one per bypass row)
FAILED …::test_the_host_comes_from_the_PARSED_url_never_the_raw_string[https://slack.com@evil.com/api/]
FAILED …::test_the_host_comes_from_the_PARSED_url_never_the_raw_string[https://slack.com:443@evil.com/]
FAILED …::test_the_host_comes_from_the_PARSED_url_never_the_raw_string[https://evil.com/?x=https://slack.com]
FAILED …::test_the_host_comes_from_the_PARSED_url_never_the_raw_string[https://evil.com#slack.com]
FAILED …::test_the_host_comes_from_the_PARSED_url_never_the_raw_string[https://slack.com.evil.com/api/]
FAILED …::test_host_matching_is_a_label_boundary_never_a_substring[post_message-https://notslack.com/api/]
FAILED …::test_host_matching_is_a_label_boundary_never_a_substring[post_message-https://api.slack.com/api/]
FAILED …::test_host_matching_is_a_label_boundary_never_a_substring[create_ticket-https://evilatlassian.net/rest/]
   (+5 more)
```

**All four classic bypasses were ACCEPTED under the plant** — userinfo, userinfo+port, query
and fragment — because `"slack.com"` genuinely appears in each raw string. `host_not_ascii`
still fired correctly for the homograph row, because the ASCII check reads the parsed host and
runs before the allow-list.

## The restore proof — and a measured correction to how it must be measured

| When | raw md5 | **LF-normalised md5** | `git hash-object` | `git diff --numstat` |
|---|---|---|---|---|
| Before PLANT 1 | `74cad9c0007273a685493aa3ac4acf3c` | `74cad9c0007273a685493aa3ac4acf3c` | — | empty |
| After the final restore | `4751697f0d9af6557dd0fed0b0c79127` | **`74cad9c0007273a685493aa3ac4acf3c`** | `f1920a9d26cd262c67f2459cf76e18ba5a0da720` | **empty** |

⚠ **The plan's acceptance criterion — "`md5sum egress.py` after the final restore equals the
hash recorded before PLANT 1" — is unsatisfiable as literally written on this platform, and
that is a fact about the tool, not a failure of the restore.** `git config core.autocrlf`
rewrites the file to CRLF on checkout, so the raw byte hash changes while the content does
not (`file` reports *"with CRLF line terminators"*; the pre-plant file was written LF). The
identity claim is therefore made with three line-ending-stable measures that all agree:
LF-normalised md5 **identical**, `git diff --numstat` **empty**, and the blob hash recorded.
Any future plan in this repo asserting md5 identity across a `git checkout` restore should
use the LF-normalised form or `git hash-object`.

`grep -c PLANT` → **0** in `backend/app/security/egress.py` and **0** in
`backend/tests/unit/test_190_egress.py`.

## Accomplishments

- **`egress.py` (421 L)** inherits `secret_cipher.py`'s shape exactly: the contract sentence
  with the noun swapped (*"No HTTP or SMTP client is constructed anywhere under
  `backend/app/services/connectors/`"*), a failure-polarity block stating each polarity with
  its decision id, module-private constants, and `__all__` at the bottom.
- **The order IS the property** (D-07): capability → scheme → host → **every** resolved
  address. `http://127.0.0.1/` is refused for its **scheme**, not its address, and the test
  asserts that specific code so a future "localhost is fine" carve-out fails loudly.
- **`EgressRefused` is fail-closed by SIGNATURE, not by discipline** (D-08): keyword-only, no
  `**kwargs`, and `test_EgressRefused_cannot_be_constructed_with_a_body` walks
  `inspect.signature` to prove `raise EgressRefused(capability, response.text)` is
  unwritable. Its `reason_code` is validated against the closed table **at raise time**.
- **The D-08 leak fence has a real positive control** — the sentinel assertion is followed by
  a line this test emits itself, proving `caplog` is actually capturing `app.security.egress`.
  Without it a broken capture makes the fence pass forever.
- **The closed six-code table is asserted three ways**: a module-scope `assert len(...) == 6`
  at import, a set-equality test against UI-SPEC §4c's literal codes, and raise-time
  validation.
- **The capability keys are mechanically bound** to the shipped
  `EXTERNAL_ACTION_CAPABILITIES` frozenset by a test, so `egress.py` needs no service import
  and the two spellings cannot drift (the `models/harness.py:229-235` rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's PLANT-1 expectation was factually wrong**

- **Found during:** pre-Task-1 measurement (a per-clause disable probe run rather than the
  expectation being assumed)
- **Issue:** the plan expected `::ffff:127.0.0.1` / `::ffff:169.254.169.254` to flip to allow
  when the `ipv4_mapped` clause is deleted. CPython already unwraps IPv4-mapped for
  `is_global`, so they do not. Written as stated, the corpus would have had **no** case that
  goes RED for that clause — a falsification round that proved nothing while reading as
  though it had.
- **Fix:** added `::ffff:224.0.0.1` (the measured flip) as the 29th corpus address, and added
  `test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper` covering the reason-string
  property for `ipv4_mapped`, `sixtofour` and `teredo`. Both are documented at the clause and
  in the test file, so the correction is legible rather than silent.
- **Files:** `backend/tests/unit/test_190_egress.py`, `backend/app/security/egress.py`
- **Committed in:** `d67bb34b`, `36a2bb14`

**2. [Rule 1 - Bug] My own source-reading fence was inert, and its positive control caught it**

- **Found during:** Task 3
- **Issue:** the first `test_the_corpus_would_notice_a_deleted_unwrap_clause` stripped `#`
  comments textually. **A docstring is a string literal, not a comment** — `_unwrap`'s
  docstring names every clause, so the fence would have stayed green over a body whose
  clauses had all been deleted. It failed on its own positive control immediately:
  `AssertionError: the comment stripper is inert — it left docstring prose in the 'code'`.
- **Fix:** rewritten to extract the body via `ast.parse` + `ast.unparse` with the docstring
  node dropped; both positive controls kept (prose absent, real code present).
- **Files:** `backend/tests/unit/test_190_egress.py`
- **Committed in:** `388032b4`

**3. [Rule 2 - Missing critical functionality] `PinnedDestination` added to `__all__`**

The plan lists six public names and omits the return type of the module's primary function.
190-07 cannot type its binders against a name that is not exported. Added as a seventh entry.

**4. [Rule 2] Three tests the plan did not enumerate**

`test_an_unknown_capability_fails_CLOSED` (no permissive `.get()` default),
`test_EgressRefused_cannot_be_constructed_with_a_body` (D-08 structurally), and
`test_a_reason_code_outside_the_closed_table_cannot_be_raised` (the table enforced at raise
time). Each closes a fail-open path the enumerated tests do not reach.

### Implementation choices worth flagging

- **`validate_destination` takes an injectable `resolver`** (keyword-only, stdlib default).
  Without it the resolve step is exercisable only against the live internet, i.e. untested in
  CI — which is how a guard rots into decoration. This follows 190-01's own "injectable fetch
  seam" precedent for `resolve_connection`.
- **A destination with no scheme is refused** (`scheme_not_tls`), including a bare SMTP host.
  TLS is stated, never assumed. `send_email` accepts `smtps://` (implicit) or
  `smtp+starttls://`.
- **An unknown capability is refused at step 0**, before the scheme check, so it cannot be
  mis-attributed to a scheme problem.

## ⚠ THE W0-3 WEAK RED IS NOW MEANINGFUL — and 190-13 must read this

190-01 recorded a concern verbatim: *"If a later plan lands `connector_service` and
`egress.py` and these files simply turn green, that is not evidence."* They did **not** turn
green. `test_190_egress_ordering.py` now imports cleanly and fails on **behaviour**:

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_190_egress_ordering.py -q
>       with pytest.raises(EgressRefused) as excinfo:
E       Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>
tests\unit\test_190_egress_ordering.py:181: Failed
------------------------------ Captured log call ------------------------------
INFO  app.services.harness.phase_types:phase_types.py:1876 189 D-05/SC#4: external_action
phase 'file-the-ticket' RECORDED the intended 'create_ticket' and sent nothing …
3 failed, 1 warning in 0.43s
```

That is the **module-missing RED replaced by a real measurement**: the shipped executor calls
no guard at all. **190-13 still owes the other half** — authoring `_exec_external_action` with
the resolver *before* the guard, observing a **credential-shaped** exception, recording it,
and only then reordering. `test_190_egress_ordering.py` was deliberately **not edited** by
this plan (D-32 scope fence; it is not in this plan's `files_modified`).

## Files Created

- `backend/app/security/egress.py` *(created, 421 L)* — the module header contract, the
  closed six-code table with its import-time assert, `_V4_MAPPED`/`_V4_TRANSLATED`/`_NAT64`/
  `_SITE_LOCAL` with a disjointness assert, `_unwrap` (bounded 4), `refuse_reason`,
  `EgressRefused`, `PinnedDestination`, the per-capability allow-list + match modes, the TLS
  scheme table, `_default_resolver`, `_refuse` (the single audit line), `validate_destination`.
- `backend/tests/unit/test_190_egress.py` *(created, 616 L)* — 71 tests: the 29-address
  corpus, the non-vacuity control, the four-clause table, the audited-address identity table,
  the §R15 label-boundary table, the T14 parsed-host table, the scheme table, the resolve-step
  cases including T1, the closed-table assertions, the D-08 leak fence with its positive
  control, and the standing `ast`-based clause fence.

## Baselines re-measured (not inherited)

| Measurement | Command | Value |
|---|---|---|
| This plan's suite | `pytest tests/unit/test_190_egress.py -q` | **71 passed** |
| `test_harness_engine.py` | `pytest tests/test_harness_engine.py -q` | **46 passed** — matches §M2 and 190-01 exactly |
| 189 + audit + publish group | `pytest test_189_no_egress test_189_external_action_model test_audit_event_registration test_publish_service -q` | **1 failed, 67 passed** — the 1 is 190-01's Case B′ meaningful RED, unchanged |
| `backend/requirements.txt` | `git diff --numstat` | **empty** — T-190-SC satisfied, zero installs |
| `backend/app/security/` tracked files | `git ls-files` | **exactly 3**: `__init__.py`, `egress.py`, `secret_cipher.py` |

## Issues Encountered

- **The line-drift trap from 190-01 recurred twice**, and the second occurrence needed a
  different answer. While the RED observation is live, converge to a fixed point (done: `:65`
  → `:66` → `:66`). **Once the observation is past, do NOT retro-fit the number** — Task 3
  added imports and moved it to `:74`, and rewriting the transcript to `:74` would compose a
  traceback nobody ever saw. The file states the drift instead.
- **`md5sum` is not line-ending-stable across a `git checkout` on Windows.** Documented above
  with the three measures that are.

## Known Stubs

None. `redirected` is declared in `REFUSAL_REASONS` and not raised here — that is the closed
table being the single source UI-SPEC §4c renders from, with the raise site owned by plan
190-07. It is stated in the module docstring and in the code comment at its declaration, not
left to be inferred.

## Threat Flags

None. This plan created no network endpoint, no auth path, no file access and no schema
change. `grep -c "sendmail\|AsyncClient\|SMTP_SSL(" backend/app/security/egress.py` → **0**:
the module opens no transport. `socket.getaddrinfo` is a name lookup, not a connection.

## Scope / rule notes

- **D-32 scope fence honoured:** no MCP client, no webhooks, no public API, no retries/queue,
  no expression language, no transport binder (190-07), no adapter, no migration.
- **CLAUDE.md `graphify update .` RUN** — this is the first plan in the phase to land
  production source, which is where 190-01 deferred it. `graphify-out/` is untracked, so no
  artefact entered any commit. Result: 19364 nodes, 50396 edges, 1286/1286 files.
- **No `xfail`, `skip` or `skipif`** (`grep -cE` → `0`).
- **Empty-diff fences untouched** — this plan opened no frontend file at all.

## Next Phase Readiness

**Ready.** What downstream plans now inherit and owe:

| Owed by | What |
|---|---|
| **190-07** | Consume `PinnedDestination(ip, hostname, port, scheme)`: connect to `ip`, verify `hostname`, **never re-resolve**. Raise `EgressRefused(reason_code="redirected", …)` at the redirect site — the code is declared and currently unraised |
| **190-13** | The meaningful W0-3 RED (above): resolver-before-guard observed producing a credential-shaped error, recorded, then reordered. `_exec_external_action` must import `validate_destination` into its own module namespace |
| The plan landing `connector_service` | `send_email` calls must pass `allowed_host=<the org-configured host>`; without it the guard fails closed and every SMTP send is refused |
| Any plan adding a capability | `ALLOWED_HOST_SUFFIXES` is keyed off `EXTERNAL_ACTION_CAPABILITIES` and a test asserts the sets are equal — a new capability with no allow-list entry fails that test at once |
| `/gsd:secure-phase` | T1, T4 and T14 each have a driven falsification recorded above; T2/T3/T11 (rebinding, redirects, size cap) are 190-07's, not evidenced here |

**Concern to carry:** the four clause deletions are **one-off observations**, not standing
guarantees. `test_the_corpus_would_notice_a_deleted_unwrap_clause` is a weak source-reading
fence over them and it says so in its own docstring — a clause could be present and inert.
The behavioural corpus is the real fence; keep both.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/security/egress.py` | FOUND (421 L) |
| `backend/tests/unit/test_190_egress.py` | FOUND (616 L) |
| commit `d67bb34b` (Task 1) | FOUND |
| commit `36a2bb14` (Task 2) | FOUND |
| commit `388032b4` (Task 3) | FOUND |
| `grep -c PLANT` both files | 0 / 0 |
| suite green | 71 passed |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-08*
