---
phase: 190-live-connector-slice-connector-security-stretch
plan: 15
subsystem: backend-api
tags: [connectors, credential-check, gate-2, door-b, u-07a, conn-02, conn-03, egress, d-17, plant-driven, wave-6]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "resolve_connection(id, org_id=...) with a REQUIRED org and its two D-14 gates; update_connection's OQ#4 verdict reset, already shipped"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 07
    provides: "app.security.egress — EgressRefused + its reason_code, the response-size terminals, the pinned binders"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 08
    provides: "AdapterCheckResult, AdapterError, the closed registry, and the SMTP check that issues no DATA"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 09
    provides: "the /connectors router, require_org_manage on the writes, the live_connectors gate, and the five client functions this plan's sixth joins"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 10
    provides: "the Jira check (GET /rest/api/3/myself) + JiraUnreachable"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 11
    provides: "the Slack check (auth.test) + SlackUnreachable, and the measured ok:false trap"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 13
    provides: "_exec_external_action's six ordered gates and the shipped recorded_not_sent terminal this plan's disabled branch reuses"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 16
    provides: "ConnectionsTab's onCheck seam, REMOVED pending this commit"
provides:
  - "POST /connectors/connections/{id}/check — a dedicated org-admin action on the STORED connection that takes an id and NOTHING else"
  - "connector_service.record_check_verdict — the check's only side effect, two columns, one org-scoped UPDATE"
  - "ConnectorCheckResponse — a verdict, never a credential, with UI-SPEC §4d's three buckets kept apart on the wire"
  - "Gate 2's exact reach, named in the executor: org + is_enabled ONLY, with door (b) asserted as a POSITIVE test"
  - "checkConnectorConnection + ConnectorCheckResult, and `Check credential` actually rendering in Settings"
  - "the UI-SPEC §5c correction — the closed negation table's send_email row was IMPROVISED in the sentence forbidding improvisation"
  - "a strengthened registry-import fence: WHERE an import sits, not merely how many exist"
affects: [190-17, 190-18, 190-19, 190-verify-phase, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "When a security header's stated invariant stops being exactly true, amend it by QUOTATION with a SUPERSEDED marker and state the narrower truth — never delete it, never leave it"
    - "A fence that greps for a literal cannot be described using that literal; reword the prose rather than declare a conflict"
    - "Assert a DELIBERATE PERMISSIVENESS as a positive test, so a later 'improvement' that tightens it fails loudly instead of silently contradicting shipped copy"
    - "Strengthen an exact-equality pin into a classifier (module-scope vs function-local) rather than widening it — and falsify the classifier on synthetic input before trusting it on the tree"

key-files:
  created:
    - backend/tests/unit/test_190_connector_check.py
  modified:
    - backend/app/api/connectors.py
    - backend/app/models/connector.py
    - backend/app/services/connector_service.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/unit/test_190_connector_source_fence.py
    - frontend/src/lib/api.ts
    - frontend/src/components/settings/ConnectionsTab.tsx
    - frontend/src/components/settings/__tests__/ConnectionsTab.test.tsx
    - scripts/vitest-count-gate.cjs
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-UI-SPEC.md

key-decisions:
  - "The check route takes an id and NOTHING else — no request body exists through which a credential could arrive. Asserted three ways (signature, OpenAPI, wire), because 'we do not read one' is weaker than 'there is none'"
  - "It reads through the SERVICE-ROLE resolver and writes through the USER-JWT client, and the file header's 'EVERY route runs on the user-JWT client' is amended by quotation rather than left to rot"
  - "EgressRefused IS caught in the check route and that is not the executor's rule being broken: here the refusal IS the product, reported in its own §4d bucket with a `failed` verdict either way"
  - "Two new PLATFORM reason codes (connection_disabled 409, credential_unreadable 503), deliberately outside egress.REFUSAL_REASONS' closed six-row DESTINATION table — the CIPHER_UNAVAILABLE_REASON precedent"
  - "`reason_code` was added to the check result beyond the plan's named field list, because §4c's six sentences are keyed by it and a client that re-words a refusal produces a seventh sentence nobody ratified"
  - "Gate 2's is_enabled half is NAMED where it lands (the ConnectorDisabled branch) rather than duplicated beside the unbound branch — the executor holds no row until it resolves, so a second check there would be dead code"
  - "UI-SPEC §5c's send_email negation corrected to the SHIPPED literal `No email was sent.` — the document had improvised the one string it forbade improvising"

patterns-established:
  - "Prove a wiring the rendered DOM cannot see with a `?raw` container fence — and drive it RED by reverting the wiring, not by imagining it"
  - "A re-pinned count-gate entry is proved by making it too high and observing [count-decrease], not by trusting that the mechanism still works"

requirements-completed: [CONN-02, CONN-03]

# Metrics
duration: 55min
completed: 2026-08-09
---

# Phase 190 Plan 15: The Credential Check and Gate 2 Summary

**The two server-side mechanisms UI-SPEC §5 promises now exist — a dedicated check that runs on the STORED connection and provably sends nothing, and a bind gate whose reach is exactly org + `is_enabled` — and the plan's own headline discipline caught a defect in its own source documents: §5c improvised the one sentence it forbade improvising.**

## Performance

- **Duration:** ~55 min (04:43 → 05:00 committing; measurement and plant work either side)
- **Completed:** 2026-08-09
- **Tasks:** 3, each committed individually
- **Files:** 11 (1 created, 10 modified) — **1 503 insertions, 29 deletions, ZERO file deletions** across all three commits (`git diff --diff-filter=D --name-only HEAD~3 HEAD` prints nothing)

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The dedicated check action + `record_check_verdict` + the strengthened import fence | `889f5409` |
| 2 | Gate 2's exact reach, door (b) as a POSITIVE, and the §5c copy correction | `c486ff9c` |
| 3 | The client function — and `Check credential` actually appearing | `1db22a24` |

---

# ⭐ THE FINDING: §5c IMPROVISED THE SENTENCE IT FORBADE IMPROVISING

The plan's own `<interfaces>` block, UI-SPEC §5c and plan 190-18 all quote the check's closing negation as:

> The closing negation is picked from the **same closed table 189 §9d already ships**, never improvised: `send_email` → `No mail was delivered to anyone.`

**The table 189 actually ships says `No email was sent.`** That is not an interpretation — it is four independent readings of the shipped system, taken before anything was changed:

| Source | Value |
|---|---|
| `phase_types._EXTERNAL_ACTION_NEGATION["send_email"]` (production source) | `No email was sent.` |
| `189-UI-SPEC.md:761` (the closed table's own row) | `No email was sent.` |
| `189-UAT.md:104` — read straight out of `workflow_phases.output` | `No email was sent.` |
| `189-SECURITY.md:92` | `No email was sent.` |

The other two rows (`create_ticket`, `post_message`) were already correct and are unchanged. So **one of three rows had drifted**, and shipping the document's version would have given a three-row *closed* table a **fourth sentence** — the exact drift the "never improvised" clause exists to prevent, arriving through the clause itself.

**It was found by RUNNING the assertion, not by reading.** The case was written quoting the plan and went RED on first run:

```
E       AssertionError: assert 'No email was sent.' == 'No mail was delivered to anyone.'
FAILED tests/unit/test_190_connector_check.py::
       test_the_closing_negation_comes_from_the_CLOSED_table_189_already_ships
```

**Which half moved, and why.** The code was NOT changed to match the document. The negation is 189's shipped, UAT-evidenced, security-reviewed string; editing it would be a 189-surface change that invalidates 189's own recorded evidence, made inside a 190 plan that claims to be *reusing* it. §5c was corrected instead, with the measurement written beside it, and **all three rows are now pinned against production source** so the next divergence is a RED test rather than a re-reading.

⚠ **190-18 quotes the same wrong string in its task text and must read the value from `_EXTERNAL_ACTION_NEGATION`.** A pointer sits in §5c so it cannot be lost.

---

# ⭐ DOOR (b), ASSERTED AS A POSITIVE — AND WHY THAT IS THE HARD PART

Every other case in `test_190_connector_check.py` asserts that something is **refused**. Case 3 asserts that something is **ACCEPTED**, and it is the only case in the file that a well-meaning future change would break by making the system *stricter*.

**Gate 2 validates a bound connection's ORG and its `is_enabled` flag, and reads the stored check verdict NOWHERE.** Measured at HEAD after the change: `grep -c "last_check_verdict" backend/app/services/harness/phase_types.py` → **0**; `grep -c "is_enabled"` → **3**.

The case has two halves, because either alone is satisfiable by an accident:

1. **the POSITIVE** — `ExternalActionPhaseConfig(..., connection_id=<a connection whose last check FAILED>)` validates; and
2. **the ABSENCE** — the column's name appears **nowhere** on any bind or run path in the whole `backend/app` tree. Its only three readers are the module that WRITES it (`connector_service.py`), the response model that reports it (`models/connector.py`), and the router's own prose (`api/connectors.py`). A future gate has to add an occurrence to a fenced module, which turns this case RED and names the document it contradicts.

The fixture row carries `"last_check_verdict": "failed"` on purpose, so cases 3 and 4 pass **over the row the decision is actually about** rather than over a healthy one.

## U-07a — THE REVERSAL CONTRACT, RESTATED VERBATIM

> **door (a):** extend Gate 2 to reject a `connection_id` write when `last_check_verdict = failed`, **and restore the absolute verb in the same commit** — plus either give members the check, or ship the "ask an admin" dead end knowingly. **The two halves may never be separated: a gate without the copy under-claims, and the copy without the gate is the §5 defect.**

Concretely, taking door (a) is a **four-edit** change and no subset of it is legitimate:

1. add the verdict predicate to `_exec_external_action`'s Gate 2 (or to the definition-write path);
2. restore §5b's absolute verb — *"no step will be allowed to use it"* — replacing *"the picker will not offer it"*;
3. delete or invert `test_a_FAILED_verdict_does_NOT_block_the_write_of_a_connection_id` **and** `test_a_FAILED_verdict_does_NOT_block_a_RUN`, deliberately, in that same commit;
4. either grant members the check (amending U-02, §2b and the router's `require_org_manage`), or record the "ask an admin" dead end as an accepted cost in `190-SECURITY.md`.

**Why door (b) stands.** Blocking the bind prevents no send: a bound-but-failing connection fails honestly on the next run with the host's verbatim words (§8a / D-17). The failing-verdict rule is a **quality hint**, not an authorization boundary — migration 116 says so in the column's own `COMMENT` — and every ACTUAL boundary (org scoping, `is_enabled`, the egress guard, the armed approval) **is** server-enforced.

---

# ⭐ "AND NOTHING WAS SENT" — PROVED PER CAPABILITY, NOT ASSERTED

UI-SPEC §5c's headline is only honest if the second clause is measured, so the transport is **recorded** at the one door each adapter uses, and each capability's real delivery surface is asserted absent **by name**:

| Capability | Transport recorded at | Delivery surface asserted ABSENT | Observed |
|---|---|---|---|
| `post_message` | `slack_adapter.send_pinned_http` | `chat.postMessage` anywhere in the recorded exchanges | ✅ only `auth.test` |
| `create_ticket` | `jira_adapter.send_pinned_http` | a `POST` to `jira_adapter.ISSUE_PATH` (`/rest/api/3/issue`) | ✅ only `GET /rest/api/3/myself` |
| `send_email` | `smtp_adapter.open_pinned_smtp` | the `DATA` verb — the command that begins a message body | ✅ verbs were exactly `["login", "quit"]` |

Two further properties hold across all three: **no request body was carried on any exchange** (an identity call carries none), and the SMTP recorder's `__getattr__` turns *any* unimplemented verb into an immediate failure — so the assertion is "these two verbs and no others", not "not this one verb I thought of".

**The non-vacuity halves are asserted first**, before any negative: each check must return `ok=True` **and** name an identity. A check that cannot say WHO it authenticated as is not a green check (each adapter enforces that itself — §5c renders *"Authenticated as {identity}"*), and without those two lines the negative assertions would pass over a check that never ran.

---

# ⭐ FAILING CLOSED ON A REVOKED CREDENTIAL

190-11 measured that Slack answers `200 {"ok": false, "error": "invalid_auth"}` for a revoked token — a status-line check would paint a dead credential **green**, which is worse than a failed send because it is a light a person acts on later. The route therefore takes `ok` **only** from the adapter's own verdict (`getattr(result, "ok", False)`), never from a status code, and maps a falsy verdict to `bucket="rejected"` + `verdict="failed"`.

The route also fails closed on every path where the credential cannot even be read:

| Condition | Answer | Why not something else |
|---|---|---|
| absent id **or** another org's | `404`, byte-identical | a forbidden status confirms the id names a real row somewhere |
| `ConnectorDisabled` | `409` + `connection_disabled` | the row IS in the caller's org and already visible in their table, so naming its state discloses nothing — and re-enabling is a click they already have |
| `ConnectorCipherUnavailable` | `503` + `no_encryption_key` | §4b moment 9 — a refusal the person cannot fix; Save goes DISABLED |
| `ConnectorSecretNotEncrypted` / `ConnectorSecretUnreadable` | `503` + `credential_unreadable` | a key IS configured here, so `no_encryption_key` would send an admin to fix something that is not broken |

The last is raised **lazily on `.secret`**, i.e. from inside the adapter, so it is caught at both sites.

---

## The check route, in one table

| # | Step | Decision | On trip |
|---|---|---|---|
| 1 | `require_visible("live_connectors")` | **D-26** | the platform gate, per endpoint — never on the router (the read must stay ungated so §2h's banner can render) |
| 2 | `require_org_manage` | **U-02** | `403`. ⚠ this is the asymmetry that decided door (b), and it is written in the handler so a later reader does not "fix" Gate 2 |
| 3 | `resolve_connection(id, org_id=<caller's active org>)` | **D-14** | the SAME resolver a run uses — both gates, including the returned row's own `org_id` re-check |
| 4 | `get_adapter(capability).check(...)` | D-04 | authenticate, then disconnect. Sends nothing |
| 5 | classify into §4d's three buckets | **U-06** | `refused` / `unreachable` / `rejected` — three headings, three next steps |
| 6 | `record_check_verdict(id, org_id, verdict)` | CONN-02 | two columns, ONE org-scoped UPDATE, on the USER-JWT client so RLS is a real gate on the mutation |

**Gate 3 reads on the service-role resolver while gate 6 writes on the user-JWT client, and that split is deliberate.** The check must exercise the same resolver a RUN uses, so a green verdict is evidence about the row the engine will actually resolve rather than about a second, RLS-shaped read path no run takes. The router header's *"EVERY route in this module runs on the PER-REQUEST USER-JWT Supabase client"* is therefore **amended by quotation with a SUPERSEDED marker**, not deleted and not left to rot.

---

## The eight plants → RED (each on the case it was aimed at)

Every load-bearing case was falsified against a **real plant in real production source**, applied by a byte-level harness with the restore in a `finally`, the case re-run, and the file verified **md5-identical** afterwards. `git diff --stat` on every target is empty.

| # | Plant | File | Observed RED |
|---|---|---|---|
| A | the disabled branch returns the FAILURE terminal | `phase_types.py` | `1 failed` — `test_a_disabled_connection_is_treated_as_unbound_and_records_not_sent` |
| B | a verdict gate added above the dispatch | `phase_types.py` | `1 failed` — `test_a_FAILED_verdict_does_NOT_block_a_RUN` |
| C | a bind-path module names the verdict column | `models/harness.py` | `1 failed` — `test_a_FAILED_verdict_does_NOT_block_the_write_of_a_connection_id` |
| D | the Slack CHECK calls `POST_MESSAGE_METHOD` | `slack_adapter.py` | `1 failed, 2 passed` — **only the `post_message` row**, which is the reach |
| E | the check route grows a body parameter | `api/connectors.py` | `1 failed` — `test_the_check_never_accepts_a_secret_in_its_request_body` |
| F | the verdict reset moved to a second write | `connector_service.py` | `AssertionError: a secret REPLACE did not reset the verdict in the same UPDATE: ['secret_ciphertext']` |
| G | the container stops passing `onCheck` (the 190-16 state) | `ConnectionsTab.tsx` | `1 failed \| 35 passed` |
| H | the check handler flips local state instead of re-fetching | `ConnectionsTab.tsx` | `1 failed \| 35 passed` |

**Plant D is the one to read.** It is the only plant whose target is parametrised, and it went red on **exactly one** of three rows — which is what distinguishes a case that measures Slack's delivery surface from one that would have gone red for any reason at all.

**Plant F recorded a harness lesson worth keeping** (190-16's, met again): the first attempt used LF line endings and silently **did not apply**, printing `PLANT DID NOT APPLY` rather than a RED. A plant that does not apply is not a falsification, and the harness says so out loud rather than reporting a pass.

---

## ⭐ THE IMPORT FENCE HAD TO GET STRONGER, NOT WEAKER

The check must dispatch through `registry.get_adapter`. `test_190_connector_source_fence.py` pinned the registry's importers to an exact one-element list, and adding the import went RED immediately — correctly:

```
E  AssertionError: the connector registry now has these importers:
   ['app/api/connectors.py:505', 'app/services/harness/phase_types.py:94']. It had exactly
   one, and that is the ONLY reason the measured import cycle (registry -> harness.grounding
   -> harness/__init__ -> phase_types -> registry) stays unreachable.
```

**The fence was right and the import shape was wrong.** A **module-scope** import can be the module that opens the cycle; a **function-body** import runs at call time, after every module is in `sys.modules`, and joins no cycle. The original assertion — an exact-equality pin on a list of sites — could not tell the two apart.

So the import is function-local **and the fence now classifies rather than counts**: exactly one module-scope importer (pinned by file AND line, as before), plus a pinned set of files permitted to hold a function-local one. The classifier is **falsified on synthetic input inside the test** before it is trusted on the tree — a classifier that called everything "function-local" would pass the walk forever while reporting nothing.

Driven RED against a real module-scope plant in `api/connectors.py`:

```
E  AssertionError: the connector registry now has these MODULE-SCOPE importers:
   ['app/api/connectors.py:...
```

file restored md5-identical (`3267dedae2226c89083cd450b7c6d4ba` before and after).

---

## Verification (RUN, never quoted — every baseline re-measured at HEAD)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_connector_check.py -q` | **14 passed** (plan asks ≥ 7) |
| `pytest tests/unit/test_190_connectors_api.py -q` | **10 passed**, unchanged |
| `pytest tests/test_harness_engine.py tests/unit/test_publish_service.py tests/unit/test_190_egress_ordering.py -q` | **83 passed** — the disabled branch reuses the shipped terminal, so no status was added |
| all nine 190 backend suites combined | **151 passed** |
| **Full backend suite at HEAD** | **211 failed · 3575 passed** · 19 skipped · 5 xfailed · 9 xpassed · 1 error |
| Failure delta | **211 → 211 — ZERO new failures.** `211` is byte-identical to the figure `190-13-SUMMARY.md` recorded; passes are up (+33 since that reading, of which 14 are this plan's) |
| `grep -c "last_check_verdict" phase_types.py` | **0** — Gate 2 must NOT read it (door (b)) |
| `grep -c "is_enabled" phase_types.py` | **3** |
| `grep -c "check" api/connectors.py` · `grep -c "org:manage"` | **32** (≥ 3) · **6 → 7** (+1, as required) |
| `grep -c "not_checked" connector_service.py` | **4** (≥ 1) |
| `grep -cE "refused\|unreachable\|rejected" api/connectors.py` | **15** — all three §4d buckets named |
| the check route's signature | `(connection_id, current_user, active_org, supabase)` — **no body parameter**; `requestBody` absent from OpenAPI |
| `grep -c "checkConnectorConnection" frontend/src/lib/api.ts` | **1** |
| `grep -cE "refused\|unreachable\|rejected" api.ts` | **24** (≥ 3) |
| `grep -ciE "credential works\|nothing was sent\|did not answer" api.ts` | **0** — no user-facing copy in the API client |
| `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33 → 33, unmoved.** Baseline RE-MEASURED at HEAD before any edit |
| `npx vitest run …/ConnectionsTab.test.tsx` | **36 passed** (34 + this plan's 2 container fences) |
| `node scripts/vitest-count-gate.cjs` | **`count gate OK` — 50/50 pinned files, no per-file decrease, `failed 0`**, pinned total **2773 → 2775**, running total 2788 |
| the re-pinned entry CATCHES a decrease | **`[count-decrease] ConnectionsTab.test.tsx — pinned 37, ran 36 (-1)`, exit 1** — driven, then restored md5-identical |
| `eslint src/components/settings/` | **5 → 5, unmoved** (all pre-existing: `ProviderPicker.tsx` ×3, `ModelPillRow.tsx` ×2) |
| the eight D-23/D-24 fenced files | **`0 0` — and existence confirmed at the base first** (`git cat-file -e 47afcade:<path>` OK ×8), so the empty numstat is *identical*, not *absent* |
| `git diff --numstat 47afcade HEAD -- package.json package-lock.json requirements.txt` | **empty** — zero installs (T-190-SC) |
| `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** — no commit deleted a file |
| `python -c "import app.main"` | **app boots OK** after every commit |

---

## Deviations from Plan

### 1. [Rule 3 — blocking] The registry import tripped a standing fence, and the fence was made STRONGER rather than loosened

Fully described above. **`backend/tests/unit/test_190_connector_source_fence.py` is outside `files_modified`**, and the edit was unavoidable: the check cannot dispatch without the registry, and the fence's exact-equality pin admits no import of any shape. The alternative — re-implementing the closed capability→adapter map in the router — would duplicate D-04's mechanically-asserted registry, which is worse than editing a test.

The amendment is strictly stronger (WHERE, not merely HOW MANY) and its classifier is falsified inline before use.

### 2. [Scope — a fourth backend file] `ConnectorCheckResponse` lives in `app/models/connector.py`

`files_modified` names only `api/connectors.py` and `connector_service.py`. The response model went to the declared models home instead, because that is where the T7 discipline lives — the `_StrictBase`/`extra='forbid'` posture, and the *"the response model IS the gate, not the TypeScript type"* rule the file's own header states. A response envelope defined in a router would be the one connector response model outside the place a reviewer looks for it.

### 3. [Rule 2 — beyond the plan's named field list] `reason_code` on the check result

The plan lists `ok`, `identity`, `host`, `port`, `verdict`, `checked_at`, `bucket`, `provider_message`. `reason_code` was added because **UI-SPEC §4c's six sentences are keyed by the guard's own code** — without it a `refused` bucket reaches the panel with a heading and no sentence, and the client would have to invent one, producing the seventh sentence §4c exists to prevent. It is the same value `readConnectorReasonCode` already surfaces on the error path, so the two paths now agree.

**Deliberately NOT added** (D-32, and named so 190-18 can ask for them explicitly if it needs them): the refused `ip` and the guard's `allowed` list, which §4c's `address_not_public` and `host_not_allowed` rows interpolate.

### 4. [Rule 2 — the success criterion, not the task list] The container now passes `onCheck`, and two `?raw` fences prove it

`files_modified` names only `api.ts` for the frontend. But the orchestrator's brief and this plan's success criteria require `Check credential` to be **visible and functional**, and 190-16 left it REMOVED pending exactly this commit. Wiring it is 3 lines in `ConnectionsTab.tsx`.

**The gap that made the fences necessary is worth stating:** all 34 shipped cases render `ConnectionsTabView` **with props**, so none of them can see whether the CONTAINER ever supplies a handler — and both `onCheck` cases were green for the whole of 190-16 while the menu item was absent from the running app. Two `?raw` container fences close that, and both were driven RED against real plants (G and H).

`scripts/vitest-count-gate.cjs` was re-pinned 34 → 36 in the same commit (the two-knob rule; the `TARGETS` line already existed). The pre-existing **+13** drift on `ExternalActionSection.test.tsx` and `PhaseTimeline.test.tsx` is deliberately NOT folded in, for the reason 190-12 and 190-16 both recorded.

### 5. [MEASURED — a document was corrected, not the code] UI-SPEC §5c's `send_email` negation

Fully described above. `190-UI-SPEC.md` is outside `files_modified`; the phase's critical rule 1 makes moving the copy mandatory when it diverges from the mechanism, **in the same commit**, which is where it landed (`c486ff9c`).

### 6. [RECORDED — an acceptance criterion cannot hold as written] `grep -c "last_check_verdict"` on `phase_types.py`

The plan requires that grep to print **0**, and also requires the door-(b) reasoning to be written where a later reader will meet it. The first draft of the comment named the column and the grep read **1**. **Both cannot hold**: a fence that greps for a literal cannot be described using that literal.

190-13 and 190-16 each met this class and recorded it rather than gaming the check; the same choice is made here. The sentence was reworded to say *"the column's NAME is asserted to appear ZERO times in this whole file, which is why it is not spelled even here"*, which is both true and more informative than the literal would have been. Re-measured: **0**.

### 7. [RECORDED — Gate 2's `is_enabled` branch could not be placed where the plan says]

The plan's action A says to add the disabled branch *"beside the no-`connection_id` branch"*. **That is structurally impossible without a second fetch:** the executor holds no row until `resolve_connection` returns, and `is_enabled` lives on the row. The flag already has exactly one reader (`resolve_connection`, which refuses **before** any decryption, so a switched-off connection never materializes a credential), and its refusal already lands on the same `_record` terminal as the unbound branch — so the plan's stated PROPERTY was already shipped by 190-13 and only its legibility was missing.

What landed instead is the branch **named** where it lands, plus the docblock's gate list amended, plus the behavioural proof (case 1, driven RED by plant A). A duplicate check beside the unbound branch would have been unreachable dead code.

### 8. [MEASURED — a pre-existing latent cycle, stated not fixed]

`import app.models.connector` in a cold interpreter fails with a circular-import `ImportError` (`models.connector → harness.grounding → harness/__init__ → phase_types → connector_service → models.connector`). **Verified present at HEAD before this plan's first commit**, so it is inherited, not introduced — and `import app.main` boots fine because main's import order reaches those modules in a different sequence. Recorded here and as an import-order comment in the new test file; not fixed, because it is a 190-06/190-13 structural artefact and D-32 fences this plan.

**Total deviations:** 1 blocking fence strengthening (Rule 3), 2 Rule-2 additions, 1 scope note, 1 mandated document correction, 1 recorded criterion conflict, 1 recorded structural impossibility, 1 measured pre-existing condition. **Zero packages installed.**

## Issues Encountered

- **The `send_email` negation drift** (above) — found because the assertion was RUN, not read. The plan, the UI-SPEC and plan 190-18 all carried the same wrong string, so no amount of cross-reading between documents would have caught it; only production source could.
- **A plant with the wrong line endings does not apply, and that is not a RED.** Plant F's first attempt used LF against a CRLF file and reported `PLANT DID NOT APPLY`. The harness prints that rather than a pass, which is the only reason it was noticed — the 190-16 lesson (a build-break is not a falsification) in a second costume.
- **Windows `cp1252` cannot encode this codebase's glyphs**, so every plant harness wraps `sys.stdout` in a UTF-8 writer and passes `encoding="utf-8"` to `subprocess`. The first run died in the reader thread *after* the `finally` had restored the file, which is why the abort was harmless.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| **T-190-15-CHK** | The check runs on the STORED connection through the org-scoped resolver. The route accepts **no body at all**, asserted on the SIGNATURE (parameter list pinned exactly), on the **OpenAPI schema** (`requestBody` absent) and over the **WIRE** (a POST carrying `secret` + `password` is accepted, ignored and never echoed). Plant E observed RED |
| **T-190-15-SEND** | Parametrised across all three capabilities with the transport recorded: no `chat.postMessage`, no `POST /rest/api/3/issue`, no SMTP `DATA`, and no request body on any exchange. Non-vacuity asserted first (`ok` **and** an identity). Plant D observed RED on exactly the `post_message` row. §5c's negation now comes from the SHIPPED table and all three rows are pinned |
| **T-190-15-U07a** | `last_check_verdict` asserted **ABSENT** from the executor (`grep -c` → 0) and from every bind/run path in the whole `app` tree. Door (b) asserted as a POSITIVE. Plants B and C observed RED. The four-edit reversal contract is recorded in the test's own docstring, in the executor's comment block and in this summary |
| **T-190-15-STALE** | A failed verdict blocks neither the bind (case 3) nor the run (case 4); the fixture row carries `failed` so both cases run over the row the decision is about. The executor attempts and reports the true outcome |
| **T-190-15-U02** | `require_org_manage` on the route, plus `require_visible("live_connectors")`. The check-admin-only / bind-org-wide asymmetry is written in the handler docstring **naming door (b)**, so a later reader does not "fix" Gate 2 |
| **T-190-15-D17** | A disabled connection reaches the SHIPPED `_record` terminal — same composer, same sentence, `recorded_not_sent`. Case 1 asserts the record sentinel, the ABSENCE of the failure sentinel, the exact first line, and that the body borrows no failure vocabulary. `test_harness_engine.py` + `test_publish_service.py` prove no status was added (83 passed) |
| **T-190-SC** | Zero installs — `git diff --numstat` over all three commits on `package.json`, `package-lock.json` and `requirements.txt` prints nothing |

## Known Stubs

**None in this plan's surface.** Every branch of the check route is wired to a real code path: the resolver to `connector_service`, the dispatch to the shipped registry and its three adapters, the buckets to `app.security.egress`'s own reason codes, the verdict to a real org-scoped UPDATE, and the client function to the live endpoint through the container.

Two things remain **deliberately absent** rather than stubbed, each with a named owner:

| Absent | Owner | Why it is absent rather than inert |
|---|---|---|
| `onAdd` / `onOpen` — the add/edit push-split panel | **190-17** | that plan's surface; the button appears the moment a handler is passed |
| §5c's rendered headline and §4c's six refusal sentences | **190-18** | the copy lives in the component layer as exported identifiers so it can be asserted by character-identity. This plan authors **no** user-facing sentence — `grep -ciE "credential works\|nothing was sent"` on `api.ts` is **0** |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound-egress-on-an-API-request | `backend/app/api/connectors.py` | The check is the **first synchronous outbound network call made from a user HTTP request** in this codebase — every prior egress path is inside the harness engine. Two consequences for the phase threat model that no earlier plan's register covers: (a) it is a **request-time SSRF surface**, mitigated by the adapters' pinned binders and the guard's own allow-list, but the *caller* is now a browser rather than a run; and (b) it is an **outbound-latency amplifier** — the SMTP path can hold a request for up to `SMTP_TIMEOUT_SECONDS`, so an admin clicking Check repeatedly can occupy workers. There is no rate limit on it (D-32 fences one), and `require_org_manage` bounds the audience to org admins |

## Cloud parity (D-22)

**Nothing new is owed.** No env var is read, no reference data is seeded, no bundled service is added, no migration is authored and the sandbox tag is unchanged. The standing queue is unchanged at **`099 → 117` + `SECRETS_ENCRYPTION_KEY`**.

⚠ One non-code half is unchanged but newly relevant: the check endpoint is gated on `live_connectors`, which is `"off"` by cold default everywhere. **Until an operator turns it on, `Check credential` is not reachable in any environment** — and there is still no Control Room card for that switch (`D-190-DEF-09`). That is the correct behaviour and it is stated here rather than discovered in UAT.

## Next Phase Readiness

**Ready.** What downstream can assume, and what it owes:

| Owed by | What |
|---|---|
| **190-18** | §5c's headline and §4c's six sentences. ⚠ **Take the closing negation from `_EXTERNAL_ACTION_NEGATION`, not from your plan text** — `send_email` is `No email was sent.`, and your task text quotes the corrected-away string. The result carries `bucket` + `reason_code`; if §4c's `{ip}` or `{allowed}` are needed, ask for them explicitly rather than re-typing the allow-list in the client |
| **190-17** | The add/edit panel. It must ALSO amend UI-SPEC §9's panel notice (false under D-190-DEF-07 branch (b)) and remove the panel's write affordances under the OFF state, in the same commit — 190-16's owed half, unchanged by this plan |
| `/gsd:secure-phase` | The **request-time egress** threat flag above is new and is not in any plan's register. Also: `EgressRefused` is now CAUGHT in one place (the check route) — the executor's never-catch rule is unchanged and still asserted, and the distinction is written at both sites |
| `/gsd:verify-work 190` | Do **not** read `npm test` as a regression signal (D-190-DEF-05/-06). Use `node scripts/vitest-count-gate.cjs` (50 files, `failed 0`) plus the per-suite run. The backend figure to compare against is **211 failed**, unchanged since 190-13 |
| VALIDATION / UAT | **Nothing in this plan contacts a real host.** Every drive is stubbed at the transport seam. A live check row still needs D-30's operator-provided credentials, and `live_connectors` must be turned ON first or the endpoint 403s |

**Three things not to re-litigate:** door (b) and its four-edit reversal cost (written in three places); the `is_enabled` branch's placement (it cannot sit beside the unbound branch — deviation 7); and the registry import's function-local shape (module-scope opens a real cycle, and the fence now says so mechanically).

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| `backend/tests/unit/test_190_connector_check.py` exists | `[ -f … ]` | **FOUND** (830 L) |
| `backend/app/api/connectors.py` modified | `git diff --numstat` | **FOUND** (+267 / −0) |
| `backend/app/models/connector.py` modified | `git diff --numstat` | **FOUND** (+61 / −0) |
| `backend/app/services/connector_service.py` modified | `git diff --numstat` | **FOUND** (+72 / −0) |
| `backend/app/services/harness/phase_types.py` modified | `git diff --numstat` | **FOUND** (+36 / −2) |
| `frontend/src/lib/api.ts` modified | `git diff --numstat` | **FOUND** (+76 / −2) |
| `190-15-SUMMARY.md` exists | `[ -f … ]` | **FOUND** |
| commit `889f5409` (Task 1) | `git log --oneline --all \| grep` | **FOUND** |
| commit `c486ff9c` (Task 2) | `git log --oneline --all \| grep` | **FOUND** |
| commit `1db22a24` (Task 3) | `git log --oneline --all \| grep` | **FOUND** |
| no commit deleted a file | `git diff --diff-filter=D --name-only HEAD~3 HEAD` | **empty** |
| the app still boots | `python -c "import app.main"` | **OK** |
