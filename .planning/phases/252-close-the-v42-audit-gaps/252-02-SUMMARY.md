---
phase: 252-close-the-v42-audit-gaps
plan: 02
subsystem: security
tags: [connectors, oauth, rfc7591, pydantic, logging, credential-boundary, mcp]

requires:
  - phase: 248
    provides: "_validate_custom_client_id / CustomClientId — the inbound credential-smell boundary this plan stops two seams from defeating"
  - phase: 222
    provides: "the RFC 7591 dynamic-registration block and store_oauth_client_credentials, the single OAuth-application write seam"
provides:
  - "The degraded _to_response fallback logs field errors without input values — the refused credential no longer reaches the application log"
  - "store_oauth_client_credentials applies the shipped validator at the single write seam, so a server-minted client_id that the inbound boundary refuses can never be stored"
  - "ConnectorClientIdRefused — a named refusal the DCR route catches by name and answers 422"
  - "A degraded connection row now names its own repair instead of saying 'validation failed'"
  - "A measured disposition of the audit's 'only place in the codebase' claim, with one same-class sibling named"
affects: [connector OAuth, MCP connect flow, connections list, any future custom_client_id writer]

tech-stack:
  added: []
  patterns:
    - "Validate at the WRITER when the value does not arrive through a request model"
    - "A refusal message carries the RULE, never the value"
    - "A by-name except arm precedes any generic arm for a subclass refusal"

key-files:
  created:
    - backend/tests/unit/test_252_credential_boundary.py
  modified:
    - backend/app/services/connector_service.py
    - backend/app/api/connectors.py
    - backend/tests/unit/test_connector_credential_boundary.py

key-decisions:
  - "D-08 applied: e.errors(include_input=False) — the log names the field and the rule, never the value"
  - "D-09 corrected: the plan's sk-live- probe is masked by the shipped logging redactor and reports a FALSE GREEN; the drive uses two shapes outside the redactor's four patterns"
  - "D-10 measured: 104 logger-with-exception sites in backend/app; exactly ONE is the same class as B-2 and it carries document text, not a credential"
  - "D-11 applied: validation at store_oauth_client_credentials; no fourth request model added"
  - "D-12 applied: 422 naming the server and the repair, never the 'does not offer to create one' sentence, never the value"
  - "D-13 applied: the degraded error_message names the repair that already existed structurally"
  - "The plan's ordering criterion is satisfied VACUOUSLY, not substantively: start_mcp_oauth has no generic ConnectorError arm at all"

patterns-established:
  - "A leak probe must be chosen against the redaction filter that is actually installed, or the test proves the redactor works rather than that the code is safe"
  - "A no-write assertion (writer.await_count == 0) accompanies every 'it raised' refusal test"

requirements-completed: [CRED-01]

duration: 78min
completed: 2026-09-16
---

# Phase 252 Plan 02: The Credential Boundary, Both Directions — Summary

**The refused `custom_client_id` stopped being written to the application log (five copies per read, measured), a remote server's non-compliant `client_id` is now refused at the single write seam instead of bricking the connection forever, and a row that is already bricked names its own repair.**

## Performance

- **Duration:** ~78 min
- **Tasks:** 3 of 3
- **Files modified:** 4 (2 source, 2 test)
- **Base:** `53e2435b7` (asserted; the worktree arrived on `84e3b020f` as warned and was reset)

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `72a37aa66` | B-2 — the degraded fallback stops logging the credential |
| 2 | *(none — sweep, no code change)* | the sibling sweep; result below |
| 3 | `78cddb5cd` | B-3 — validate at the write seam, refuse by name, name the repair |

---

## Task 1 — B-2, the credential in the log

### ⭐ The pre-fix figure is **5**, not six — and the way it was obtained is the finding

```
E       AssertionError: the refused credential is in the log 5 time(s)
E       assert 5 == 0
E        +  where 5 = <built-in method count of str object at 0x...>('Zq8~BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
E        +    where <built-in method count ...> = <_pytest.logging.LogCaptureFixture object>.text
```

`ConnectorConnectionResponse.config` is a **five**-member union (`SendEmailConfig | CreateTicketConfig | PostMessageConfig | McpConfig | OAuthConnectionConfig`), and pydantic renders `input_value=` once per arm, so **five** is what the union arithmetic predicts. The audit's *six* was not reproduced; the plan's instruction to "reproduce it or report what you actually got" is answered with **5**, independently confirmed outside pytest with a bare `StreamHandler` (`COUNT_FULL 5`).

### ⛔ THE PLAN'S CHOSEN PROBE REPORTS A FALSE GREEN — corrected, not worked around

The plan specifies `SECRET = "sk-live-" + "A"*40`. Driven verbatim, **Case 1 PASSED its leak assertion before any fix**:

```
CASE sk_prefix     COUNT 0    TEXTLEN 4111
CASE entra_tilde   COUNT 5    TEXTLEN 4302
CASE secret_prefix COUNT 5    TEXTLEN 4261
CASE over_128      COUNT 0    TEXTLEN 4306
```

Cause, measured rather than reasoned — `backend/app/services/logging_sink.py:84`:

```python
(re.compile(r"sk-[A-Za-z0-9_\-]{6,}"), "sk-***REDACTED***"),
```

`_RedactingFilter` sets `record.msg` to the redacted string and `record.args = ()`, and it sits on the root logger's `RotatingFileHandler`, which is **first** in the handler list:

```
ROOT_HANDLERS [('RotatingFileHandler', ['_RedactingFilter']), ('_LiveLoggingNullHandler', []),
               ('_FileHandler', []), ('LogCaptureHandler', []), ('LogCaptureHandler', [])]
```

So every later handler — caplog's included — sees the masked text. **A test built on the plan's probe would have proved the redactor works, not that the code is safe.** Three consequences, all of them why the fix still had to land:

1. The redactor knows **four** shapes (`sk-…`, URL credentials, `Bearer …`, `eyJ…`). `_validate_custom_client_id` refuses **thirteen prefixes + `~` + `len > 128`**. The overlap is partial; everything outside it leaked in full.
2. The sink is **opt-in** (`install_file_log_sink` returns `None` with `LOG_FILE_PATH`/`BACKEND_LOG_FILE` unset). On a default deployment there is **no filter at all**, and the `sk-` shape leaks five times too — measured directly with a bare handler and no app import.
3. `over_128` reads 0 for an unrelated reason: pydantic truncates a long `input_value` in `__str__`. Not a fence — an accident of length.

The suite therefore drives **two** shapes the redactor cannot see: `Zq8~` + 40×`B` (the Entra `~` arm) and `secret_` + 40×`C` (the prefix arm).

### The change

`connector_service.py:~573` — `e` → `e.errors(include_input=False)`, with the SEED-239 / TM-248-05 lines kept intact and a B-2 block added beneath them recording the measured reason and that the redactor is *not* the fence here.

### Acceptance

| Criterion | Result |
|---|---|
| Case 1 failed before the change, figure quoted | ✅ `5` |
| `pytest -k "leak or control"` | ✅ 2 passed |
| `grep -c "e.errors(include_input=False)"` | ✅ **1** |
| bare exception passed to a logger in this file | ✅ **0** |
| degraded object still `status="error"` + `error_message` | ✅ asserted in Case 1 |
| control: a good row logs nothing, isn't degraded | ✅ passed **before and after** |

---

## Task 2 — the sibling sweep

### ⛔ The plan's first grep is STRUCTURALLY INCAPABLE OF MATCHING, and it was run to prove it

```bash
grep -rn "logger\.\(warning\|error\|info\|exception\|debug\)" -A 6 backend/app --include=*.py \
  | grep -nE "^\s*[0-9]+-\s+(e|exc|err|ex),?\s*$"
```

Full output:

```
(no output)   EXIT=1
```

It cannot match: with `-r`, `grep -A 6` prefixes each context line with **`path-lineno-`**, so the follow-on `^\s*[0-9]+-` anchor never fires. ⚠ **A sweep that finds nothing because it cannot find anything is exactly the "claim needs a measurement" failure D-10 exists to prevent** — so it was replaced with an AST walk, not with a reworded grep.

### The plan's second grep, verbatim

```bash
grep -rn "ValidationError" backend/app --include=*.py | wc -l
```
```
45
```

### The sweep that can actually find something (AST over every `backend/app/**/*.py`)

Hit = a `logger.<level>(…)` call taking a bare `e`/`exc`/`err`/`ex`/`error`/`exception`, a `str()`/`repr()` of one, or an f-string interpolating one.

```
TOTAL 104
```

Classified by the handler that binds the name:

```
TOTAL sites bound by a handler: 103
[CAN-CATCH-PYDANTIC] except Exception  (89)
[narrow] except (RedisError, ConnectionError, TimeoutError, OSError)  (2)
[narrow] except httpx.RequestError  (2)
[narrow] except McpClientError  (2)
[narrow] except (McpOAuthError, EgressRefused)  (1)
[narrow] except (OSError, _json.JSONDecodeError)  (1)
[narrow] except (APIError, anthropic.APIError, google_errors.APIError)  (1)
[narrow] except (ValueError, RuntimeError)  (1)
[narrow] except zipfile.BadZipFile  (1)
[narrow] except (TypeError, ValueError)  (1)
[narrow] except AdapterError  (1)
[narrow] except (httpx.RequestError, EgressRefused)  (1)
```

**No site is bound by an explicit `except ValidationError` and logs the exception object** — after Task 1, `connector_service.py:573` is no longer one. The 14 narrow handlers cannot bind a pydantic error at all.

The decisive filter — a handler that logs the exception **and** whose own `try` body runs a pydantic parse, the only route by which a `ValidationError` can reach that call:

```
app/services/embedding_service.py:167  except Exception  (try body parses at line 164: DocumentMetadata.model_validate_json)
TOTAL 1
```

### Disposition of every hit

| Hit | Disposition |
|---|---|
| `embedding_service.py:167` — `logger.warning("Metadata extraction failed: %s", e, exc_info=True)` over `DocumentMetadata.model_validate_json` | **A leak of the same class** — a pydantic `ValidationError` rendered with `%s`, so `input_value` (the LLM's raw JSON over document text) reaches the log. ⛔ **NOT fixed — outside §8's scope.** The data is document content, not a credential, so the audit's claim survives as stated; recorded here as a finding for VERIFICATION and a seed candidate. |
| The other 88 `except Exception` sites | **Not a leak of this class** — no pydantic parse in the guarded body, so the bound exception cannot echo a model `input_value`. (Mechanically established by the filter above, not eyeballed.) |
| 14 narrow-handler sites (`httpx.RequestError`, `McpClientError`, `zipfile.BadZipFile`, …) | **Not a leak** — the bound type cannot be a pydantic error. |
| `connectors/jira_adapter.py:263`, `slack_adapter.py:212`, `smtp_adapter.py:181` — the only explicit `except ValidationError` clauses touching connector config | **Not a leak, and they are the correct pattern already**: each builds its message from `exc.error_count()` and the field `loc` names, never `input_value`, and re-raises `from None`. |
| `tool_dispatcher.py:970`, `:983` — `f"…{e}"` over `ViewFilter.model_validate` | **Same class, different boundary and different data** — it is returned to the *agent* as a tool result, never logged, and the input is a saved/inline filter shape, not a credential. ⛔ Not fixed; named. |
| `harness/validators.py:144`, `validator_kinds.py:498` | **Not this class** — `jsonschema`, and only `e.message` is taken, never the exception. |

**Verdict on the audit's claim.** *"Currently the only place in the codebase that writes a refused credential to disk"* is **measured TRUE for credentials.** It is **not** true that it is the only place a pydantic `ValidationError` is rendered into a log: `embedding_service.py:167` is one, and it carries document text. ⚠ The claim is reported at exactly the width the sweep covers — `backend/app/**/*.py`, logging calls only — and is not widened.

*No source file was edited by this task, so it carries no commit.*

---

## Task 3 — B-3, the write seam

### RED, Case 3 (the bypass at the writer)

```
E       AttributeError: module 'app.services.connector_service' has no attribute 'ConnectorClientIdRefused'
tests\unit\test_252_credential_boundary.py:170: AttributeError
```

### ⭐ RED, Case 5 (the route) — the bypass driven end to end, and it is worse than "no validation"

```
>       assert res.status_code == 422, res.text
E       AssertionError: {"authorize_url":"https://auth.example.com/authorize?client_id=Zq8~BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fconnectors%2Fmcp%2Foauth%2Fcallback&response_type=code&state=…&code_challenge=…&code_challenge_method=S256","authorization_host":"auth.example.com"}
E       assert 200 == 422
```

The route answered **200 OK**, wrote the value, and handed the caller an `authorize_url` with the refused credential interpolated into it. The connection would then have failed `model_validate` on every subsequent read, forever.

### RED, Case 1 extended (D-13, the repair sentence)

```
E       AssertionError: assert 'application id' in 'connection configuration requires update (validation failed)'
```

### Controls — both passed BEFORE and AFTER

- **Case 4** (`…writes_exactly_as_it_did_before`) passed at RED time and still passes: `config.custom_client_id` written, `custom_client_secret` swept, secret encrypted to its own column, update scoped by `org_id` **and** `id`. This is what proves the boundary was added rather than the door closed. (`_validate_custom_client_id` returns `value.strip()`, so a compliant id is byte-identical to what `client_id.strip()` wrote before.)
- **Case 2** (`control_a_good_row…`) likewise green throughout.

### The change, in four parts

- **(a)** `ConnectorClientIdRefused(ConnectorError)` joins the hierarchy, in its siblings' voice, carrying the "catch me ahead of any generic arm" sentence `ConnectorNothingToDiscover` carries.
- **(b)** `store_oauth_client_credentials` calls the shipped `_validate_custom_client_id` **before** the row fetch and before `config["custom_client_id"] = …`, converting `ValueError` → `ConnectorClientIdRefused` with the validator's own (non-echoing) message.
- **(c)** One `try` / one `except … ConnectorClientIdRefused` around the existing `store_oauth_client_credentials` call in the DCR block → `HTTPException(422)`.
- **(d)** The degraded `error_message` now reads *"The application id saved for this connection is not valid. Enter an application id in this connection's settings to replace it."*

### ⚠ The ordering criterion is satisfied VACUOUSLY, and that is a correction to the plan

Both line numbers, as demanded:

| | Line | Handler |
|---|---|---|
| by-name arm | **1361** `except connector_service.ConnectorClientIdRefused:` | `start_mcp_oauth` (1267–1405) |
| nearest generic arm | **1063** `except connector_service.ConnectorError as exc:` | **`discover_tools` (1028–1076)** |

`1361 > 1063` numerically, but the criterion is about *the same handler*, and **`start_mcp_oauth` has no generic `ConnectorError` arm at all** — established by AST, not by reading:

```
discover_tools lines 1028 - 1076
    1051 connector_service.ConnectorNotFound
    1053 connector_service.ConnectorCipherUnavailable
    1055 connector_service.ConnectorSecretNotEncrypted
    1057 connector_service.ConnectorDisabled
    1061 connector_service.ConnectorNothingToDiscover
    1063 connector_service.ConnectorError
    1070 Exception
start_mcp_oauth lines 1267 - 1405
    1361 connector_service.ConnectorClientIdRefused        ← the ONLY except in this function
```

So **the trap the plan warns about cannot fire here today**. The by-name arm and its comment are kept anyway, because the hazard is real the moment anyone adds a generic arm to this route — which `:1060` records already happening once in this file.

### G-5 — honoured by construction (seventh landing on `connectors.py`)

```
 backend/app/api/connectors.py | 34 ++++++++++++++++++++++++++++------
 1 file changed, 28 insertions(+), 6 deletions(-)
```

- New routes: **0**. New helper functions: **0** — proven by `git diff … | grep -E "^\+.*(@router\.|^\+(async )?def )"` returning **nothing**.
- The six changed lines are the existing `await connector_service.store_oauth_client_credentials(...)` call re-indented into a `try`.
- `if not client_id and probe.registration_endpoint:` and the comment block above it (the live-drive-against-`mcp.notion.com` decision) are **byte-unchanged** — the only diff line mentioning `does not offer to create one` is the new comment saying not to reuse it.
- File: 2140 → **2162** lines.

### Acceptance

| Criterion | Result |
|---|---|
| Cases 3, 4, 5 red before their change, failures quoted | ✅ above |
| `pytest test_252_credential_boundary.py -q` | ✅ **5 passed** |
| `grep -c "_validate_custom_client_id"` in the service | ✅ **4** (≥1) |
| `grep -c "def _validate_custom_client_id"` in the service | ✅ **0** — reused, never copied |
| `grep -c "class ConnectorClientIdRefused"` | ✅ **1** |
| by-name arm precedes any enclosing generic arm | ✅ (vacuously — see above; both line numbers recorded) |
| DCR decision + comment untouched | ✅ |
| no new route, no new helper | ✅ |
| `failed ≤ 71`, every id in the baseline file | ✅ **71**, set-diff clean |

---

## Gates

| Gate | Verdict |
|---|---|
| `pytest tests/unit/test_252_credential_boundary.py -q` | **5 passed** |
| Targeted connector suites (7 files) | **88 passed** |
| `pytest tests/unit -q --continue-on-collection-errors` | **71 failed · 4869 passed · 2 xfailed · 2 xpassed · 0 collection errors** |
| Backend set-diff vs `252-BASELINE-backend-failures.txt` | **0 new · 0 gone** |
| `node scripts/check-hot-file-ledger.cjs 252` | `ledger gate OK` — 281 rows · subject 31 files · watched 13 |

**The `passed` figure moved 4864 → 4869: exactly the five tests this plan adds.** `failed` is **71**, on the ceiling with zero headroom, as at base.

### The set diff, in full

```
baseline ids: 71   now ids: 72
--- NEW (failing now, not in baseline) ---
   tests/unit/test_252_credential_boundary.py::test_the_degraded_fallback_does_not_write_the_credential_to_the_log
--- GONE (in baseline, not failing now) ---
   (none)
```

⚠ **The 72nd id is a STALE `.pytest_cache` entry, not a failure**, and it was proven rather than assumed: it is the **pre-rename** name of Case 1 (renamed so the plan's `-k "leak or control"` selector resolves), and running that node id directly collects **nothing**. The run itself reported `71 failed`. ⭐ Recorded because a count-only comparison would have read `72` and blamed the plan — the exact trap `feedback_capture_the_set_never_a_tail` names.

---

## Deviations

### [Rule 1 — Bug] The plan's `sk-live-` probe is masked by the shipped redactor
Found during Task 1. Using it verbatim, the leak assertion passed before any fix. Corrected by choosing two refused shapes outside `logging_sink._RedactingFilter`'s four patterns. Measured evidence above. **Files:** `test_252_credential_boundary.py`. **Commit:** `72a37aa66`.

### [Rule 3 — Blocking] The plan's sibling-sweep grep cannot match
Found during Task 2. `grep -r -A 6` prefixes context lines with the path, defeating the `^\s*[0-9]+-` anchor. Both the verbatim command (with its empty output) and an AST replacement are reported. **No files changed.**

### [Rule 3 — Blocking] A shipped fence pinned the old `error_message` verbatim
`test_connector_credential_boundary.py::test_to_response_degrades_safely_on_invalid_stored_config` asserted `"validation failed" in resp.error_message` — necessarily red once D-13 re-worded the sentence. The SEED-239 property it guards (a bad row degrades instead of 503-ing the org) is untouched; the assertion moved to the repair the row now names, and gained a third assertion that the stored value is **not** echoed. ⚠ This file is outside the plan's `files_modified`; leaving it red would have broken the zero-headroom ceiling. **Commit:** `78cddb5cd`.

## Where the code disagreed with the plan

| Plan says | Measured |
|---|---|
| "measured at six occurrences" | **5.** Five union arms, five renders — confirmed twice, in and out of pytest. |
| `SECRET = "sk-live-" + "A"*40` "trips the shipped `known_secret_prefixes` arm, so the real validator refuses it" | True of the validator, but the **logging redactor masks it**, so the leak assertion passes pre-fix. False green. |
| `connector_service.py:571-588` is the leak site | Correct, at **`:571-588`** pre-change (now `:571-601`). |
| "`store_oauth_client_credentials`… its own docstring records that an earlier draft called **two helpers that do not exist**" | **That sentence is in `connectors.py`'s DCR comment block (`:1340-1345`), not in the service docstring.** The service docstring records the blank-never-overwrites rule instead. Both were read; nothing depended on the mix-up. |
| "the by-name `except` must come ahead of any generic `except ConnectorError` arm" in this handler | **There is no generic arm in `start_mcp_oauth`.** The nearest is `:1063`, in `discover_tools`. Criterion holds vacuously; the arm and its comment are kept for the future. |
| `connectors.py` "44 / 21 / 2140" (ledger) | 2140 → **2162** after this plan. |

## Not done / owed

- ⛔ **`embedding_service.py:167` is NOT fixed** — a same-class pydantic-into-the-log site carrying document text. Named here, deliberately out of §8's scope, and offered as a VERIFICATION finding / seed candidate.
- ⛔ **`tool_dispatcher.py:970/983`** render a pydantic `ValidationError` into an agent-visible tool result. Same class, different boundary. Named, not fixed.
- ⛔ **The live consent leg of the G-4 S2 row stays OWED** (D-14) — this plan drove the code-level proof only: refusal + no write + a nameable repair, through the real route.
- ⚠ **`connectors.py`'s extraction is still OWED** — this is its seventh landing, honoured by construction (one `except` arm), not discharged.
- ⚠ The plan's `must_haves.artifacts.contains: "caplog"` holds; `key_links` both hold (`_validate_custom_client_id` imported from `app.models.connector` at the write seam; `ConnectorClientIdRefused` caught in `connectors.py`).

## Self-Check: PASSED

- `backend/tests/unit/test_252_credential_boundary.py` — FOUND
- `backend/app/services/connector_service.py` — FOUND (modified)
- `backend/app/api/connectors.py` — FOUND (modified)
- `backend/tests/unit/test_connector_credential_boundary.py` — FOUND (modified)
- commit `72a37aa66` — FOUND
- commit `78cddb5cd` — FOUND
