---
phase: 190-live-connector-slice-connector-security-stretch
plan: 08
subsystem: backend-connectors
tags: [connectors, adapter-protocol, registry, smtp, header-injection, t12, conn-02, conn-03, red-first, falsification, wave-3]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "SendEmailConfig (the NON-secret per-capability config model, extra='forbid') and ResolvedConnection's lazily-materialized `.secret`"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 07
    provides: "open_pinned_smtp — the ONLY place a connector SMTP socket is opened; `allowed_host=` fails CLOSED if omitted; the blocking half already wrapped"
provides:
  - "backend/app/services/connectors/ — the package, with D-05 stated as its ONE contract"
  - "ConnectorAdapter — the two-method seam (send/check) with CAPABILITY + INPUT_SCHEMA, shaped to the Model Context Protocol's call shape (D-01)"
  - "AdapterResult / AdapterCheckResult — frozen structured results; `ok` documented as the adapter's OWN verdict, never an HTTP status (the T13 trap, one plan early)"
  - "AdapterError — the NAMED refusal base every adapter's errors descend from"
  - "CredentialLike — a structural credential protocol, so an adapter needs no database to be exercised"
  - "registry.get_adapter(capability) — lazy import, key set asserted == EXTERNAL_ACTION_CAPABILITIES at module scope (D-04, the SIXTH consumer)"
  - "smtp_adapter.Adapter — send_email, composed with EmailMessage, envelope validated separately, sent ONCE through the egress binder"
  - "backend/tests/unit/test_190_smtp_header_injection.py — 13 T12 cases including the hand-built positive control, driven RED first"
  - "TWO falsification plants, the second showing the injected `Bcc:` line ON THE WIRE with ok=True returned"
affects: [190-09, 190-10, 190-11, 190-13, 190-14, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A registry whose key set is DERIVED from the shipped frozenset with a module-scope assert, and whose adapters are resolved by lazy import so a not-yet-written sibling cannot break the module's import"
    - "Classify a transport failure BY THE SHAPE OF THE REPLY IT CARRIES (smtp_code / smtp_error / recipients) rather than by isinstance — a source fence that bans naming the transport is then honoured honestly rather than technically"
    - "Envelope-address validation on the rule 'the parser must AGREE with the literal input', never 'the parser must return something' — parseaddr silently rewrites 'v@ex ample.com' into a different valid address"
    - "Pass the validated recipient list EXPLICITLY as to_addrs, so the RCPT TO channel carries what was validated rather than a re-reading of the To header"
    - "One run_in_threadpool hop for the WHOLE blocking conversation (authenticate + submit + disconnect), not three"
    - "Write out an acronym's expansion when a standing fence bans the acronym — the 190-07 rule, applied to prose rather than to a token"

key-files:
  created:
    - backend/app/services/connectors/__init__.py
    - backend/app/services/connectors/protocol.py
    - backend/app/services/connectors/registry.py
    - backend/app/services/connectors/smtp_adapter.py
    - backend/tests/unit/test_190_smtp_header_injection.py
  modified: []

key-decisions:
  - "The three-letter acronym for the Model Context Protocol is NEVER spelled anywhere under backend/app — the 189 fence sweeps every line including docstrings, and my first draft turned it RED. The expansion is written out instead, with the conflict and its resolution stated at the top of protocol.py"
  - "smtp_adapter names no transport module AT ALL, not even to catch its exceptions: a failure is classified by the attributes the exception carries. Importing the exception hierarchy would satisfy the D-05 grep while defeating its intent"
  - "AdapterError lives in protocol.py rather than in each adapter — the executor (190-13) needs ONE name to catch, and a base class is the seam's job. Not in the plan's task text; added as a Rule-2 deviation"
  - "send()'s `capability` parameter is keyword-with-default rather than required: the registry already resolved it, and a required parameter would break a caller that reasonably omits what it just looked up. When given it is CHECKED, never trusted"
  - "AdapterResult on success carries provider_message='' and raw_status=None, HONESTLY: send_message surfaces only the REFUSED recipients and never the accepting reply, so a 250 here would be a wire fact we invented"
  - "A non-empty refused-recipient RETURN value is a failure, not a success — that return is how a partial refusal arrives, and ignoring it is D-31's named 'Complete for a send that did not leave the app'"
  - "A display-name recipient ('Foo <a@b.com>') is REFUSED for the envelope. The envelope carries addresses, not names, and accepting the parser's extraction means sending to something the author did not type"

patterns-established:
  - "A plant harness must wrap its run in try/finally — mine aborted mid-plant on a subprocess error and left production source planted; the restore has to be in the finally, not after the run"
  - "A plant that only swaps the SEND API measures the source fence; a plant that also bypasses COMPOSITION measures the security property. Run both, and let the second one print the bytes that reached the wire"

requirements-completed: []

# Metrics
duration: 71min
completed: 2026-08-08
---

# Phase 190 Plan 08: The Connector Package — Protocol, Registry, SMTP Adapter Summary

**The `send_email` adapter now composes with `EmailMessage` and sends exactly once through the
egress binder — and the reason that is a measurement rather than a claim is PLANT B: with the
headers built by string concatenation instead, `send()` returned `ok=True` while the bytes on
the wire read `From: … Subject: Renewal\r\nBcc: attacker@evil.com`, which an RFC-5322 parser
reads as a real blind-copy recipient. The phase would have shown "Complete". Both plants
restored byte-identically.**

## Performance

- **Duration:** ~71 min
- **Completed:** 2026-08-08
- **Tasks:** 3, each committed individually
- **Files:** 5 created, **0 modified**, **0 deleted** — 1 439 insertions / 0 deletions
- **Suites:** `test_190_smtp_header_injection.py` → **13 passed, 0 failed**; the 190/189
  regression group → **160 passed** with the 1 known pre-existing RED unchanged
- **Dependencies added:** none (`git diff --numstat` on `backend/requirements.txt` and
  `frontend/package.json` prints nothing — T-190-SC)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The package, the two-method protocol, the closed registry | `563fde70` |
| 2 | T12 — 13 cases, RED first, with the positive control | `b2fb6f49` |
| 3 | `smtp_adapter.py`, the T12 suite green, both plants observed | `8ed7d22b` |

---

## ⭐ THE EVIDENCE THAT MATTERS — PLANT B, and why it is stronger than any assertion

The plan asks for one plant: *"replace `send_message(msg)` with a hand-built `sendmail(...)`"*.
That plant was run (PLANT A below) — and **on its own it measures the source fence, not the
security property**, because composition still raises first and cases 1–3 stay green. A second,
deeper plant was therefore run: the naive version a §R13-unaware author actually writes, with
the headers built by string concatenation so the composer's CR/LF guard never runs at all.

```
send() RETURNED: AdapterResult(ok=True, provider_message='', raw_status=None,
                               detail='accepted for delivery by mail.example.com')
--- BYTES ON THE WIRE ---
'From: workflows@example.com\r\nTo: victim@example.com\r\nSubject: Renewal\r\nBcc: attacker@evil.com\r\n\r\nhi\r\n'
-------------------------
contains a Bcc line -> True
an RFC-5322 parser reads Bcc -> 'attacker@evil.com'
...and Subject truncated to -> 'Renewal'
```

**Read the first line together with the third.** The adapter did not error, did not warn and
did not degrade — it returned `ok=True`, which is precisely the *"a phase reads 'Complete' for
a send that did not leave the app"* shape D-31 names, wearing its worst clothes: the send DID
leave the app, and it left carrying a recipient nobody chose. The suite went **8 failed, 5
passed** under this plant:

```
FAILED …::test_a_CRLF_in_the_subject_is_REFUSED_not_stripped_and_not_a_500
FAILED …::test_a_bare_LF_in_the_subject_is_also_refused
FAILED …::test_the_adapter_source_contains_no_sendmail_call
FAILED …::test_a_clean_send_REACHES_the_transport_with_the_validated_envelope
FAILED …::test_every_send_passes_allowed_host_to_the_binder
FAILED …::test_a_send_failure_is_named_carries_the_server_line_verbatim_and_sends_ONCE
FAILED …::test_a_partially_refused_recipient_set_is_a_FAILURE_not_a_success
FAILED …::test_the_adapter_file_names_no_transport_and_no_retry
8 failed, 5 passed, 1 warning in 0.95s
```

### PLANT A — the plan's plant, run as written → **6 failed, 7 passed**

Only the raw-string send API swapped in; composition untouched.

```
E       AssertionError: D-05: smtp_adapter.py names a transport directly: ['.sendmail(']. Every connector socket comes from app.security.egress and nowhere else.
E       assert ['.sendmail('] == []
tests\unit\test_190_smtp_header_injection.py:578: AssertionError

FAILED …::test_the_adapter_source_contains_no_sendmail_call
FAILED …::test_a_clean_send_REACHES_the_transport_with_the_validated_envelope
FAILED …::test_every_send_passes_allowed_host_to_the_binder
FAILED …::test_a_send_failure_is_named_carries_the_server_line_verbatim_and_sends_ONCE
FAILED …::test_a_partially_refused_recipient_set_is_a_FAILURE_not_a_success
FAILED …::test_the_adapter_file_names_no_transport_and_no_retry
6 failed, 7 passed, 1 warning in 0.62s
```

⚠ **The three CR/LF cases stayed GREEN under PLANT A, and that is the finding, not a defect in
the plant.** `EmailMessage` still refused the header before the transport was ever reached — so
a plan that ran only this plant would have recorded a RED and concluded that T12 was driven,
when what was driven was the token fence. PLANT B is what closes that gap. Recorded here rather
than smoothed, because the next adapter plan (190-10 / 190-11) inherits the same plant text.

### The restore proof — byte-exact, both cycles

| When | raw md5 | LF-normalised md5 |
|---|---|---|
| Before any plant | `0c7ac735fb50738424aea00b2d76ae07` | `0c7ac735fb50738424aea00b2d76ae07` |
| PLANT A applied | `0f739107898e410c4330b1f49c3b29a5` | `0f739107898e410c4330b1f49c3b29a5` |
| After PLANT A restore | **`0c7ac735fb50738424aea00b2d76ae07`** | identical |
| After PLANT B restore | **`0c7ac735fb50738424aea00b2d76ae07`** | identical |

`git hash-object backend/app/services/connectors/smtp_adapter.py` →
`4d9c71f6d71b2696586bfb2b26797621d2dcd49d`. `grep -c PLANT` → **0** in
`smtp_adapter.py` and **0** in `test_190_smtp_header_injection.py`.

The harness holds the original bytes in memory and writes them back with `write_bytes`
(190-07's measured lesson — a `git checkout` restore re-applies CRLF on this platform, so the
RAW md5 would not match; here it does).

---

## THE TASK-2 RED — 12 named failures, and 1 GREEN by design

```
E  Failed: No module named 'app.services.connectors.smtp_adapter' - plan 190-08 owns
   app/services/connectors/smtp_adapter.py. T12: the SMTP adapter must compose with
   EmailMessage, set headers via msg[...] so the stdlib's ValueError fires on CR/LF, and
   validate envelope recipients separately with parseaddr.
tests\unit\test_190_smtp_header_injection.py:142: Failed

FAILED …::test_a_CRLF_in_the_subject_is_REFUSED_not_stripped_and_not_a_500
FAILED …::test_a_bare_LF_in_the_subject_is_also_refused
FAILED …::test_a_CRLF_in_a_recipient_is_refused
FAILED …::test_the_envelope_recipients_are_validated_separately_from_the_header
FAILED …::test_the_adapter_source_contains_no_sendmail_call
FAILED …::test_check_authenticates_and_issues_no_DATA_command
FAILED …::test_a_clean_send_REACHES_the_transport_with_the_validated_envelope
FAILED …::test_every_send_passes_allowed_host_to_the_binder
FAILED …::test_a_send_failure_is_named_carries_the_server_line_verbatim_and_sends_ONCE
FAILED …::test_a_partially_refused_recipient_set_is_a_FAILURE_not_a_success
FAILED …::test_the_input_schema_is_the_thin_three_and_the_capability_is_declared
FAILED …::test_the_adapter_file_names_no_transport_and_no_retry
12 failed, 1 passed, 1 warning in 0.63s     (exit code 1)
```

**The 1 that passed is `test_POSITIVE_CONTROL_a_hand_built_raw_message_WOULD_have_produced_a_Bcc_line`,
and it passing at RED time is the point of it.** It proves the attack is real using nothing but
the stdlib, so it is green before the adapter exists and stays green after — which is exactly
what a control has to do. Cases 1–3 are worthless without it.

Each case resolves the module through a named helper rather than a module-scope import, so the
RED is **12 named failures** instead of one collection error (190-01 / 190-02 / 190-07's
repeated lesson). The `ModuleNotFoundError` text still travels verbatim inside each message,
which is what the plan's acceptance criterion asks for.

---

## The three T12 properties, as implemented

Every stdlib fact below was **re-derived in this venv (CPython 3.12.6) before any code was
written**, not inherited from §R13:

```
Subject CRLF     RAISED: ValueError -> Header values may not contain linefeed or carriage return characters
Subject bare LF  RAISED: ValueError -> (same)
Subject bare CR  RAISED: ValueError -> (same)
To CRLF          RAISED: ValueError -> (same)
Subject NUL      NO RAISE -> 'Renewal\x00evil'
To NUL           NO RAISE -> 'v@example.com\x00'
To comma list    NO RAISE -> 'v@example.com, attacker@evil.com'
```

1. **Compose with `EmailMessage`.** Headers are set through `msg[...] = …` inside a loop whose
   `ValueError` handler re-raises `SmtpHeaderRefused` carrying the header **NAME** and the
   composer's own explanation — never the value (D-08). **There is no regular expression over
   the subject anywhere in production source** (`grep -ci "re\.compile"` → 0): the stdlib check
   is stronger, and a duplicate would disagree with it at some edge and be widened later.
2. **Never the raw-string send API.** `grep -cE "…|\.sendmail\("` over `smtp_adapter.py` → **0**,
   asserted in-suite with the matcher proved non-inert on a planted haystack first.
3. **The envelope is a different channel.** ⚠ **The last three measured lines above are why this
   property is not optional**: the header guard covers NEITHER a NUL NOR a comma-smuggled second
   recipient. Both are refused by `_validated_envelope_recipient` on its own, and the validated
   list is passed **explicitly** as `to_addrs` so `RCPT TO` carries what was validated rather
   than a re-reading of the `To` header.

**One thing measured that the research did not name, and it changed the rule:**
`parseaddr("v@ex ample.com")` returns `"v@example.com"` — it **silently rewrites** the input
into a *different, valid* address. So the implemented rule is **"the parser must AGREE with the
literal input"**, not "the parser must return something". Anything `parseaddr` has to normalise
— whitespace, a display name, a comma list — is refused rather than accepted in its normalised
form, because accepting it means the envelope carries an address the author never typed.

---

## ⚠ THE 189 ACRONYM FENCE WENT RED ON MY OWN PROSE — and the fix is the 190-07 rule

`tests/unit/test_189_no_egress.py::test_no_mcp_identifiers_in_backend_app` sweeps **every line**
under `backend/app` — docstrings and comments included — for the three-letter acronym, and
requires zero. My first draft of `protocol.py` and `__init__.py` explained D-01's amendment
using it 19 times, and turned the fence RED:

```
E  AssertionError: SC#4: backend/app must contain ZERO `mcp` identifiers in Phase 189 - live
   connectors are Phase 190. Found:
E    app/services/connectors/protocol.py:1: """Phase 190 (CONN-02 / D-01) - the MCP-SHAPED …
E    … 18 more
1 failed, 22 passed
```

**Resolved by rewriting the prose, not by touching the fence** — 190-07 recorded exactly this
rule after hitting it with the banned raw-string send token. The expansion **Model Context
Protocol** is written out instead (which is more precise anyway), the reason is stated in the
first paragraph of `protocol.py` so the next reader does not "fix" it back, and the full verdict
with the acronym stays in `docs/CONNECTOR-ARCHITECTURE.md`, which is outside the walk. The fence
is **untouched and green** — `1 failed, 22 passed` → **`0 failed`** on that case, with the one
remaining failure being 190-13's known debt.

This matters beyond tidiness: **the fence's green IS part of D-01's evidence** that this phase
built no client for that protocol. Turning it red to describe the amendment would have destroyed
the very proof the amendment rests on.

---

## Accomplishments

- **`protocol.py` (226 L)** — the two-method seam with the four borrowed properties mapped one
  attribute each, so *"adapters register through this seam rather than beside it"* is a
  checkable claim. `AdapterResult.ok` carries a ⚠ block naming the T13 trap **one plan before
  the adapter that will hit it**, and the file declares **no shared response helper**, with the
  omission stated as a decision.
- **`registry.py` (96 L)** — `assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES)` at
  module scope, **derived and never retyped** (`grep -c "'send_email'"` → **0**; the keys are
  double-quoted module-mapping keys asserted equal to the frozenset). Adapters resolve by lazy
  import, so `jira_adapter` / `slack_adapter` can be declared now and written by 190-10 / 190-11
  — and `get_adapter` additionally **checks the adapter's own `CAPABILITY` against the key it
  was registered under**, so a mis-wired registry cannot send a ticket through the mail adapter
  and report success.
- **`smtp_adapter.py` (482 L)** — and the thing it deliberately does **not** contain: the
  transport module's name. `grep -cE "httpx\.|requests\.|smtplib\.|urllib\.request|socket\.|\.sendmail\("`
  → **0**. Failures are classified by the reply they CARRY (`smtp_code` / `smtp_error` /
  `recipients`), which is the same information the transport's exception hierarchy encodes —
  honestly inside the D-05 fence rather than technically inside it.
- **The blocking conversation is ONE threadpool hop.** `login` → `send_message` → `quit` live in
  a single module-private helper reached through `run_in_threadpool` (D-v2.5-01), rather than
  three separate awaits. `open_pinned_smtp` already wraps the connect.
- **`allowed_host=` is passed at both call sites and driven both ways.** A spy asserts the
  adapter's recorded call carries it; then the **real** `validate_destination` is driven with
  and without it, and the omission raises `reason_code="host_not_allowed"` — proving the
  fail-CLOSED behaviour rather than quoting the hand-off.
- **`check()` is proved to send nothing.** The recorder models the PROTOCOL VERBS each stdlib
  call puts on the wire (`AUTH` / `MAIL FROM` / `RCPT TO` / `DATA` / `QUIT`), and the case
  asserts `AUTH` and `QUIT` are present while `DATA` is absent. Asserting only the absence would
  pass over a check that authenticated nothing.
- **A partial refusal is a FAILURE.** `send_message` *returns* the refused-recipient mapping
  rather than raising when some addresses were accepted; ignoring that return value is exactly
  D-31's *"Complete for a send that did not leave the app"*, and it has its own driven case.

## Deviations from Plan

### 1. [Rule 2 — missing critical functionality] `AdapterError` added to `protocol.py`

The plan's Task 1 enumerates the protocol and two dataclasses. A named **base** for adapter
refusals is not listed — but 190-13 has to catch adapter failures with *one* name in order to
land them on the engine's failure path, and without a base each adapter would export its own
unrelated hierarchy. Added, with its D-08 contract (*names the field, never the value; never the
credential*) in its docstring. `SmtpAdapterError` and its five subclasses descend from it.

### 2. [Rule 2] `CredentialLike` added to `protocol.py`

The plan types `send`'s `credential` parameter as bare. A structural protocol with one `.secret`
property is declared instead, so (a) the credential layer stays ABOVE the adapters in the import
graph, and (b) an adapter is exercisable with no database and no encryption key — which is what
lets the whole T12 suite run as a unit test. It also documents WHY the real object is lazy.

### 3. [Recorded — a signature choice the plan left ambiguous] `capability` is keyword-with-default

The plan's protocol sketch makes `capability` a required keyword on `send`. Plan 190-13's own
task text describes the dispatch as *"`get_adapter(capability).send(...)` with the validated
destination, the resolved credential and the composed inputs"* — three things, not four. A
required parameter would therefore have made 190-13's described call a `TypeError`. It is
declared `capability: str | None = None` and **checked when supplied**, never trusted: both
call shapes work and a mismatch still raises.

### 4. [Recorded — the plan's plant is insufficient on its own] Two plants, not one

See the section above. The plan's plant (PLANT A) leaves the three CR/LF cases GREEN, because
composition refuses before the transport is reached — so it falsifies the source fence rather
than T12. PLANT B (composition bypassed as well) is what actually demonstrates the attack.
**Both are recorded**; neither replaces the other.

### 5. [Rule 3 — auto-fixed] The plant harness left production source planted

- **Found during:** the first PLANT A run.
- **Issue:** the harness invoked pytest as `venv/Scripts/python.exe`, which `CreateProcess`
  could not resolve; the resulting `FileNotFoundError` propagated **past** the restore, leaving
  `smtp_adapter.py` planted on disk (raw md5 `0f739107…`, `PLANT` count 2). The file is new and
  therefore untracked, so `git checkout` was not available as a fallback.
- **Fix:** the plant was reversed by an exact inverse string replacement and verified back to
  `0c7ac735fb50738424aea00b2d76ae07`; the harness was then changed to use `sys.executable` and,
  more importantly, to put `restore()` in a **`finally`**. Both plants were re-run from clean.
- **Standing lesson for the remaining adapter plans:** a plant harness's restore belongs in a
  `finally`, not after the run. This is the first plan in the phase to plant a file that is not
  yet tracked by git, which is what removed the usual safety net.

### 6. [Recorded] The `check()` no-`DATA` case lives in Task 2's file, not Task 3's

Task 3's acceptance requires *"a test in this task asserts the `check` path issues no `DATA`
command"*, but Task 3's `<files>` list is `smtp_adapter.py` alone. The case was authored in
Task 2's test file instead — where it was **observed RED like every other case**, which is
strictly stronger than adding it green afterwards. No file outside the plan's `files_modified`
was touched.

---

**Total deviations:** 2 Rule-2 additions, 1 recorded signature choice, 1 recorded strengthening
of the plan's plant, 1 auto-fixed tooling failure, 1 recorded task-boundary note. No package was
installed and no file outside `files_modified` was opened.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_smtp_header_injection.py -q` | **13 passed, 0 failed** (plan asks ≥ 6 cases) |
| 190/189 regression group (8 files) | **160 passed, 1 failed** — the 1 is 190-13's known debt, unchanged |
| `pytest tests/test_harness_engine.py -q` | **46 passed** — matches §M2 / 190-01 / 190-02 / 190-07 exactly |
| `pytest tests/unit/test_189_no_egress.py -q` | acronym fence **GREEN**; 1 failed / 22 passed (the known 190-13 RED) |
| `pytest tests/unit/test_190_egress_ordering.py -q` | **3 failed** — unchanged, all owed by 190-13 |
| `python -c "…; print(sorted(r._ADAPTERS))"` | `['create_ticket', 'post_message', 'send_email']` |
| `python -c "…set(r._ADAPTERS) == set(C)"` | **True** |
| `dir(ConnectorAdapter)` public names | `['CAPABILITY', 'INPUT_SCHEMA', 'check', 'send']` |
| `Adapter.CAPABILITY, sorted(Adapter.INPUT_SCHEMA['properties'])` | `send_email ['body', 'subject', 'to']` |
| `get_adapter('send_email').CAPABILITY` | `send_email` (the other two raise `ModuleNotFoundError` — owned by 190-10 / 190-11) |
| banned transport tokens in `smtp_adapter.py` | **0** |
| banned transport tokens in `protocol.py` / `registry.py` / `__init__.py` | **0 / 0 / 0** |
| `grep -c "send_message"` / `"parseaddr"` in the adapter | **5 / 4** |
| `grep -ci "retry\|backoff"` in the adapter | **1** — a single docstring line, and it cites D-18 |
| `grep -ci "re\.compile"` in the adapter | **0** (§R13: a regex over the subject is the wrong answer) |
| `grep -c "EXTERNAL_ACTION_CAPABILITIES"` in `registry.py` | **7** |
| `grep -c "SEED-013"` in `protocol.py` | **2** |
| acronym occurrences under `backend/app/services/connectors/` | **0** |
| `grep -c PLANT` adapter / test file | **0 / 0** |
| `git diff --numstat` — `requirements.txt` / `package.json` | **empty** (T-190-SC) |
| File deletions in any of the three commits | **none** |
| `graphify update .` | **19 634 nodes / 51 427 edges** rebuilt (untracked artefact; no git impact) |

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-08-T12 | Composed with `EmailMessage`; headers set via `msg[...]` so the stdlib's `ValueError` fires; re-raised as `SmtpHeaderRefused` carrying the header NAME only. CR, LF and CRLF all driven; the positive control proves a hand-built message WOULD have produced a `Bcc:` line, twice over (string containment AND an RFC-5322 parser reading it as a header). PLANT A and PLANT B both observed RED, the second printing the injected line **on the wire** with `ok=True` returned |
| T-190-08-ENV | `_validated_envelope_recipient` with `parseaddr`, on the *parser-must-agree-with-the-input* rule; driven independently with a NUL and with a comma-smuggled second recipient, **both first asserted to pass the header guard**, so the case cannot be satisfied by the CR/LF guard doing the work by accident |
| T-190-08-D05 | Zero occurrences of every banned token in all four package files, asserted in-suite with the matcher proved non-inert on a planted haystack. The adapter names no transport even to catch its exceptions |
| T-190-08-D04 | Module-scope `assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES)`, derived from the shipped frozenset; `get_adapter` additionally checks each adapter's own `CAPABILITY` against its key. (190-14 owns planting a fourth key and observing the import-time fire) |
| T-190-08-CHECK | `check()` asserted to issue `AUTH` and `QUIT` and **no `DATA`**, and to submit no message — so UI-SPEC §5c's *"and nothing was sent"* is proved at the level it is claimed at |
| T-190-08-D18 | No retry, no backoff, no idempotency key, no queue — asserted **per line** (prose citing D-18 is the only thing allowed). A failure raises after exactly one `DATA`, driven by counting the verb |
| T-190-08-LEAK | Refusals name the header/field and never its value; the credential sentinel is asserted absent from the failure message and from the check result's `repr`; the server's reply is surfaced verbatim while the log line carries only host + code |
| T-190-SC | **Zero installs.** `email`, `ssl` and the SMTP transport are stdlib; no vendor SDK was added (one would construct its own client and break D-05). `git diff --numstat` over all three commits on `requirements.txt` / `package.json` prints nothing |

## Known Stubs

**None in this plan's own output.** Every function in `smtp_adapter.py`, `registry.py` and
`protocol.py` is wired to a real code path; nothing returns a hardcoded empty value and no
placeholder text exists.

Two things are **deliberately absent** rather than stubbed, and both belong to named plans:

- `jira_adapter.py` (190-10) and `slack_adapter.py` (190-11). Their registry entries exist
  **now**, by design — the D-04 assert is meaningless over a key set that grows later — and they
  currently raise `ModuleNotFoundError` when resolved, which is the honest state. Plan 190-14's
  fence asserts every capability resolves to an importable adapter once all three land, which is
  what turns that intentional gap into a promise with a date on it.
- The standing `connectors/**` source fence (190-14). This plan fences its own file directly and
  proves the matcher non-inert; the tree-wide walk is 190-14's.

## Threat Flags

**None outside this plan's `<threat_model>`.** No network endpoint, no auth path, no file
access and no schema change was opened here. The adapter is new outbound-capable code, which is
exactly what T12 / ENV / D05 / D18 / LEAK were written against, each dispositioned above.

## Scope / rule notes

- **D-32 scope fence honoured:** no client for the Model Context Protocol, no dependency on it,
  no transport for it; no Jira adapter (190-10), no Slack adapter (190-11), no router (190-09),
  no executor wiring (190-13); no webhook, no public API, no service account, no OAuth, no
  fourth capability, no retry / idempotency key / queue, no expression language, no migration,
  no frontend file opened.
- **G-5 hot-file ledger:** `backend/app/services/connectors/` is a NEW directory (0 prior
  phases). No row applies and none is added — a ledger row for a one-plan-old file would be
  noise.
- **CLAUDE.md `graphify update .` run** after the production-source change.
- **No `xfail`, `skip` or `skipif`** in the new test file (`grep -cE` → 0).
- **Provider-docs-first:** the stdlib facts this plan rests on were driven in-venv (CPython
  3.12.6) before implementation, not taken from §R13's transcript.

## Next Phase Readiness

**Ready.** What downstream plans inherit and owe:

| Owed by | What |
|---|---|
| **190-10 / 190-11** | `class Adapter` in your own module, with `CAPABILITY` and `INPUT_SCHEMA` class attributes; the registry checks `CAPABILITY` against its key at resolution. Return `AdapterResult` / `AdapterCheckResult`; subclass `AdapterError` for named refusals. ⚠ **Do not add a shared response helper** — `AdapterResult.ok`'s docstring says why in the file you will be reading |
| **190-10 / 190-11** | The plant lesson above: a plant that swaps only the SEND API measures the source fence. To measure the security property, bypass the thing that actually guards it |
| **190-13** | `registry.get_adapter(capability)` returns a ready instance; call `await adapter.send(args=…, credential=…, config=…)`. `capability=` is accepted and checked but not required. Catch `protocol.AdapterError` for the engine's failure path — the adapter never retries, so a failure is terminal by construction (D-18) |
| **190-13** | `config` is the **connection row's** non-secret config dict (`ResolvedConnection.config`), never the step's JSONB. The adapter validates it through the shipped `SendEmailConfig` |
| **190-14** | The banned-token tuple `("httpx.", "requests.", "smtplib.", "urllib.request", "socket.", ".sendmail(")` and its non-vacuity control are written in `test_190_smtp_header_injection.py` and can be lifted verbatim. ⚠ **Scope the walk to `.py` files under the package**, and note that prose is swept too — this plan's first draft tripped the 189 acronym fence with a docstring |
| **`/gsd:secure-phase`** | T12 has two driven falsifications, the second printing the injected header on the wire. The envelope path, the `check`-sends-nothing property, the D-18 single-attempt property and the D-05 token walk each have their own driven case |

**One thing not to re-litigate:** the acronym is unspelled under `backend/app` for a measured
reason. Writing it back turns `test_189_no_egress.py`'s acronym fence RED, and that fence's
green is part of D-01's own evidence.

## State bookkeeping — hand-edited, and why

**The SDK state verbs were NOT called.** D-190-DEF-01 has four recorded occurrences this phase,
the most recent (190-06) where both verbs *reported doing nothing* while deleting 39 lines
including `stopped_at` and three history blocks. `STATE.md` and `ROADMAP.md` were copied aside
first and edited by hand, per the plan-03/04/05/06/07 convention, then diffed.

**`REQUIREMENTS.md` deliberately NOT marked.** CONN-02 and CONN-03 are marked **together at
phase close** (the convention D-190-DEF-02 set at 190-01 and every plan since has followed).
CONN-02 is unmet until all three adapters exist and 190-13 wires the send; claiming it here
would assert a capability that does not exist, in the phase whose whole discipline is not
over-claiming.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/services/connectors/__init__.py` | FOUND (37 L) |
| `backend/app/services/connectors/protocol.py` | FOUND (226 L) |
| `backend/app/services/connectors/registry.py` | FOUND (96 L) |
| `backend/app/services/connectors/smtp_adapter.py` | FOUND (482 L) |
| `backend/tests/unit/test_190_smtp_header_injection.py` | FOUND (598 L) |
| commit `563fde70` (Task 1) | FOUND |
| commit `b2fb6f49` (Task 2) | FOUND |
| commit `8ed7d22b` (Task 3) | FOUND |
| No file deletions in any of the three commits | CONFIRMED |
| `grep -c PLANT` adapter / test file | 0 / 0 |
| Suite green | 13 passed, 0 failed |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-08*
