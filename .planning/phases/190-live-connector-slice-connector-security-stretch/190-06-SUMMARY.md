---
phase: 190-live-connector-slice-connector-security-stretch
plan: 06
subsystem: backend-security
tags: [pydantic, credentials, cipher, fail-closed, multi-tenancy, org-scoping, conn-03, red-first, wave-2]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 01
    provides: "the W0-2 cross-org drive that fixes resolve_connection's contract by drive, and the debt it declared: a MEANINGFUL RED owed by whichever plan lands connector_service"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 03
    provides: "public.connector_connections (migration 116) — the twelve-column table whose column list is the models' source of truth"
provides:
  - "backend/app/models/connector.py — the CRUD trio + three per-capability NON-secret config models, all extra='forbid'"
  - "ConnectorConnectionResponse — a response model that STRUCTURALLY cannot carry a secret (VALIDATION T7's real gate)"
  - "ExternalActionPhaseConfig.connection_id — D-13's ONE additive-optional field, zero migration, standing refusal comment extended in the same commit"
  - "backend/app/services/connector_service.py — org-scoped resolve + CRUD + D-11's fail-CLOSED inversion at BOTH ends"
  - "ResolvedConnection — a frozen, repr-redacting credential carrier with a lazily materialized secret"
  - "backend/tests/unit/test_190_credentials.py — eight cases, seven driven RED against real plants in production source"
  - "THE D-14 LEAK, OBSERVED: an id-only resolver handing org A org B's decrypted bot token, recorded verbatim in two places"
  - "The permanent id-only regression guard — an UNSCOPED storage layer still cannot leak, because the resolver re-checks the row's own org"
affects: [190-07, 190-08, 190-12, 190-13, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scope at the query AND re-check the returned row — the SQL predicate is the gate, the post-fetch check is what survives a future author simplifying the query"
    - "A response projection DERIVED from the response model's own fields, so a new column cannot reach a client without a reviewable diff"
    - "Fail-CLOSED by INVERSION of a shipped fail-OPEN helper, with the inverted lines quoted in the header so the polarity difference is legible rather than surprising"
    - "Lazily materialized secrets: both refusal gates eager, the Fernet call deferred, so a resolve-then-refuse path never produces plaintext at all"

key-files:
  created:
    - backend/app/models/connector.py
    - backend/app/services/connector_service.py
    - backend/tests/unit/test_190_credentials.py
  modified:
    - backend/app/models/harness.py
    - backend/tests/unit/test_190_cross_org_credential.py

key-decisions:
  - "resolve_connection scopes by org at the query AND re-checks the returned row's org — the second gate is what makes the property survive a future fetch seam whose SQL loses the predicate, and it is driven by its own test"
  - "The plaintext is materialized LAZILY on ResolvedConnection.secret. FORCED BY MEASUREMENT: the W0-2 fixture's ciphertext is a sentinel, not a real Fernet token, so an eager decrypt cannot satisfy the drive's non-vacuity control at all. The drive was NOT edited to suit the code"
  - "Both D-11 read gates stay EAGER (no envelope -> refuse; envelope with no key -> refuse), so nothing about the fail-closed property moved when the decrypt did"
  - "config is typed per capability rather than a free dict, so config['smtp_password'] is unconstructable rather than discouraged — SendEmailConfig carries the host and the port and has nowhere to put a password"
  - "PostMessageConfig takes NO url of any kind (D-02): Slack's host is a module constant, so one of the three destinations is unforgeable by construction"
  - "ConnectorDisabled is a SEPARATE refusal from ConnectorNotFound, and that is safe: the caller provably reads the row already (it is in their org), so naming its state discloses nothing across the boundary"
  - "ConnectorSecretUnreadable refuses an undecryptable envelope rather than degrading — secret_cipher's fail-SOFT for app_settings exists because an env fallback follows it; a tenant credential has no fallback"
  - "base_url lives on the CONNECTION ROW (CreateTicketConfig), never on the step config — settling the open question 190-01 recorded. ExternalActionPhaseConfig gained connection_id and NOTHING else"

patterns-established:
  - "Record a plant's RED transcript BELOW the import it describes, so a docstring's own measured line numbers cannot be falsified by the act of recording"
  - "When a recorded transcript IS falsified by its own paste, state the drift and re-derive command rather than editing the quoted output — an edited transcript is not a transcript"
  - "A log-discipline test is worthless without a positive control that pushes the sentinel through the SAME capture and asserts it is found"

requirements-completed: [CONN-03]

# Metrics
duration: 78min
completed: 2026-08-08
---

# Phase 190 Plan 06: The Credential Layer Summary

**The D-14 cross-org leak was REPRODUCED — an id-only resolver handed org A org B's decrypted bot token — and only then closed, by an org-scoped query PLUS a post-fetch re-check that survives a future author deleting the predicate; with the shipped cipher inverted to fail-CLOSED at both ends, a response model that structurally cannot carry a secret, and seven of eight test cases driven RED against real plants in production source and restored md5-identical.**

## Performance

- **Duration:** ~78 min
- **Completed:** 2026-08-08
- **Tasks:** 3, each committed individually
- **Files:** 5 (3 created, 2 modified) — 1 269 lines created, 93 inserted into existing files, **0 deleted**

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The models — `connector.py` + the ONE additive-optional `connection_id` | `09808f6d` |
| 2 | `connector_service` — id-only resolver authored FIRST, leak observed, then scoped | `e1694006` |
| 3 | `test_190_credentials.py` — D-11 both ends, T5, T7, and the D-14 belt | `994d8028` |

---

# ⭐ THE STEP-1 LEAK OBSERVATION (this plan's headline deliverable)

Plan 190-01 declared the debt in as many words: *"the MEANINGFUL RED is owed by the plan that lands `connector_service`… A file that only ever showed `ModuleNotFoundError` has measured the import system, not the tenant boundary."* This is that plan, and the debt is paid **twice**, because one observation alone would have been misleading.

### (A) THE LEAK ITSELF — the id-only resolver against a faithful `WHERE id = $1` fetch

The committed drive stubs a **correctly scoped** storage layer (190-01's deliberate choice, so the drive measures the resolver rather than the stub). That choice means the leak cannot be *seen* through it — only inferred from a refusal. So the id-only resolver was additionally driven against the real thing: a fetch that filters on the id alone and returns whatever row carries it, with a **real Fernet token**. Verbatim:

```
CALLER ORG (the RUN's org) : aaaaaaaa-0000-4000-8000-000000000001
ROW OWNER ORG              : bbbbbbbb-0000-4000-8000-000000000002
RESOLVED SECRET FOR ORG A  : xoxb-ORG-B-REAL-BOT-TOKEN-NEVER-CROSS-A-TENANT
LEAKED                     : True
```

**Org A's run held org B's decrypted bot token.** D-14, reproduced in this module, before it was closed. After the fix, the same probe raises `ConnectorNotFound` — the post-fetch org check catches it even though the storage layer never scoped anything.

### (B) THE COMMITTED DRIVE CATCHING THAT SAME RESOLVER

`cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_cross_org_credential.py -q` → **2 failed, 1 passed**:

```
>       assert _fetch_calls == [(CONNECTION_OWNED_BY_ORG_B, ORG_A)], (
E       assert [('cccccccc-0...0000b', None)] == [('cccccccc-0...00000000001')]
E         At index 0 diff: ('cccccccc-0000-4000-8000-00000000000b', None)
                != ('cccccccc-0000-4000-8000-00000000000b', 'aaaaaaaa-0000-4000-8000-000000000001')
tests\unit\test_190_cross_org_credential.py:190: AssertionError

FAILED tests/unit/test_190_cross_org_credential.py::test_a_connection_id_from_another_org_does_not_resolve
FAILED tests/unit/test_190_cross_org_credential.py::test_the_same_connection_id_DOES_resolve_for_its_owning_org
```

**Which assertion fired is the lesson.** Not `pytest.raises` — the leaking resolver *satisfied* that, because an unscoped lookup handed `None` to a scoped stub and got nothing back. It was the **recorded-fetch-call** assertion (the one 190-01 called load-bearing), and the **non-vacuity** case failed in the same run. Either alone would have been green over a leaking resolver. Both earned their keep.

After STEP 2: **3 passed.**

Both transcripts are recorded in the source itself — in `connector_service.py`'s resolver header and beneath `test_190_cross_org_credential.py`'s import — not only here.

---

## The seven plant → RED → restore cycles

Each plant was applied to **real production source**, the single case run, and the file restored. `connector_service.py` restored to `0940a04ccca68593ddea5b2c6bfcfc92` after every cycle; `connector.py` to `91beb83c92d7415ed217f5a9fc6eb713`. `grep -c PLANT` on both production files → **0**.

| # | Case | Plant | Verbatim RED |
|---|---|---|---|
| 1 | store refused with no cipher | plaintext fall-through, D-11 write guard removed | `E Failed: DID NOT RAISE <class 'app.services.connector_service.ConnectorCipherUnavailable'>` |
| 2 | plaintext at rest refused on read | `sso_provider_service`'s own `return raw` polarity | `E Failed: DID NOT RAISE <class 'app.services.connector_service.ConnectorSecretNotEncrypted'>` |
| 3 | encrypted + no key refused | the encrypted-but-no-key guard removed | `E Failed: DID NOT RAISE <class 'app.services.connector_service.ConnectorCipherUnavailable'>` |
| 5 | T5 log discipline | log the whole `row` instead of `row["id"]` / capability / config keys | `E AssertionError: T5: the stored CIPHERTEXT reached a log line.` … `E assert 2 == 0` — and the captured line contained the real envelope: `'secret_ciphertext': 'enc:v1:gAAAAABqd3jOuclchrFBGFsl2vrMBgTDSW0gBp4gPu9cI2VfzlMPeTx43IJmBxIO66Y…'` |
| 6 | T7 response model | add `secret_ciphertext: str \| None = None` to the model | **exit 4, a COLLECTION ERROR**: `app\services\connector_service.py:101: in <module>` → `E AssertionError: T7: ConnectorConnectionResponse grew a secret-bearing field … Fields: ('id', 'org_id', 'secret_ciphertext', 'capability', …)` |
| 7 | repr redaction | delete the `__repr__` override and `repr=False` | `E AssertionError: the credential is printable from a resolved connection: "ResolvedConnection(… secret_ciphertext='enc:v1:xoxb-SENTINEL-CREDENTIAL-MUST-NEVER-BE-LOGGED-190')"` |
| 8 | the D-14 belt | remove the post-fetch `row["org_id"] != org_id` check | `E Failed: DID NOT RAISE <class 'app.services.connector_service.ConnectorNotFound'>` |

**Case 6 is stronger than the plan predicted.** The plant does not produce a failed assertion — it produces a **collection error**, because `connector_service`'s module-scope projection assert refuses to import at all. The response model cannot grow a secret field and have the service start.

**Case 5's RED is the one to read.** The plaintext sentinel was *not* in the leaked line (it never is — the row holds ciphertext), so the first assertion passed and only the **ciphertext** assertion fired. A test that swept for the plaintext alone would have been green over a log line containing the credential in its stored form. That is exactly why both assertions exist, and why the docstring says a ciphertext in a log is a credential in a log with an extra step — it outlives the key rotation meant to retire it.

**Case 4 (the round trip) is the non-vacuity control** and carries no plant: without it a service that refuses everything passes cases 1–3 forever.

---

## Files Created/Modified

- **`backend/app/models/connector.py`** *(created, 225 L)* — `ConnectorCapability` (with a module-scope assert deriving agreement from `EXTERNAL_ACTION_CAPABILITIES` rather than retyping the closed set), three per-capability `extra='forbid'` config models, the closed `CONFIG_MODEL_FOR_CAPABILITY` binding with its own agreement assert, and the Create/Update/Response trio. `ConnectorConnectionCreate` has **no `org_id` and no `created_by`** — a body field for either would be a tenant-selection parameter, which is D-14 with a friendlier name.
- **`backend/app/services/connector_service.py`** *(created, 589 L)* — six refusal types, `ResolvedConnection`, the resolver, and CRUD. Header answers D-15 per call site and quotes the two inverted lines.
- **`backend/tests/unit/test_190_credentials.py`** *(created, 455 L)* — eight cases; `grep -ci "positive control"` → 7.
- **`backend/app/models/harness.py`** *(+31 / −0)* — `connection_id: str | None = None`, plus the standing no-optionals refusal block extended in the SAME commit.
- **`backend/tests/unit/test_190_cross_org_credential.py`** *(+62 / −0)* — the meaningful-RED record. **Zero deletions; no assertion, fixture or docstring claim was altered.**

## Decisions Made

1. **Two gates, not one.** `WHERE id = $1 AND org_id = $2` is the gate; the post-fetch `row["org_id"] == org_id` re-check is what survives a future author simplifying the query. Case 8 drives it with a deliberately unscoped fetch, so the belt is proved non-vacuous rather than assumed.
2. **The plaintext is materialized lazily** — forced by measurement, see the deviation below. Both D-11 read gates stay eager.
3. **`base_url` lives on the connection row, not the step config** — settling the question 190-01 left open. `CreateTicketConfig.base_url`; `ExternalActionPhaseConfig` gained `connection_id` and nothing else, which is CONN-03 SC#4 read literally.
4. **`ConnectorDisabled` is distinct from `ConnectorNotFound`**, and safely so: the caller already provably reads that row (it is in their org).
5. **`ConnectorSecretUnreadable` refuses rather than degrades.** `secret_cipher` is fail-SOFT on `InvalidToken` for `app_settings` because an env fallback follows it. A tenant credential has no fallback: a key rotated away must stop sends, not send with nothing.
6. **A local `_StrictBase`** rather than importing `models/harness.py`'s private one. A one-line `ConfigDict` cannot silently drift; the capability vocabulary can, and it is fenced by an assert instead.
7. **`org_id` / `created_by` hard-set from the caller** — the migration-116 autofill trigger is defence in depth, stated as such.

## Deviations from Plan

### 1. [MEASURED — it changed the design] An EAGER decrypt cannot satisfy the W0-2 drive at all

- **Found during:** Task 2, STEP 2, on the first green run attempt.
- **What was measured:** the drive's `ORG_B_SECRET_CIPHERTEXT` is a **greppable sentinel wearing the envelope prefix**, not a real Fernet token — and this environment **has** `SECRETS_ENCRYPTION_KEY` configured. So a resolver that decrypts eagerly fails the **non-vacuity** control regardless of how correct its scoping is:

  ```
  app\services\connector_service.py:234: in resolve_connection
      secret=decrypt_secret(raw, cipher),
  venv\Lib\site-packages\cryptography\fernet.py:206: InvalidToken
  1 failed, 2 passed
  ```

- **What was NOT done:** the fixture was not edited. A security drive is not adjusted until it passes; that is the failure mode this whole phase exists to prevent.
- **Fix:** `resolve_connection` evaluates **both** D-11 read gates eagerly (no envelope → refuse; envelope with no key → refuse) and defers only the Fernet call to `ResolvedConnection.secret`. Nothing about the fail-closed property moved. It is also a small genuine improvement: a run that resolves and is then refused egress (D-06 — the guard runs first) never materializes plaintext at all.
- **Recorded in:** the resolver's header and beneath the drive's import, not only here.

### 2. [RECORDED — an acceptance criterion this plan cannot satisfy as written]

Task 3's criterion reads *"`grep -c PLANT` … `test_190_credentials.py` prints `0` for all three"*. Its own `<action>`, in the same task, reads *"Name the plant in the test's docstring so the polarity difference from `app_settings` is legible."* **Both cannot hold.** Measured: `grep -c PLANT tests/unit/test_190_credentials.py` → **7**.

- All seven are **documentation**, verified mechanically: one module-docstring line and six case docstrings, each reading `PLANT (observed RED):`. `grep -nE "^\s*[^ #]*PLANT"` minus those prose lines returns **empty** — there is no executable plant residue.
- **The criterion's intent is satisfied where it matters:** `grep -c PLANT` on both **production** files → **0**, and both files are md5-identical to their pre-plant state.
- The `<action>` was honoured over the criterion because the legibility it asks for is the durable artefact; a reviewer who cannot see what the plant *was* cannot judge whether the RED meant anything. Stated here rather than resolved by lower-casing the word, which would satisfy the grep while changing nothing real.

### 3. [Deferred to 190-13, with the blocker now measurably gone]

190-01 recorded that two Wave-0 drives duck-type their phase configs because `ExternalActionPhaseConfig` rejected `connection_id` by **both** routes. **That is now false**, and it was re-measured rather than asserted:

```
C(phase_type='external_action', capability='post_message', connection_id='abc')      -> 'abc'
C.model_validate({... 'connection_id': 'x'})                                          -> 'x'
C.model_validate({...})  # an old row that never names it                             -> None
```

The switch back to `WorkflowDefinition.model_validate` is **not** taken here: `test_190_egress_ordering.py` and `test_189_no_egress.py` are outside this plan's `files_modified` contract, and 190-13 owns those drives' meaningful RED. It is now unblocked, and the `base_url` half is settled (decision 3 above).

### 4. [Rule 1 — auto-fixed] The SDK state verbs corrupted `STATE.md` while reporting that they had changed nothing

- **Found during:** state updates, immediately after the third task commit.
- **Issue:** both verbs returned failure — `state.advance-plan` → `{"error": "Cannot parse Current Plan or Total Plans in Phase from STATE.md"}`, `state.update-progress` → `{"updated": false, …}` — and between them **deleted 39 lines** (`git diff --numstat` → `7 39`): the entire `stopped_at` key, the rich `last_activity`, `status: executing` → `planning`, `last_updated` rewound to a **stale** `18:49:07.592Z`, and **three `### Previous stopped_at` history blocks**, replaced by a fabricated `progress:` block (`completed_plans: 147`, `percent: 52`) that nothing measured. This is occurrence **#4** of D-190-DEF-01, and the first where both calls *claimed* to be no-ops.
- **Fix:** restored from a copy taken **before** the calls (`git diff --numstat` → **empty**, byte-exact against `HEAD`; all 5 history blocks intact), then hand-edited per the plan-03/04/05 convention. Final diff is **12 / 5** — 3 frontmatter lines + 2 Current-Position lines replaced, 1 history block demoted, **nothing destroyed** (6 blocks now).
- **Also measured:** the failing parse is of the markdown **body**, not the frontmatter — so repairing the (separately broken) YAML would **not** have prevented this, and could make it worse by turning a loud error into a silent successful rewrite. Recorded under D-190-DEF-01 with that correction, because the obvious fix is the wrong one.
- **Caught only because** `STATE.md` was copied aside first. Recorded as a standing instruction for the phase's remaining plans: never trust a state verb's own report; diff the file.

---

**Total deviations:** 1 measured design change, 1 recorded criterion conflict, 1 recorded hand-off, **1 auto-fixed (Rule 1 — tooling data loss, recovered)**. Nothing outside this plan's files was touched, and no package was installed.

## Issues Encountered

- **A recorded transcript falsified itself on paste — again, and it was caught.** The Step-1 RED was recorded **below** the drive's import specifically so the docstring's hard-won `:92` fixed point could not drift; `:92` re-measured as `:92`. But the pasted transcript quotes `…py:190`, and pasting it above that assertion pushed the assertion to `:252`. Rather than editing the quoted output (an edited transcript is not a transcript), the drift is **stated** in the file with a re-derive command, and iterated to a fixed point (`:252 == :252`).
- **Four tests in the 189/190 slice remain RED, and they are exactly the ones 190-13 owes** — not a regression. `test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress` (the executor still sends nothing) and the three `test_190_egress_ordering.py` cases. Those three **improved** from a collection error to a meaningful RED because `connector_service` now imports: `AttributeError: module 'app.services.harness.phase_types' has no attribute 'resolve_connection'` / `'validate_destination'` — precisely the namespace import 190-01 said three drives depend on.
- The **plant harness's own restore was initially not byte-exact** on `connector.py`: `read_text`/`write_text` normalised LF → CRLF. Caught by the harness's md5 check (which is why it has one), fixed by switching to `read_bytes`/`write_bytes`, and case 6 re-run — restored `91beb83c…` → `91beb83c…`, `True`. `git diff --stat` on that file was empty at every point.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_credentials.py tests/unit/test_190_cross_org_credential.py tests/unit/test_189_external_action_model.py -q` | **22 passed** |
| `pytest tests/unit/test_190_credentials.py -q` | **8 passed** (plan asks ≥ 7) |
| `grep -c "sweep_row\|SECRET_COLUMNS" connector_service.py` | **0** |
| `grep -c "enc:v1:" connector_service.py` | **0** (the envelope is read through `is_encrypted`) |
| `grep -c "forbidden" connector_service.py` | **0** |
| `grep -c "BYPASSRLS" connector_service.py` | **1** — both D-15 sentences present |
| `grep -c "run_in_threadpool" connector_service.py` | **1** — plus every DB call goes through `aexec` |
| `inspect.signature(resolve_connection).parameters['org_id'].default is empty` | **True** |
| `ConnectorConnectionResponse` fields matching `secret`/`cipher` | **`[]`** |
| `'connection_id' in C.model_fields, .is_required()` | **`True False`** |
| `PostMessageConfig(channel=…, base_url=…)` | **rejected** |
| `pytest tests/unit/test_189_external_action_model.py -q` | **11 passed** — old JSONB rows still validate |
| `grep -c "D-13" models/harness.py` | **3** |
| `grep -c "EXTERNAL_ACTION_CAPABILITIES" models/connector.py` | **7** |
| `git diff --numstat HEAD~3 HEAD -- backend/requirements.txt frontend/package.json` | **empty** — zero installs (T-190-SC) |
| `graphify update .` | **19 444 nodes / 50 603 edges** rebuilt (untracked artefact; no git impact) |

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-06-T8 | The id-only resolver was authored first and **the leak reproduced** (org A holding org B's decrypted token). Closed by a scoped query **plus** a post-fetch org re-check, with `org_id` required (asserted via `inspect.signature`). A cross-org miss reads as ABSENT — no message names an owner, an existence or a permission verb. Case 8 keeps the regression caught even if the SQL predicate is later deleted |
| T-190-06-T5 | Sentinel sweep over `msg` + `getMessage()` + **`args`** across a refused store, a refused read and a successful resolve, with a positive control proving the capture works. Plant observed RED — and it was the **ciphertext** assertion that fired, not the plaintext one |
| T-190-06-T7 | The field is absent, `extra='forbid'` rejects it, the projection is derived from `model_fields`, and a module-scope assert makes adding it an **import failure**. Plant observed RED as a collection error |
| T-190-06-T6 | Per-capability `extra='forbid'` config models; `SendEmailConfig` has nowhere to put a password. `ExternalActionPhaseConfig` gained a REFERENCE only — no secret, host or token enters the JSONB |
| T-190-06-D11 | Fail-CLOSED at BOTH ends; both plants (plaintext fall-through store; the `return raw` polarity) observed RED. `SECRET_COLUMNS` not extended, `sweep_row` not called (grep 0) |
| T-190-06-ORACLE | `update_connection` checks org-scoped existence before interpreting any body field, so an unowned id refuses identically whether the body was valid or not |
| T-190-06-BLOCK | Every `supabase-py` call goes through `aexec` = `run_in_threadpool(query.execute)`; stated in the header and greppable |
| T-190-SC | Zero installs; `git diff --numstat` over all three commits on `requirements.txt` / `package.json` prints nothing |

## Known Stubs

**None.** Every function in `connector_service.py` is wired to a real code path: the resolver to `_fetch_connection_row` (a real scoped query on the shipped client), the CRUD functions to `aexec`. Nothing returns a hardcoded empty value, and no placeholder text exists in either production file.

Two things are **deliberately absent** rather than stubbed, and belong to named later plans: there is **no router** (`app/api/connectors.py` is 190-07's) and **no `delete_connection`** — the plan's Task 2 enumerates create / update / list / get / resolve and nothing else, and migration 116's DELETE policy already exists for whichever plan adds it.

## Threat Flags

**None outside this plan's `<threat_model>`.** This plan opened no network endpoint (there is no router yet), no auth path, no file access and no schema change. The one new security surface — a service that decrypts tenant credentials — is exactly what T-190-06-T8 / -D11 / -T5 / -T7 were written against, and each is dispositioned above.

## Next Phase Readiness

**Ready.** What is now available to downstream plans, and what they still owe:

| Owed by | What |
|---|---|
| **190-07** | The router. `ConnectorConnectionCreate/Update/Response` and the four CRUD functions are done; the router injects the **user-JWT** client (D-15 case 1) and maps `ConnectorNotFound` → 404, `ConnectorCipherUnavailable` → 503 (sketch 156 moment 9: Save goes disabled) |
| **190-13** | Import `validate_destination` and `resolve_connection` into `phase_types`' OWN namespace — three drives depend on it, and they now fail with a **meaningful** `AttributeError` naming exactly that |
| **190-13** | The W0-3 ordering RED, and the D-16 golden-run gate landing in the SAME commit as the send |
| **190-13** | Switch the two duck-typed builders back to `WorkflowDefinition.model_validate` — **now unblocked**, measured above. `base_url` is settled: the connection row |
| Whoever adds delete | `delete_connection`, against migration 116's existing DELETE policy |

**One thing not to re-litigate:** the plaintext is lazy for a measured reason, not a stylistic one. Making it eager re-breaks the W0-2 non-vacuity control, and the correct response to that would not be to edit the fixture.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/models/connector.py` | FOUND (225 L) |
| `backend/app/services/connector_service.py` | FOUND (589 L) |
| `backend/tests/unit/test_190_credentials.py` | FOUND (455 L) |
| `backend/app/models/harness.py` modified | FOUND (+31 / −0) |
| `backend/tests/unit/test_190_cross_org_credential.py` modified | FOUND (+62 / −0) |
| commit `09808f6d` (Task 1) | FOUND |
| commit `e1694006` (Task 2) | FOUND |
| commit `994d8028` (Task 3) | FOUND |
| No file deletions in any of the three commits | CONFIRMED |
| `STATE.md` — 6 history blocks intact, `12 / 5` diff, `plan 6 of 19` | CONFIRMED |
| `ROADMAP.md` — `190-06` row `[x]`, progress cell `5/19` → `6/19` | CONFIRMED (`2 / 2`) |
| `REQUIREMENTS.md` — CONN-03 **deliberately NOT** marked | CONFIRMED (D-190-DEF-02 precedent) |

**CONN-03 is not marked complete here, on purpose.** This plan's frontmatter claims it, but the phase convention set by 190-01 (D-190-DEF-02) and followed by 190-05 is that CONN-02 / CONN-03 are marked **together at phase close**, after `/gsd:verify-work` + `/gsd:secure-phase`. CONN-03's SC#2 (the unconditional egress guard on a real send) is unmet until 190-13 lands the send at all — marking it now would assert a capability that does not exist, in the one phase whose whole discipline is not over-claiming (D-31).

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-08*
