---
phase: 190-live-connector-slice-connector-security-stretch
plan: 10
subsystem: backend-connectors
tags: [connectors, jira, adf, create-ticket, t13, basic-auth, conn-02, conn-03, red-first, falsification, wave-4]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "CreateTicketConfig — the NON-secret per-capability config on the CONNECTION ROW (base_url / project_key / account_email), extra='forbid'"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 07
    provides: "send_pinned_http — the ONLY door to an HTTP connection; auth= is passed through to the library; a 3xx RAISES EgressRefused(reason_code='redirected'); wire AND decompressed size both capped"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 08
    provides: "the adapter protocol (CAPABILITY + INPUT_SCHEMA, AdapterResult/AdapterCheckResult, AdapterError, CredentialLike) and registry.get_adapter, which checks CAPABILITY against the resolved key"
provides:
  - "jira_adapter.Adapter — create_ticket, Jira Cloud REST v3 POST /rest/api/3/issue, one attempt"
  - "_plain_text_to_adf — the pure plain-text -> Atlassian Document Format builder, and D-09's fence: an author-supplied document RAISES"
  - "_failure_bucket — UI-SPEC §4d's closed three (refused / unreachable / rejected), with no fourth member"
  - "JiraCreateFailed carrying a structured AdapterResult(ok=False) plus its §4d bucket"
  - "JiraUnreachable — the third door out of check(), so §4d's three states arrive by three distinguishable routes"
  - "backend/tests/unit/test_190_jira_adapter.py — 17 cases driven RED first"
  - "TWO falsification plants, each verified to REACH its property rather than trip a source fence"
affects: [190-11, 190-13, 190-14, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Put the fence INSIDE the guarded step and hand it the raw value: a type check in front of the builder would have made the plant unreachable and the fence decoration"
    - "ok=True requires three gates, not one — a 2xx status, no error envelope, and the issue KEY, because the key is the only evidence in a reply that an issue exists"
    - "Split the transport call from the reply reading: _request classifies EXCEPTIONS, each caller interprets its own REPLY, so no shared response helper can form"
    - "Give a failure exception the same structured result type a success would have returned, with ok=False asserted at construction"
    - "Let three failure states arrive by three DIFFERENT routes (EgressRefused / JiraUnreachable / ok=False) so a caller cannot collapse §4d's vocabulary by accident"

key-files:
  created:
    - backend/app/services/connectors/jira_adapter.py
    - backend/tests/unit/test_190_jira_adapter.py
  modified: []

key-decisions:
  - "issuetype is the module constant DEFAULT_ISSUE_TYPE='Task', NOT read from config — CreateTicketConfig is extra='forbid' and declares only base_url/project_key/account_email, so the plan's 'from config if present' is unconstructable without editing a file outside files_modified"
  - "JiraCreateFailed RAISES and carries an AdapterResult(ok=False) rather than being returned — a returned ok=False is ignorable, and an ignored failure IS D-31's 'Complete for a send that did not leave the app' arriving through the front door"
  - "EgressResponseTooLarge / EgressResponseUndecodable propagate UNCHANGED, like EgressRefused: neither is a §4d state, and painting one with a §4d heading is precisely the swap §4d forbids"
  - "check() lets JiraUnreachable propagate instead of returning ok=False, so ok=False from check means exactly and only §5b's 'The host rejected this credential'"
  - "allowed_host= is deliberately NOT passed — the opposite of the send_email adapter's rule, because create_ticket's permitted host is a CODE suffix rule inside the guard and a per-call host would be a second, staler source of truth"
  - "A base_url carrying a query string or a fragment is REFUSED: the API path is appended to it, and a fragment would swallow the path and send the create to the site root"
  - "A 200 that names nobody fails check(): §5c renders WHO we authenticated as, and a check that cannot answer that has not established what it claims"

patterns-established:
  - "Verify a plant REACHES its property by reading the captured log, not only the assertion: PLANT A's log line 'one issue created (key=OPS-17)' is what proves the injected document was filed, and PLANT B's 'key=UNKNOWN' is what proves ok=True was returned for a ticket that does not exist"
  - "When a fence bans a token the prose wants to use, rewrite the sentence (190-07's rule) — here the acceptance grep bans the encoding vocabulary AND the credential header's name, so the module says 'the library encodes it' instead"

requirements-completed: []

# Metrics
duration: 58min
completed: 2026-08-09
---

# Phase 190 Plan 10: The `create_ticket` Adapter — Jira Cloud REST v3 Summary

**`ok=True` now means the ticket exists, and that is a measurement rather than a claim: with
the envelope and issue-key gates removed the adapter logged `create_ticket: one issue created
(project=OPS key=UNKNOWN)` and returned success for a reply that carried `errorMessages` and
no key at all — and with the document builder accepting a dictionary, an author-supplied rich
document was filed as `OPS-17`. Both plants restored byte-identically.**

## Performance

- **Duration:** ~58 min
- **Tasks:** 2, each committed individually
- **Files:** 2 created, **0 modified**, **0 deleted** — 631 + 719 = 1 350 lines added
- **Suite:** `test_190_jira_adapter.py` → **17 passed, 0 failed** (the plan asks ≥ 9 cases)
- **Dependencies added:** none — `git diff --numstat HEAD~2 HEAD` over
  `backend/requirements.txt` and `frontend/package.json` prints nothing (T-190-SC). **No Jira
  SDK**, which would have constructed its own client and broken D-05.

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The Jira drive — 17 cases, RED first | `68a24aea` |
| 2 | `jira_adapter.py`, the suite green, both plants observed | `aeaab93f` |

---

## ⭐ THE TWO PLANTS — and the check that 190-08 said to run

190-08's hand-off to this plan was explicit: *"a plant that swaps only the SEND API measures
the source fence. To measure the security property, bypass the thing that actually guards
it."* Phase rule 6 restates it as an obligation — **check that your plant actually reaches the
property you claim to be measuring, and say so if it does not.** Both plants below were
checked that way, by reading the CAPTURED LOG rather than only the assertion, and both reach.

### PLANT A — the plan's plant: `_plain_text_to_adf` accepts a dictionary → **1 failed / 16 passed**

```
============================================================================
PLANT A applied - raw md5 = d05e068098d173e402edbaea365abd3c (PLANT count 2)
============================================================================
..F..............                                                        [100%]
>       with pytest.raises(module.JiraDocumentRefused) as excinfo:
E       Failed: DID NOT RAISE <class 'app.services.connectors.jira_adapter.JiraDocumentRefused'>
tests\unit\test_190_jira_adapter.py:287: Failed
------------------------------ Captured log call ------------------------------
INFO  app.services.connectors.jira_adapter:jira_adapter.py:568 create_ticket: one issue created (project=OPS key=OPS-17)
FAILED tests/unit/test_190_jira_adapter.py::test_an_author_supplied_ADF_object_is_REFUSED
1 failed, 16 passed, 1 warning in 0.49s
```

**Read the log line, not only the assertion.** The failure is not "an assertion about a
refusal was violated" — it is `one issue created (key=OPS-17)`: the author-supplied rich
document went to Jira and Jira **filed it**. That is T-190-10-ADF's threat happening, not
being described. The plant reaches the property **because `send` hands the RAW `description`
value to the builder**; had `send` validated it as a string first, the refusal would have
fired one frame earlier, every case would have stayed green, and this plant would have
measured nothing — which is exactly the shape 190-08 recorded. The ordering is commented at
the call site so it survives a future tidy-up.

### PLANT B — the T13 property: the envelope gate AND the key gate removed → **3 failed / 14 passed**

Not in the plan's acceptance criteria. It is here because critical rule 3 —
*"a structurally-200-but-failed Jira response cannot read as `ok=True`"* — is the phase's
likeliest lie, and an assertion that it holds is worth less than a demonstration of what
happens when it does not.

```
============================================================================
PLANT B applied - raw md5 = 2a889643a6b585061f204b48d98cfdec (PLANT count 3)
============================================================================
E   Failed: DID NOT RAISE <class 'app.services.connectors.jira_adapter.JiraCreateFailed'>
tests\unit\test_190_jira_adapter.py:556: Failed
------------------------------ Captured log call ------------------------------
INFO  app.services.connectors.jira_adapter:jira_adapter.py:566 create_ticket: one issue created (project=OPS key=UNKNOWN)

FAILED tests/unit/test_190_jira_adapter.py::test_a_200_carrying_an_error_envelope_is_NOT_a_success
FAILED tests/unit/test_190_jira_adapter.py::test_a_2xx_with_no_issue_key_is_NOT_a_success
FAILED tests/unit/test_190_jira_adapter.py::test_the_api_token_never_appears_in_a_refusal
3 failed, 14 passed, 1 warning in 0.56s
```

`one issue created (project=OPS key=UNKNOWN)` — for a reply that carried Jira's own
`errorMessages` **and** no issue key. `ok=True` was returned. **The phase would have read
"Complete" for a ticket nobody can find**, which is D-31's named failure condition wearing the
Jira vendor's clothes rather than Slack's. The third failure is informative rather than
incidental: the credential-leak case drives every failure shape this adapter can produce, so
removing a failure path removes its coverage too — a reminder that a leak fence is only as
wide as the set of failures that still exist.

### The restore proof — byte-exact, both cycles

| When | raw md5 | LF-normalised md5 |
|---|---|---|
| Before any plant | `6bd7c768241bacea3f54a9075dac39ee` | `6bd7c768241bacea3f54a9075dac39ee` |
| PLANT A applied | `d05e068098d173e402edbaea365abd3c` | — |
| PLANT B applied | `2a889643a6b585061f204b48d98cfdec` | — |
| After restore | **`6bd7c768241bacea3f54a9075dac39ee`** | identical |

`git hash-object backend/app/services/connectors/jira_adapter.py` →
`aca9600d580a8f1599c209e935d2eb65de6402e4`. `grep -c PLANT` → **0** in the adapter and **0**
in the test file. The harness holds the original bytes in memory, writes them back with
`write_bytes`, and puts the restore in a **`finally`** — 190-07's and 190-08's two recorded
lessons, applied rather than re-learned.

---

## THE TASK-1 RED — 17 named failures, zero collection errors

```
E  Failed: No module named 'app.services.connectors.jira_adapter' - plan 190-10 owns
   app/services/connectors/jira_adapter.py. D-02/R12: create_ticket POSTs to Jira Cloud
   REST v3 /rest/api/3/issue through egress.send_pinned_http and nothing else, with a
   programmatically-built ADF description, basic auth from (account_email, api_token),
   and Jira's own status codes deciding the verdict.
tests\unit\test_190_jira_adapter.py:157: Failed

FAILED …::test_the_create_payload_has_exactly_the_four_required_fields
FAILED …::test_the_description_is_a_programmatically_built_ADF_document
FAILED …::test_an_author_supplied_ADF_object_is_REFUSED
FAILED …::test_the_basic_auth_is_built_by_httpx_not_by_hand
FAILED …::test_a_400_surfaces_errorMessages_and_errors_VERBATIM
FAILED …::test_a_401_is_a_REJECTED_credential_not_a_REFUSED_address
FAILED …::test_the_adapter_never_retries
FAILED …::test_check_authenticates_and_creates_NOTHING
FAILED …::test_jira_and_slack_do_not_share_a_response_checker
FAILED …::test_a_200_carrying_an_error_envelope_is_NOT_a_success
FAILED …::test_a_2xx_with_no_issue_key_is_NOT_a_success
FAILED …::test_a_created_issue_returns_ok_True_with_its_key
FAILED …::test_an_egress_refusal_propagates_unchanged_as_a_refusal
FAILED …::test_a_transport_failure_that_reached_nothing_is_UNREACHABLE
FAILED …::test_the_input_schema_is_summary_and_description_only
FAILED …::test_the_api_token_never_appears_in_a_refusal
FAILED …::test_the_adapter_file_names_no_transport_and_no_retry
17 failed, 1 warning in 0.84s     (exit code 1)
```

Every case resolves the module through a named `_adapter()` helper rather than a module-scope
import, so the RED is **17 named failures** instead of one collection error — the lesson
190-01, 190-02, 190-07 and 190-08 each recorded, applied here without re-deriving it. The
`ModuleNotFoundError` text still travels verbatim inside each message.

---

## Provider-docs-first — what was checked, and how

CLAUDE.md's provider-docs-first rule binds here. **The Context7 MCP tools were not available
in this agent's environment and the `ctx7` CLI fallback is not installed** (`command -v ctx7`
→ nothing), so the primary evidence is `190-RESEARCH.md` §R12, which cites Atlassian's own
documentation by URL — *Jira Cloud platform REST API v3 — Issues*, *Basic auth for REST APIs*,
*REST API v3 intro* — and quotes it directly. **§R12 was authored 2026-08-08, one day before
this plan executed, so it is not stale**, and its two HIGH-confidence findings are exactly the
two this file rests on:

| Finding | Confidence | Implemented as |
|---|---|---|
| *"Version 3 of the API provides support for the Atlassian Document Format (ADF), including in issue resources"* — `description` takes an OBJECT | **HIGH** (stated by Atlassian) | `_plain_text_to_adf`, built programmatically, author-supplied documents refused |
| *"Authentication using passwords has been deprecated"* — the username is the account EMAIL and the password is an API token | **HIGH** (stated by Atlassian) | `auth=(account_email, api_token)` handed to the binder; **no password path exists in this adapter to be reached** |
| `{"errorMessages": [...], "errors": {...}}` with real HTTP status codes | **MEDIUM** — not driven against a live account | Surfaced verbatim, with a fall-back to the reply's own decoded text when the shape differs. **Assumption A1, below** |

The conventions were deliberately **not** transferred from the sibling adapter: Jira's
status-code contract is the opposite of Slack's `ok:false` contract, which is the whole reason
the last case in the file is a fence rather than a nicety.

---

## The three gates that make `ok=True` mean the ticket exists

This is the plan's third phase-critical rule and it is worth stating as implemented, because
"we check the status code" is the version of it that ships the lie:

1. **`200 <= status < 300`** — Jira signals errors with real status codes, so a
   `raise_for_status()`-shaped check is CORRECT here (and is WRONG for Slack, which is why the
   two adapters may not share one).
2. **No error envelope in the body**, whatever the status line said. `_carries_error` fires on
   a non-empty `errorMessages` **or** a non-empty `errors`, so a gateway, a proxy rewriting a
   status, or a future API change cannot turn a described failure into a success.
3. **An issue KEY is present.** The key is the only evidence *in the reply* that an issue was
   created; a 201 with an empty body, an HTML body, or `{"id": …}` and no key is a reply we
   cannot read as a created ticket, and reporting it as one would rest "Complete" on the
   status line alone.

Driven across five bodies (`{}`, `{"id": …}`, `{"key": ""}`, an HTML string, `null`) and both
falsified by PLANT B.

## The §4d vocabulary, as implemented — three states, three ROUTES

UI-SPEC §4d warns that flattening *refused* / *unreachable* / *rejected* is the single most
likely copy defect on this surface. Rather than trusting one field to stay correct, the three
arrive by three **structurally different** routes, so a caller cannot collapse them by
accident:

| State | Route out of the adapter | Why not the others |
|---|---|---|
| `refused` | `EgressRefused` propagates **unchanged**, carrying one of §4c's six authored reason codes | Catching and re-raising it would replace an authored sentence with an improvised one and lose the code the renderer keys off |
| `unreachable` | `JiraUnreachable`, or `JiraCreateFailed(bucket="unreachable")` on the send path | Nothing answered, so `raw_status` is `None` — inventing a status would be a wire fact we made up |
| `rejected` | `JiraCreateFailed(bucket="rejected")` on send; `AdapterCheckResult(ok=False)` on check | The host answered and said no. From `check`, `ok=False` therefore means **exactly and only** §5b's *"The host rejected this credential"* |

`_failure_bucket` has **no fourth member** and `FAILURE_BUCKETS` is asserted at the raise site,
so a typo'd bucket raises rather than rendering an empty heading — the same discipline
`EgressRefused` already applies to its reason codes.

---

## Deviations from Plan

### 1. [Recorded — the plan's instruction is unconstructable] `issuetype` is a constant, not config

The plan's Task-2 text says `issuetype.name` is *"default `Task`, from config if present"*.
**It cannot be from config.** `CreateTicketConfig` (shipped by 190-06, `extra='forbid'`)
declares `base_url`, `project_key` and `account_email` and nothing else, so an `issue_type`
key in a stored config is a `ValidationError` by design — and adding the field means editing
`backend/app/models/connector.py`, which is **not in this plan's `files_modified`**.

Implemented as the module constant `DEFAULT_ISSUE_TYPE = "Task"`, with the reason stated at
the constant so the next reader finds it explained rather than assumed. **Re-open trigger:**
the first org that needs a non-`Task` issue type — that is a change to migration 116's config
contract plus the model, and belongs to whoever needs it rather than to a speculative field
here.

### 2. [Rule 2 — missing critical functionality] The three-gate success test, not one

The plan's Task-2 text says *"On 2xx return `AdapterResult(ok=True, ...)` carrying the created
issue key."* Taken literally that is the status-line-only check, and it is the exact shape
phase-critical rule 3 rules out. Gates 2 and 3 (no error envelope; an issue key must be
present) were added, with two cases and PLANT B behind them. Without them the plan's own
success criterion — *"a structurally-200-but-failed Jira response cannot read as `ok=True`"* —
would have been unmet by the plan's own instruction.

### 3. [Rule 2] `EgressResponseTooLarge` / `EgressResponseUndecodable` propagate unchanged

The plan enumerates three outcomes (2xx, non-2xx, transport failure) and does not mention the
two response-size terminals 190-07 introduced. Mapping either onto a §4d bucket would be
dishonest in both available directions: the host **did** answer, so it is not *unreachable*,
and the answer was not a refusal of ours, so it is not *refused*. They propagate unchanged,
like `EgressRefused`, and the consequence is recorded as **assumption A2** below rather than
smoothed.

### 4. [Rule 2] A `base_url` carrying a query string or a fragment is refused

Not in the plan. The API path is **appended** to `base_url`, so `https://site.atlassian.net#`
would swallow `/rest/api/3/issue` into a fragment and send the create to the site root — which
can answer `200` with a page. The three gates above would still fail it closed, so this is
defence in depth rather than the only guard; it is refused at config-validation time because a
named refusal at the right layer is cheaper to read than a missing-issue-key error two layers
later. **No host or scheme matching is re-implemented** — that stays inside the guard, per the
plan's own instruction.

### 5. [Recorded — a signature choice] `JiraCreateFailed` raises and CARRIES an `AdapterResult`

The plan's Task-1 text asks that a failure *"carries both arrays verbatim … and that the
result's `ok` is `False`"*, which reads as a returned result, while the sibling adapter and
190-08's hand-off to 190-13 (*"catch `protocol.AdapterError` for the engine's failure path"*)
both say raise. Both are honoured: the exception is the named `AdapterError` subclass 190-13
catches, and it carries a real `AdapterResult` with `ok=False` **asserted at construction**, so
the payload is the same shape a caller would have received on success. A returned `ok=False`
is ignorable; an ignored failure is D-31 arriving through the front door.

### 6. [Recorded] `allowed_host=` is deliberately NOT passed — the opposite of the mail adapter

`send_email`'s permitted host is org configuration, so omitting `allowed_host=` there fails
CLOSED and the sibling's docstring says so in a warning block. `create_ticket`'s permitted host
is a CODE rule (`ALLOWED_HOST_SUFFIXES["create_ticket"] = ("atlassian.net",)`, matched on the
label boundary), and `_host_is_allowed` ignores `allowed_host` for it entirely. Passing one
would be a second, staler source of truth. Stated in the module docstring **because the two
adapters differ**, and a reader who learned the mail rule first would otherwise read this as an
omission.

### 7. [Recorded — a measured difference from the mail adapter, not a defect] The credential materialises one frame earlier

The mail adapter reads `credential.secret` only **after** its connection cleared the guard, so
a refused run never produces a plaintext credential at all. **This adapter cannot do that**:
`send_pinned_http` takes the credential pair as a call argument, so the plaintext exists one
frame before the guard runs inside the binder. 190-07's own docstring anticipates this — *"`auth`
arrives already resolved, but nothing here reads it, and a refusal below never reaches the
transport at all"* — so **D-06's asserted property is unaffected**: the guard still runs first,
still refuses without consulting the credential, and a refused destination still reaches no
wire. What is lost is only the lazy-decrypt bonus the mail path gets for free. Recorded in the
module docstring and here, rather than left for a reviewer to notice as an inconsistency.

### 8. [Recorded] The prose had to avoid the very tokens it describes — again

Task 2's acceptance greps require **zero** occurrences of the encoding vocabulary in this file,
and the credential-header fence in Task 1 is asserted **case-insensitively** (a lowercase
header key is the same hand-built header). The module therefore says *"the library encodes it"*
and *"constructs no encoded credential string and no credential header of its own"* rather than
naming either token. This is 190-07's recorded rule — *when prose in production source would
trip the very fence it describes, rewrite the sentence rather than declare a conflict* — hit
for the third time in this phase. The D-18 paragraph needed the same treatment for the
per-line `retry`/`backoff` fence, and the fix is stated inside the paragraph itself.

---

**Total deviations:** 3 Rule-2 additions, 1 recorded unconstructable instruction, 3 recorded
design/decision notes, 1 recorded prose-vs-fence conflict. No package was installed, no file
outside `files_modified` was opened, and no file was deleted.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_jira_adapter.py -q` | **17 passed, 0 failed** (plan asks ≥ 9 cases) |
| Task-1 RED exit code | **1**, with **17 named failures** |
| `grep -c "def test_"` in the test file | **17** |
| `grep -cE "xfail\|@pytest.mark.skip"` in the test file | **0** |
| Literals required by Task 1 — `errorMessages` / `"type": "doc"` / `rejected` | **12 / 2 / 8** |
| `grep -cE "httpx\.\|requests\.\|smtplib\.\|urllib\.request\|socket\.\|\.sendmail("` in the adapter | **0** |
| `grep -ciE "b64encode\|base64\|authorization"` in the adapter | **0** |
| `retry` / `backoff` / `sleep` lines in the adapter not citing D-18 | **0** |
| `Adapter.CAPABILITY, sorted(INPUT_SCHEMA['properties'])` | `create_ticket ['description', 'summary']` |
| `_plain_text_to_adf('one\ntwo')` → `type, version, len(content)` | `doc 1 2` |
| `get_adapter('create_ticket').CAPABILITY` | `create_ticket` — resolves through the registry |
| `grep -c PLANT` adapter / test file | **0 / 0** |
| Adapter raw md5 after both plants | **identical to before** (`6bd7c768…`) |
| `pytest tests/test_harness_engine.py -q` | **46 passed** — matches §M2 / 190-01 / 190-02 / 190-07 / 190-08 exactly |
| 190 + 189 regression group, **without** this file | **151 passed, 4 failed** |
| 190 + 189 regression group, **with** this file | **168 passed, 4 failed** — 151 + 17, same 4 |
| `pytest tests/unit/test_189_no_egress.py -q` | acronym fence **GREEN**; 1 failed / 22 passed (the known 190-13 RED) |
| `git diff --numstat HEAD~2 HEAD` — `requirements.txt` / `package.json` | **empty** (T-190-SC) |
| File deletions in either commit | **none** |
| `graphify update .` | **19 822 nodes / 52 065 edges** rebuilt (untracked artefact; no git impact) |

**Known pre-existing REDs, unchanged and not regressions** (both owed by **190-13**, recorded
identically by 190-02 / 190-06 / 190-07 / 190-08): the three `test_190_egress_ordering.py`
cases and `test_189_no_egress.py::test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress`.
The count is **4 either side of this plan**, derived by running the group with and without the
new file rather than asserted.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-10-ADF | `_plain_text_to_adf` takes a STRING and raises `JiraDocumentRefused` on anything else, driven through `send` (the real path) as well as directly, across four hostile shapes. **PLANT A observed RED, and its captured log shows the author's document filed as `OPS-17`** — the plant reaches the property, checked rather than assumed |
| T-190-10-AUTH | The credential pair reaches the binder as a tuple, asserted on the recorded call; the source fence over the encoding vocabulary **and the credential header's name** is case-insensitive and its matcher is proved non-inert on a planted haystack first. Zero occurrences in the file |
| T-190-10-STATUS | Jira's own status codes drive the verdict, plus two gates the plan did not ask for. A source fence asserts no `_check_response`-shaped helper and no import from a sibling adapter module, matcher proved non-inert; `dir(protocol)` is additionally asserted to contain no such helper, so the absence is a decision rather than an omission. **PLANT B observed RED** |
| T-190-10-WORD | 401 asserted into `rejected` and asserted **not** `refused`; 403 and 404 asserted into `rejected`; a transport miss into `unreachable` with `raw_status is None`; an `EgressRefused` asserted to propagate with its `reason_code` intact. `FAILURE_BUCKETS` is closed and checked at the raise site |
| T-190-10-D18 | Exactly one call reaches the binder on a failure, asserted — with the recorder's **second queued response a SUCCESS on purpose**, so an adapter that tried again would have reported a created ticket rather than failing noisily. No retry, no backoff, no idempotency key, no queue, asserted per line |
| T-190-10-A1 | Recorded below for SECURITY.md with its trigger, and the failure path degrades safely — an envelope in an unexpected shape falls back to the reply's own decoded text, verbatim, rather than to silence |
| T-190-SC | **Zero installs.** No Jira SDK (one would construct its own client and break D-05); `json` and `logging` are stdlib, `pydantic` and the egress binder were already declared. `git diff --numstat` over both commits prints nothing |

## ⭐ Assumptions for SECURITY.md — A1 (inherited) and A2 (new, measured here)

### A1 — the error-envelope shape is not driven against a live Jira

> **Status:** accepted assumption, fenced by a safe fall-back. Inherited from RESEARCH §R12's
> own MEDIUM-confidence marker and this plan's `<interfaces>` note.
>
> **The assumption.** Jira answers a failed create with a real HTTP status code and a body
> shaped `{"errorMessages": [...], "errors": {"<field>": "<message>"}}`. Atlassian's docs state
> the status-code half directly; the exact body shape is **not driven against a live account**
> (D-30's blocking dependency — no throwaway Jira site exists yet).
>
> **What breaks if it is wrong.** The verdict does **not** break: gate 1 (status) and gate 3
> (issue key) are independent of the envelope's shape, so a create that failed still fails.
> What degrades is the WORDING — `_provider_words` would fall back to the reply's own decoded
> text instead of the two rendered arrays. That is still verbatim and still the host's words
> (071-A holds); it is simply less readable.
>
> **Trigger:** the first live `create_ticket` UAT row (D-30). Capture the real failure body,
> compare it against `JIRA_ERROR_ENVELOPE` in `tests/unit/test_190_jira_adapter.py`, and
> correct `_provider_words` / `_carries_error` if it differs.

### A2 — an unreadable reply after a create leaves the outcome genuinely unknown

> **Status:** accepted residual, named. **New in this plan** — it follows from D-18 rather than
> from any defect.
>
> **The situation.** `send_pinned_http` raises `EgressResponseTooLarge` or
> `EgressResponseUndecodable` when the reply exceeds its cap or carries an encoding the guard
> will not expand. On the `create_ticket` path that can only happen **after the POST has left**,
> so the issue may or may not exist and the reply that would have said which is unreadable.
>
> **Why it is not painted with a §4d heading.** Neither is a §4d state: the host answered, so it
> is not *unreachable*, and it was not a refusal of ours, so it is not *refused*. Both therefore
> propagate unchanged rather than being flattened into a word that would be false.
>
> **Why it is not resolved by a retry.** D-18 forbids one, and correctly: Jira's create endpoint
> takes no idempotency key at this scope, so a second attempt would file a second ticket. The
> honest outcome is that the run fails and **a human decides**, which is what D-18 says should
> happen.
>
> **Trigger:** a live `create_ticket` UAT row that ends in either terminal, or the first report
> of a duplicate ticket from one run (`190-CONTEXT.md`'s own re-open trigger for idempotency
> keys). Either one is the moment to reconsider D-18's deferral, not before.

## Known Stubs

**None in this plan's own output.** Every function in `jira_adapter.py` is wired to a real code
path; nothing returns a hardcoded empty value and no placeholder text exists. Two things are
**deliberately absent** rather than stubbed, and both belong to named plans:

- `slack_adapter.py` (190-11). Its registry entry exists now by design and currently raises
  `ModuleNotFoundError` when resolved — the honest state. **Two of the three capabilities now
  resolve to a real adapter**; 190-14's fence turns the third into a promise with a date on it.
- The executor wiring that actually sends (190-13). Until it lands, this adapter is reachable
  only through the registry and its own suite — which is why the four known REDs above are
  still red, and why CONN-02 is **not** marked complete here.

## Threat Flags

**None outside this plan's `<threat_model>`.** No network endpoint, no auth path, no file
access and no schema change was opened. The adapter is new outbound-capable code, which is
exactly what ADF / AUTH / STATUS / WORD / D18 / A1 were written against, each dispositioned
above. **One new surface is named rather than left implicit** — the outbound create carries
composed workflow text into a third-party renderer, which is precisely why the document is
built here and never accepted from the author.

## Scope / rule notes

- **D-32 scope fence honoured:** Jira only. No fourth capability, no catalog, no webhook, no
  OAuth authorization-code flow, no service account, no retry / idempotency key / queue, no
  expression language, no migration, no router change, no frontend file opened. **190-09's
  `D-190-DEF-07`** (the UI-SPEC §2h banner/gate conflict) belongs to 190-16 / 190-18 and was
  deliberately not touched here.
- **CLAUDE.md provider-docs-first:** honoured through §R12's Atlassian citations, with the
  Context7 / `ctx7` unavailability stated rather than silently skipped (see the section above).
- **CLAUDE.md `graphify update .`** run after the production-source change (`graphify-out/` is
  untracked, so no artefact entered either commit).
- **G-5 hot-file ledger:** `backend/app/services/connectors/` is 3 plans old (190-08, 190-09's
  router lives elsewhere, 190-10) and `jira_adapter.py` is **new** — 0 prior phases. No ledger
  row applies and none is added; a row for a one-plan-old file would be noise.
- **No `xfail`, `skip` or `skipif`** in the new test file (`grep -cE` → 0).
- **The 189 acronym fence is untouched and green** — the three-letter acronym is spelled
  nowhere in either new file.

## Next Phase Readiness

**Ready.** What downstream plans inherit and owe:

| Owed by | What |
|---|---|
| **190-11** (Slack) | `AdapterResult.ok` is the adapter's OWN verdict. Slack's contract is the **opposite** of the one implemented here: a `200` with `{"ok": false}` is a FAILURE, and `raise_for_status()` shape is WRONG there. **Do not import anything from this file** — `test_jira_and_slack_do_not_share_a_response_checker` will go red, and the fence's matcher is proved non-inert |
| **190-11** | The plant lesson, now with a second data point: read the CAPTURED LOG to confirm the plant reached the property. PLANT A's `one issue created (key=OPS-17)` is what makes it evidence rather than an assertion about an assertion |
| **190-13** | `await get_adapter("create_ticket").send(args={"summary": …, "description": …}, credential=…, config=…)`. `config` is the CONNECTION ROW's config (`base_url` / `project_key` / `account_email`). Catch `protocol.AdapterError`; `JiraCreateFailed` carries `.result` (an `AdapterResult` with `ok=False`, `provider_message` verbatim, `raw_status`) and `.bucket` (one of §4d's three). **`EgressRefused`, `EgressResponseTooLarge` and `EgressResponseUndecodable` pass straight through** and are not `AdapterError` subclasses — catch them separately or they escape |
| **190-13 / the check endpoint** | `check()` has THREE exits by design: `EgressRefused` (refused), `JiraUnreachable` (unreachable), and `AdapterCheckResult(ok=False)` (rejected — and **only** rejected, which is what makes §5b's sentence honest). Do not collapse them into one `ok=False` |
| **190-14** | The banned-token tuple and its non-vacuity control are in `test_190_jira_adapter.py` and can be lifted verbatim. ⚠ **Add the credential-encoding tokens for HTTP adapters, and match them CASE-INSENSITIVELY** — a lowercase header key is the same hand-built header, and a case-sensitive walk passes over it |
| **`/gsd:secure-phase`** | T-190-10-ADF and the T13 property each have a driven falsification whose log line shows the threat happening. A1's and A2's SECURITY.md blocks are drafted verbatim above, each with its trigger |

**Two things not to re-litigate:** (1) `send` hands the RAW `description` to the builder on
purpose — adding a string check in front of it moves the fence off the real path and makes
PLANT A unreachable; (2) `issuetype` is a constant because the shipped config model forbids the
field, not because nobody thought about it.

## State bookkeeping — hand-edited, and why

**The SDK state verbs were NOT called.** D-190-DEF-01 has four recorded occurrences this phase,
the most recent (190-06) where both verbs *reported doing nothing* while deleting 39 lines
including `stopped_at` and three history blocks. `STATE.md` and `ROADMAP.md` were copied aside
first and edited by hand, per the plan-03/04/05/06/07/08/09 convention, then diffed.

**`REQUIREMENTS.md` deliberately NOT marked.** CONN-02 and CONN-03 are marked **together at
phase close** (the convention D-190-DEF-02 set at 190-01 and every plan since has followed).
CONN-02 is unmet until the third adapter exists and 190-13 wires the send; claiming it here
would assert a capability that does not exist, in the phase whose whole discipline is not
over-claiming.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/services/connectors/jira_adapter.py` | FOUND (631 L) |
| `backend/tests/unit/test_190_jira_adapter.py` | FOUND (719 L) |
| `.planning/…/190-10-SUMMARY.md` | FOUND |
| commit `68a24aea` (Task 1) | FOUND |
| commit `aeaab93f` (Task 2) | FOUND |
| No file deletions in either commit | CONFIRMED |
| `grep -c PLANT` adapter / test file | 0 / 0 |
| Suite green | 17 passed, 0 failed |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
