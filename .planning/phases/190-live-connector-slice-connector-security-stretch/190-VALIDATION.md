---
phase: 190
slug: live-connector-slice-connector-security-stretch
status: closed-with-owed-rows
nyquist_compliant: true
wave_0_complete: true
closed: 2026-08-09
closed_by: 190-19
base_commit: 83a93c9a
head_commit: a115e5a4
---

# Phase 190 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `190-RESEARCH.md` § Validation Architecture (measured, not asserted).
> **Every number below carries the command that produced it. Re-measure before quoting —
> the project's standing rule is "don't inherit unmeasured claims", and this phase's own
> research measured SIX inherited claims FALSE.**
>
> **FILLED AT CLOSE by plan `190-19` (2026-08-09).** Every figure in the close sections was
> **re-derived at HEAD** by a named command, including the baselines, which were re-measured
> **from the phase's own base commit in a throwaway worktree** rather than quoted from this
> file's own earlier rows. One of those re-measurements caught an error in the measurement
> itself — see § Close: the four gates.

---

## Read this first — what is PROVED, what is ASSUMED, what is OWED

This phase's discipline is not over-claiming (D-31). The three categories are kept
**separate and unmistakable**, because a scoreboard that lists only what passed is not a
scoreboard.

| | Count | Where |
|---|---|---|
| **PROVED** — a driven test, a recorded RED against a real plant, or a measured command | 14 of 14 falsification rows · 7 of 7 source fences · 51 of 51 tasks with an automated verify · 4 of 4 gates | § The Security Falsification Set · § Source Fences · § Per-Task Verification Map · § Close: the four gates |
| **ARGUED, not driven** | 3 named items | § What is ARGUED rather than driven |
| **OWED** — cannot be closed without an operator-provided destination or environment | 8 SC#10 rows · 3 live-send rows · Row B · the kill-switch lived read · 3 visual rows · the long-message axis | § SC#10 · § Manual-Only Verifications |

**The phase closes with those rows OWED. That is a DECISION, recorded in `.planning/ROADMAP.md`
and `.planning/STATE.md`, naming which row to run first — never a claim that everything ran.**

---

## Test Infrastructure

| Property | Value (re-measured at HEAD `a115e5a4`, 2026-08-09) |
|----------|-----------------------------|
| **Backend framework** | `pytest` — `backend/pytest.ini` → `testpaths = tests` |
| **Frontend framework** | `vitest` + jsdom — `frontend/vitest.config.ts`; `npm test` → `vitest run` |
| **Frontend count gate** | `node scripts/vitest-count-gate.cjs` — **2851 running / 2838 pinned / 0 failed / 51 files**, exit 0, `count gate OK`. Residual drift **+13**, unchanged from the base (see below) |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` → **33**. ⚠ Without `-p tsconfig.app.json` it checks **ZERO** files — re-confirmed at close: the bare form prints `0` |
| **Quick run command (backend)** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_egress.py tests/unit/test_190_credentials.py -x -q` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/components/workflows/ConnectionPicker.test.tsx` |
| **Full suite command (backend)** | `cd backend && venv/Scripts/python.exe -m pytest tests/ -q` |
| **Full suite command (frontend)** | `cd frontend && npm test` **then** `node scripts/vitest-count-gate.cjs` |
| **Measured runtime at close** | backend full **486 s** · frontend full **147 s** · count gate ~150 s · quick < 8 s |

### Baselines — RE-MEASURED from the phase base, not quoted

The base commit is **`83a93c9a`** — *"docs(190): planning complete — 19 plans, checker PASSED"*,
the commit immediately before `31fd3c31`, plan 190-01's first commit. Derived with
`git log --oneline de122b9a..31fd3c31` (17 commits; the last non-code one is the base).

⚠ **`de122b9a` (the Phase-189 close) is ALSO an ancestor** and is what plans 190-05 / 190-12 /
190-15 / 190-16 / 190-17 / 190-18 fenced against. Both were measured here and the eight fenced
files are identical at **both**. The two differ only by planning documents plus one unrelated
`/gsd:fast` (`f02b5f41`, the BUG-260808-01 WR-04 guard on `WorkflowCanvas.tsx` — **not** one of
the eight).

| Scope | Command | At base `83a93c9a` | At HEAD `a115e5a4` | Verdict |
|---|---|---|---|---|
| Backend full suite | `pytest tests/ -q` | **211 failed · 3372 passed** · 19 skipped · 5 xfailed · 9 xpassed · 1 error | **211 failed · 3575 passed** · 19 skipped · 5 xfailed · 9 xpassed · 1 error | failures **UNCHANGED**, passes **+203** |
| Backend FAILED set-diff | `comm -13 base head` on the sorted node-id lists | — | **2 lines**, both `tests/integration/test_114_explain_index.py` | see the caveat below |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33** | **33** | unmoved |
| Count gate | `node scripts/vitest-count-gate.cjs` | **2727 running / 2714 pinned / 0 failed / 48 files**, exit 0 | **2851 / 2838 / 0 failed / 51 files**, exit 0 | +124 tests, +3 files, drift `+13` → `+13` |
| Frontend full suite | `npm test` | *not measured at base — see the note* | **21 failed · 4686 passed (4707)**, 8 failed files of 249 | not a regression signal (D-190-DEF-05/-06) |

**The count-gate base figures reproduce this file's own original row exactly** — 2727 / 2714 /
0 failed / 48 files — which is the first time in this phase that a quoted baseline survived
re-measurement unchanged. It is recorded as a re-measurement, not as a citation.

⚠ **A MEASUREMENT ERROR WAS MADE AND CORRECTED, AND IT IS RECORDED RATHER THAN QUIETLY FIXED.**
The first base run used a **sparse** worktree (`backend scripts frontend`) that omitted
`supabase/`, and reported **221 failed / 3362 passed**. Eleven of those failures were tests that
read `supabase/full-schema.sql` or `supabase/migrations/` and failed **because the directory was
absent from my own checkout** — a defect in the instrument, not in the base commit. Read
uncorrected, it would have let this document claim *"the phase fixed 11 pre-existing failures"*,
which is false. `supabase` was added to the sparse set and the run repeated: **211 / 3372**, and
the "gone" list collapsed from 11 to **0**. Both numbers are printed here so the correction is
auditable.

⚠ **The two "new" ERRORs are NOT attributable to this phase, and that is measured rather than
argued.** Both are in `tests/integration/test_114_explain_index.py`:
- The phase **never opened the file** — `git diff --name-only 83a93c9a HEAD -- backend/tests/`
  lists 17 files and that is not one of them.
- **Both of its tests pass in isolation, twice in a row** (`2 passed` · `2 passed`).
- The **first** (sparse) base run had a *different* test in the *same* file failing, so the file
  swaps which case fails between whole-suite runs.
It is a live-DB `EXPLAIN`-plan integration test whose verdict depends on planner statistics that
move as the dev database accumulates rows. **Flaky, environment-dependent, untouched by 190.**
Stated rather than rounded away: "zero new failures" is true of every test this phase can reach,
and this one caveat is named.

---

## Sampling Rate — honoured as written

- **After every task commit:** the relevant quick command — done in all 51 tasks
- **After every plan wave:** the full suite for the side(s) that wave touched — done
- **After ANY wave touching `frontend/src/components/workflows/`:** `npm test` **and** the count
  gate **and** `tsc -p tsconfig.app.json` — done at 190-05, 190-12, 190-16, 190-17, 190-18
- **Before `/gsd:verify-work`:** both suites measured, count gate green, `tsc` at 33 — **done at
  close**, above
- **Before `/gsd:secure-phase`:** every falsification row observed **RED first**, plant restored,
  `grep -c PLANT` → 0 in production source — **done**, below
- **Max feedback latency measured:** < 8 s (quick) / 486 s (full backend)

---

## Wave 0 Requirements — THE THREE RED TESTS ✅ ALL THREE OBSERVED RED

| # | Test | Property | RED observed by | Verdict |
|---|------|----------|-----------------|---------|
| **W0-1** | `tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress` | **D-16** — publishing must not send | **190-13**, on the send commit, then green on the gate in that **same** commit | ✅ **and the fence itself was repaired first** — it was VACUOUS (bound no connection; `live_connectors` off by cold default), so it could not have fired on the commit it was armed for. Both preconditions now set AND asserted inside it |
| **W0-2** | `tests/unit/test_190_cross_org_credential.py` | **D-14** — org A must not resolve org B's connection | **190-01** (weak, module-missing) → **190-06** (MEANINGFUL: the leak REPRODUCED) | ✅ `RESOLVED SECRET FOR ORG A : xoxb-ORG-B-REAL-BOT-TOKEN-…` / `LEAKED : True` |
| **W0-3** | `tests/unit/test_190_egress_ordering.py` | **D-06** — the guard runs BEFORE credential resolution | **190-01** (weak) → **190-02** (behavioural) → **190-13** (the n8n ordering driven into production source) | ⚠ **✅ CORRECTED — see the block immediately below.** The ordering IS driven and the RED was real (an unbound step aimed at `169.254.169.254` raised **nothing at all**), but the ✅ over-stated its SCOPE: three of the four cases drive a duck-typed config the shipped model **rejects**, so what W0-3 proves for `create_ticket` / `send_email` is narrower than this row read |

### ⚠ CORRECTION TO W0-3's ✅ — code review **WR-01**, 2026-08-09

**A false ✅ is corrected here rather than left standing.** This is a documentation fix, not
a code fix: WR-01's code half is DEFERRED as `D-190-DEF-10` (its honest repair touches
`ExternalActionPhaseConfig`'s `extra='forbid'` contract and the D-13 config shape, and there
is **no reachable bypass** — both binders call `validate_destination` as their first
statement). What is not deferred is the score.

**What the row claimed:** that D-06's pre-credential ordering is proved.

**What is actually true, measured:**

`_pre_credential_destination` returns the step's `base_url` if one exists, else the
per-capability constant `{"post_message": SLACK_API_BASE, "create_ticket": None,
"send_email": None}`. `ExternalActionPhaseConfig` is a `_StrictBase` (`extra='forbid'`) and
carries **no `base_url`** — `models/harness.py:257` adds `connection_id` and nothing else. So
for a real, model-validated step:

| capability | GATE 3 before the credential |
|---|---|
| `post_message` | validates the code constant `https://slack.com/api/` — always passes |
| `create_ticket` | `destination is None` → **`validate_destination` is never called** |
| `send_email` | `destination is None` → **`validate_destination` is never called** |

Three of `test_190_egress_ordering.py`'s five cases drive a duck-typed `SimpleNamespace`
carrying `base_url` — a shape the shipped model rejects — and **the test file says so itself**
(`:45-52`: *"A duck-typed config therefore cannot catch a model that rejects the destination
field … Recorded here as a known limit of this drive, not as a property it proves"*). The
fourth case (`…_on_a_MODEL_VALIDATED_phase`, added at 190-13) is the one that drives the real
model, and it uses `post_message` **precisely because** that is the only capability whose
destination is knowable with no credential and no row.

The executor's own docblock (`phase_types.py:2097-2104`) states the property as an absolute —
*"a send with **no credential bound at all** raises the EGRESS REFUSAL rather than a
missing-credential error"* — and that sentence is **false for two of the three capabilities as
shipped**. It is corrected in `D-190-DEF-10`'s entry rather than here.

**What W0-3 does prove, stated narrowly and truthfully:** for `post_message`, the guard runs
before the resolver, and the recorded call order `["egress", "resolve"]` is asserted on the
SHIPPED config shape. For the other two capabilities the guard runs at the BINDER — before the
socket, after the resolve — which is a real property but not the structural one D-06 exists to
make regression-proof.

**Wave 0 files — all created, all green at HEAD (counts re-derived per file at close):**

- [x] `backend/tests/unit/test_190_egress.py` — **77 passed** (29-address corpus, scheme, §R15 label boundary, redirect, IP pin, size cap). T1–T4, T11, T14
- [x] `backend/tests/unit/test_190_egress_ordering.py` — **5 passed** (W0-3, D-06)
- [x] `backend/tests/unit/test_190_cross_org_credential.py` — **3 passed** (W0-2, D-14)
- [x] `backend/tests/unit/test_190_connector_source_fence.py` — **8 passed** (D-05 + D-04, with planted positive controls)
- [x] `backend/tests/unit/test_190_credentials.py` — **8 passed** (D-11 fail-CLOSED both ends; T5–T7)
- [x] `backend/tests/unit/test_190_smtp_header_injection.py` — **13 passed** (T12 + its positive control)
- [x] `backend/tests/unit/test_190_slack_ok_false.py` — **25 passed** (T13)
- [x] `frontend/src/components/workflows/ConnectionPicker.test.tsx` — **20 passed**, registered with `scripts/vitest-count-gate.cjs` in the SAME commit that created it
- [x] `ExternalActionSection.test.tsx`'s six purity fences **re-run post-mount** (§M4) — all green, file unmoved at **34** tests
- [x] **No framework install needed** — confirmed at close: `git diff --numstat 83a93c9a HEAD -- backend/requirements.txt frontend/package.json frontend/package-lock.json` prints **nothing**

**Plus, not in the original Wave-0 list, all green at HEAD:** `test_190_ssti_fence.py` (11),
`test_190_residual_fence.py` (5), `test_190_jira_adapter.py` (17), `test_190_connectors_api.py`
(12), `test_190_connector_check.py` (14), `test_189_no_egress.py` (23), `test_harness_engine.py`
(50 — baseline 46 + 4).

**Combined run at close:** all sixteen 190/189 suites →
`305 passed, 0 failed, 1 warning in 7.21s`.

---

## The Security Falsification Set (D-28 + two net-new) — ✅ 14 / 14 OBSERVED RED

**Every row was OBSERVED RED against a real plant in production source**, then restored, with
`grep -c PLANT` → **0** in every production file. Verified phase-wide at close (§ Close).

⚠ **The Phase-185 lesson held: verify the PROPERTY, not the PATCH.** 190-14 replaced D-05's six
literal substrings with property matchers after measuring the substring form wrong in **both**
directions.

| # | Threat | Plan | Test | The plant | Verbatim RED (recorded at the time) |
|---|--------|------|------|-----------|--------------------------------------|
| **T1** | SSRF via org-configured host | **190-02** PLANT 5 | `test_T1_the_cloud_metadata_endpoint_is_refused_by_the_resolve_step` | delete the `refuse_reason` call from the resolve step | `E Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>` ×3 → **3 failed, 67 passed** |
| **T2** | DNS rebinding / TOCTOU | **190-07** PLANT T2 | `test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one` | replace `url.copy_with(host=pinned.ip)` with the hostname URL | `assert 'slack.com' == '142.250.185.78'` + `INFO httpx: HTTP Request: POST https://slack.com/api/chat.postMessage` → **2 failed, 75 passed** — the request going out **by name** |
| **T3** | Redirect-based bypass | **190-07** PLANT T3 | `test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed` | flip `follow_redirects=True` | `httpx.TooManyRedirects` + **twenty logged** `GET http://169.254.169.254/latest/meta-data/` → **1 failed, 76 passed**. ⭐ *The pin held on request 1 and the redirect walked around it* |
| **T4** | Cloud metadata endpoint (29-address corpus) | **190-02** PLANTS 1–4, **four separate REDs** | `test_every_corpus_address_gets_the_right_verdict[…]` · `test_each_of_the_four_unwrap_clauses_is_load_bearing` · `test_the_audited_address_is_the_UNWRAPPED_one_not_the_wrapper` | delete `ipv4_mapped` / `_V4_TRANSLATED` / `_NAT64` / `_SITE_LOCAL` **individually** | `::ffff:224.0.0.1 was ALLOWED` (3f/67p) · `::ffff:0:7f00:1 was ALLOWED but must be refused — IPv4-TRANSLATED (SIIT) — HOLE 3` (3f/67p) · `64:ff9b::a9fe:a9fe was ALLOWED` (4 failing) · `fec0::1 was ALLOWED` (2f/68p). ⭐ **PLANT 2 is the hole that would have shipped** |
| **T5** | Credential leak in logs | **190-06** case 5 (+ **190-13** receipt, **190-18** plant J) | `test_190_credentials.py` case 5 · `test_a_successful_send_writes_a_receipt_that_carries_no_credential` | log the whole `row` instead of `row["id"]` | `E AssertionError: T5: the stored CIPHERTEXT reached a log line.` … `E assert 2 == 0`, the captured line carrying `'secret_ciphertext': 'enc:v1:gAAAAABqd3jO…'`. ⭐ **The CIPHERTEXT assertion fired, not the plaintext one** |
| **T6** | Credential leak in the definition JSONB | **190-12** plant 1 (+ **190-06** config models) | `ConnectionPicker.test.tsx` T6 case | `patchConfig(slug, { connection_id: id, smtp_password: "hunter2" })` | `AssertionError: expected [ 'connection_id', 'smtp_password' ] to deeply equal [ 'connection_id' ]` |
| **T7** | Credential leak in an SSE / API response | **190-06** case 6 · **190-09** case 6 · **190-16** plant G | module-scope projection assert · `test_190_connectors_api.py` case 6 · the rendered-markup sweep | add `secret_ciphertext: str \| None = None` to `ConnectorConnectionResponse` | **exit 4, a COLLECTION ERROR** — `connector_service.py:101` → `E AssertionError: T7: ConnectorConnectionResponse grew a secret-bearing field … Fields: ('id', 'org_id', 'secret_ciphertext', …)`. Plus `AssertionError: expected '<section aria-label="connections" …' not to contain 'secret'`. ⚠ **the SSE half is ARGUED, not driven — see below** |
| **T8** | **Cross-org credential resolution (D-14)** | **190-06** (W0-2) + case 8 | `test_a_connection_id_from_another_org_does_not_resolve` · the post-fetch belt | id-only `SELECT`; then, separately, remove the post-fetch `row["org_id"] != org_id` re-check | `RESOLVED SECRET FOR ORG A : xoxb-ORG-B-REAL-BOT-TOKEN-NEVER-CROSS-A-TENANT` / `LEAKED : True`; committed drive **2 failed, 1 passed**; belt plant `E Failed: DID NOT RAISE ConnectorNotFound`. ⭐ **The RECORDED-FETCH-CALL assertion fired, not `pytest.raises`** |
| **T9** | SSTI via a composed field | **190-14** PLANTS C · D · E · F | `test_no_unsandboxed_jinja_environment_exists_on_the_connector_path` · `test_the_shipped_sandboxed_path_is_still_the_only_jinja_path` · the behavioural drive | `Environment(autoescape=True)` in `phase_types.py` · a bare `eval(` in `slack_adapter.py` · `__import__` in `egress.py` · `SandboxedEnvironment(` → `Environment(` at the shipped site | `SC#3 / D-09: an evaluator appeared on the connector send path … phase_types.py:1975` · `slack_adapter.py:341: a bare eval(` · `egress.py:331: __import__` · ⭐ **PLANT F caught the fence being INERT** — the named-site assertion passed, satisfied by the **docstring eighteen lines above** the construction |
| **T10** | **Publish-time egress (D-16)** | **190-13** (W0-1) | `test_a_golden_run_of_an_external_action_performs_no_egress` | remove the `getattr(ctx, "is_golden_run", False)` gate — i.e. author the send without it | `190: external_action phase 'notify' failed to send: nothing answered at the Slack API: httpx.AsyncClient.send was called - outbound egress attempted` → `1 failed, 45 deselected`. ⭐ **PUBLISHING performed the external action** |
| **T11** | Unbounded response / decompression | **190-07** PLANT T11 | `test_T11_an_oversized_response_is_capped_and_fails_cleanly` · `test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size` | remove all three caps (Content-Length pre-check, `aiter_raw` wire cap, `decompress` `max_length`) | `E Failed: DID NOT RAISE <class 'Exception'>` ×2 → **2 failed, 75 passed**. A 5 KB body expanding to 5 MB sailed through |
| **T12** | **SMTP header injection** | **190-08** PLANT A **and** PLANT B | `test_a_CRLF_in_the_subject_is_REFUSED_not_stripped_and_not_a_500` + 12 more | A: `send_message(msg)` → raw-string `sendmail(...)`. B: headers built by **string concatenation**, bypassing composition | A → **6 failed, 7 passed**. ⭐ B → **8 failed, 5 passed** with `send() RETURNED: AdapterResult(ok=True…)` over a wire reading `Subject: Renewal\r\nBcc: attacker@evil.com` — *an RFC-5322 parser reads `Bcc: attacker@evil.com`*. ⚠ **A alone leaves the three CR/LF cases GREEN** — it falsifies the source fence, not T12 |
| **T13** | ⭐ **Slack `ok:false` read as success** | **190-11** (+ **190-10** PLANT B, the Jira analogue) | `test_a_200_with_ok_false_lands_FAILED_and_never_COMPLETED` + 12 more | check only `resp.status_code` — remove the `ok` gate | **13 failed, 12 passed**, with the success path logging `post_message: one message posted (channel=C0123ABCDEF ts=None)` for a reply saying `channel_not_found` — ⭐ **the SAME line a real success writes, except Slack's own timestamp is `None`**. Jira analogue: `create_ticket: one issue created (project=OPS key=UNKNOWN)` returning `ok=True` for a body carrying `errorMessages` |
| **T14** | ⭐ **Host userinfo / homograph bypass** | **190-02** PLANT 6 (+ **190-11**, per-capability with an inline positive control) | `test_the_host_comes_from_the_PARSED_url_never_the_raw_string` · `test_host_matching_is_a_label_boundary_never_a_substring` · `test_a_userinfo_or_homograph_host_cannot_reach_slack` | match against the raw URL string instead of `httpx.URL(u).host` | **13 failed, 57 passed** — `slack.com@evil.com`, `slack.com:443@evil.com`, `evil.com/?x=https://slack.com`, `evil.com#slack.com` and `slack.com.evil.com` **all ACCEPTED under the plant** |

**Rows with no recorded RED: NONE.** All fourteen carry a plan, a test, a plant and a verbatim
transcript.

### Plant hygiene — measured phase-wide at close, not inherited

```
$ grep -rc PLANT backend/app          → ZERO occurrences in every file
$ grep -rln PLANT frontend/src | grep -v '\.test\.tsx\?$'   → (nothing)
$ grep -rn "PLANT-" backend/app frontend/src                → (nothing)
```

⚠ **The plan's criterion `grep -rc PLANT backend/app backend/tests frontend/src` → `0` for every
file is UNSATISFIABLE as literally written, and this was measured rather than gamed.** Nine
backend test files and four frontend test files carry the word — every one of them **prose**:
docstrings recording what the plant was, which is the legibility 190-06 argued for and which a
reviewer needs in order to judge whether a RED meant anything. The intent is satisfied where it
matters and it was proved **mechanically, not by eye**:

```
$ python - <<'PY'   # tokenize each backend test file; flag any PLANT token that is
                    # neither a STRING nor a COMMENT
NON-STRING / NON-COMMENT `PLANT` tokens: 0
PY
```

**Zero executable plant residue anywhere.** This is the same class of criterion conflict recorded
at 190-06, 190-07, 190-10, 190-11, 190-13, 190-15, 190-17 and 190-18 — stated, measured, and
resolved in favour of the property rather than the grep.

---

## Source Fences (empty-diff and zero-occurrence) — ✅ 7 / 7 GREEN

| Fence | Assertion | Carried by | Positive control driven by | Result at HEAD |
|-------|-----------|------------|----------------------------|----------------|
| **D-05** | `backend/app/services/connectors/**` constructs no HTTP or SMTP client, **in any spelling** | `test_190_connector_source_fence.py::test_no_connector_module_names_a_transport` (+ `test_the_banned_token_matcher_actually_matches`, `test_the_walk_is_not_vacuous`) | **190-14** PLANT A — a real `httpx.AsyncClient()` in `slack_adapter.py`, **carrying no `import httpx`**, caught by the attribute-read matcher | ✅ **8 passed**. ⚠ D-05's six literal substrings were **REPLACED by property matchers**: the substring form under-fires (`import requests` contains none of the six) *and* over-fires (a docstring ending *"…the number of requests."* contains one). The control proves all six contract tokens still fire |
| **D-23** | `git diff --numstat` on `PhaseFormPanel.tsx` reads `0 0` | self-evidencing | — | ✅ **empty**, phase-wide, against **both** `83a93c9a` and `de122b9a`, existence confirmed at both revs first |
| **D-24** | the same for `PhaseNode.tsx`, `PhaseNodeCard.tsx`, `phaseNodeCardContract.ts`, `ownProperty.ts`, `NodeCornerMarks.tsx`, `NodeRunOverlay.tsx`, `NodeIconWell.tsx` | self-evidencing | — | ✅ **empty**, same three comparisons |
| **§M4** | `ExternalActionSection.test.tsx`'s **six** purity fences still pass *after* the `ConnectionPicker` mount line lands | `ExternalActionSection.test.tsx` — six `expect().not.toMatch()` calls across **THREE** `it()` blocks (not six), with a fourth block as their shared control | shipped controls at `:398-412` | ✅ **RE-RUN post-mount at 190-12**, not trusted — all green, file unmoved at **34 tests** |
| **§M3** | `phaseVocabulary.ts` still has **zero** import statements | `phaseVocabulary.test.ts` (190-05's fence + 189-13's shipped one) | **190-05** — a real `import type { PhaseNodeData }` planted in **production** source; **both** fences fired; restored md5-identical `514bc7ec…` | ✅ re-derived at close: `grep -cE "^\s*(import\|const .* = require\()"` → **0** |
| **D-04** | the adapter registry's key set `==` `EXTERNAL_ACTION_CAPABILITIES`, **derived, never re-typed** | module-scope `assert` in `registry.py` + `test_the_registry_key_set_is_derived_not_retyped` | **190-14** PLANT B — a 4th key `"send_sms"` | ✅ and the RED is **stronger than a failing test**: the plant **aborted the whole pytest session at COLLECTION**, because the assert fires while `conftest.py` imports `app.main`. *A fourth capability is a phase, not a dictionary entry.* Recorded as what it was: `test_the_registry_key_set_is_derived_not_retyped` did **not** report RED — nothing could run |
| **RESIDUAL-190-01** | `"_host" not in inspect.getsource(smtplib.SMTP.connect)` **and** `"sni_hostname" in inspect.getsource(httpcore._async.connection)` | `test_190_residual_fence.py` — 5 tests | **190-07** PLANTS A and B, each simulating a real library change, each turning **exactly its own** case RED | ✅ **5 passed** |

**RESIDUAL-190-01 is a named residual risk, not a defect** — carried in full to
`/gsd:secure-phase 190` in § Residuals below, including the measured correction that its stated
trigger *cannot fire*.

---

## Per-Task Verification Map — 51 / 51 tasks, every one with an automated command

> Task count re-derived, not inherited: `grep -c "<task type=" 190-*-PLAN.md` sums to **54**
> across plans 01–19; minus this plan's own 3 = **51** tasks in plans 190-01…190-18.
> **Sampling continuity: NO run of 3 consecutive tasks without an automated verify** — stated
> explicitly below the table, as the plan requires.

| Task | Plan | Wave | Req | Threat ref | Secure behaviour | Type | Automated command | Status |
|---|---|---|---|---|---|---|---|---|
| 1 W0-2 cross-org drive, RED | 190-01 | 0 | CONN-03 | T8 / D-14 | org A cannot resolve org B's connection | unit | `pytest tests/unit/test_190_cross_org_credential.py -q` | ✅ 3 |
| 2 W0-3 ordering drive, RED | 190-01 | 0 | CONN-03 | D-06 | guard refuses before credential resolution | unit | `pytest tests/unit/test_190_egress_ordering.py -q` | ✅ 5 |
| 3 re-scope the sentinel's DRIVE | 190-01 | 0 | CONN-03 | T10 / D-16 | publishing performs no egress | unit | `pytest tests/unit/test_189_no_egress.py -q` | ✅ 23 |
| 1 corpus + host + scheme tables, RED | 190-02 | 1 | CONN-03 | T1/T4/T14 | 29 addresses, label boundary, TLS-only | unit | `pytest tests/unit/test_190_egress.py -q` | ✅ 77 |
| 2 build the validator | 190-02 | 1 | CONN-03 | T1/T4 | ordered guard: capability→scheme→host→every address | unit | same | ✅ 77 |
| 3 four separate clause REDs | 190-02 | 1 | CONN-03 | T4 | each `_unwrap` clause load-bearing | unit | `pytest tests/unit/test_190_egress.py -k unwrap -q` | ✅ |
| 1 migration 116 | 190-03 | 1 | CONN-03 | T8 | org-scoped table, 4 RLS policies, no escape branch | schema | `pg_policies` count = 4 · `relrowsecurity = t` | ✅ |
| 2 migration 117 + the Python mirror | 190-03 | 1 | CONN-03 | — | both audit layers move in ONE commit | unit | `pytest tests/unit/test_audit_event_registration.py -q` | ✅ 6 |
| 3 [BLOCKING] apply both + regenerate | 190-03 | 1 | CONN-03 | T-190-03-DATA | live schema matches the migrations | schema | `len(_AUDIT_EVENT_TYPES)` → **24**; `ls supabase/migrations \| wc -l` → **111** | ✅ ⚠ recorded deviation: applied via `psycopg2`, not the SQL editor (D-21 sanction, 189-06 precedent) |
| 1 the D-01 amendment | 190-04 | 1 | CONN-02 | T-190-04-01 | append-only; the verdict untouched | doc | `git diff -U0 docs/CONNECTOR-ARCHITECTURE.md \| grep -c '^-[^-]'` → **0** | ✅ |
| 2 D-v3.6-02 + ROADMAP SC#1 | 190-04 | 1 | CONN-02 | T-190-04-02 | superseded wording preserved | doc | `awk '/^#### Phase 190/,/^#### Phase 191/' \| grep -c "MCP-backed action nodes"` → **1** | ✅ |
| 3 deploy parity + ledger row | 190-04 | 1 | CONN-02 | T-190-04-04 | zero new env vars; artefacts unmoved | script | `bash scripts/check-deploy-drift.sh` → **PASS**, exit 0 | ✅ |
| 1 bound/unbound pair + zero-import fence, RED | 190-05 | 1 | CONN-02 | T6 / §M3 | a bound step loses the badge; the module keeps zero imports | unit | `npx vitest run …/phaseVocabulary.test.ts` | ✅ 117 |
| 2 edit exactly one line | 190-05 | 1 | CONN-02 | T-190-05-BADGE | one code line at `:812`; no badge added | unit + tsc | same + `tsc -p tsconfig.app.json` → **33** | ✅ |
| 3 plant the import, prove eight empty diffs | 190-05 | 1 | CONN-02 | D-23/D-24 | eight fenced files `0 0` | git | `git diff --numstat de122b9a HEAD -- <8>` → empty | ✅ |
| 1 the models + the ONE additive field | 190-06 | 2 | CONN-03 | T6/T7 | `extra='forbid'`; a response model that cannot carry a secret | unit | `pytest tests/unit/test_190_credentials.py -q` | ✅ 8 |
| 2 id-only resolver FIRST, observe the leak, then scope | 190-06 | 2 | CONN-03 | **T8** | two gates: scoped query **and** post-fetch re-check | unit | `pytest tests/unit/test_190_cross_org_credential.py -q` | ✅ 3 |
| 3 D-11 both ends, T5, T7 | 190-06 | 2 | CONN-03 | T5/T7/D-11 | fail-CLOSED at write and read; no credential in a log or a response | unit | `pytest tests/unit/test_190_credentials.py -q` | ✅ 8 |
| 1 T2/T3/T11 cases, RED | 190-07 | 2 | CONN-03 | T2/T3/T11 | pin, no redirects, both caps | unit | `pytest tests/unit/test_190_egress.py -q` | ✅ 77 |
| 2 the two binders | 190-07 | 2 | CONN-03 | T2/T2b | connect to the validated IP; TLS identity survives | unit | same | ✅ |
| 3 RESIDUAL-190-01 + the three plants | 190-07 | 2 | CONN-03 | T-190-07-RES | a library change that un-pins fails loudly | unit | `pytest tests/unit/test_190_residual_fence.py -q` | ✅ 5 |
| 1 protocol + registry | 190-08 | 3 | CONN-02 | **D-04** | key set derived from the frozenset | unit | `pytest tests/unit/test_190_connector_source_fence.py -q` | ✅ 8 |
| 2 T12 drive + positive control, RED | 190-08 | 3 | CONN-03 | **T12** | CR/LF refused, not stripped; the envelope validated separately | unit | `pytest tests/unit/test_190_smtp_header_injection.py -q` | ✅ 13 |
| 3 `smtp_adapter.py` | 190-08 | 3 | CONN-02 | T12/D-05 | compose with `EmailMessage`; name no transport | unit | same | ✅ 13 |
| 1 `api/connectors.py` | 190-09 | 3 | CONN-02 | T-190-09-U02 | API-enforced org-admin writes; one 404 for every miss | unit | `pytest tests/unit/test_190_connectors_api.py -q` | ✅ 12 |
| 2 register + the kill-switch | 190-09 | 3 | CONN-03 | **D-26** | `live_connectors` in `_VISIBILITY_FEATURES`, cold default off, ZERO migrations | unit | same + `ls supabase/migrations \| wc -l` → **111** | ✅ |
| 3 the client functions | 190-09 | 3 | CONN-02 | T7 | the TS type declares no credential | tsc | `tsc -p tsconfig.app.json` → **33** | ✅ |
| 1 the Jira drive, RED | 190-10 | 4 | CONN-02 | T-190-10-ADF | an author-supplied document is REFUSED | unit | `pytest tests/unit/test_190_jira_adapter.py -q` | ✅ 17 |
| 2 `jira_adapter.py` | 190-10 | 4 | CONN-02 | T13-analogue | `ok=True` needs 2xx **and** no envelope **and** an issue KEY | unit | same | ✅ 17 |
| 1 T13 drive, RED | 190-11 | 4 | CONN-03 | **T13** | success IFF `200` **and** `ok is True` (identity) | unit | `pytest tests/unit/test_190_slack_ok_false.py -q` | ✅ 25 |
| 2 `slack_adapter.py` | 190-11 | 4 | CONN-02 | T13/T14 | code-constant host; `_endpoint` cannot see stored data | unit | same | ✅ 25 |
| 1 `SelectedPhaseSlugContext` | 190-12 | 4 | CONN-02 | **D-23** | the write seam keeps `PhaseFormPanel.tsx` at `0 0` | unit + git | `npx vitest run …/ConnectionPicker.test.tsx` + numstat | ✅ 20 |
| 2 `ConnectionPicker.tsx` | 190-12 | 4 | CONN-03 | **T6** | only `connection_id` crosses into the JSONB | unit | same | ✅ 20 |
| 3 mount in ONE line, re-run the six fences | 190-12 | 4 | CONN-02 | §M4 | the section stays a pure leaf | unit | `npx vitest run …/ExternalActionSection.test.tsx` | ✅ 34 |
| 1 the ordered executor, W0-1 RED→green | 190-13 | 5 | CONN-02/03 | **T10 / D-16** | publishing skips the SEND, keeps the record | unit | `pytest tests/test_harness_engine.py -q` | ✅ 50 |
| 2 retire the false docblock; assert resume unreachability | 190-13 | 5 | CONN-03 | **A4** | a golden run is not a thing to resume | unit | `pytest tests/test_harness_engine.py tests/unit/test_harness_resume* -q` | ✅ ⭐ **found REACHABLE, closed at the root** |
| 3 the receipt, W0-3 green, the sentinel green | 190-13 | 5 | CONN-03 | D-06/T5/D-17 | guard before resolve; the receipt carries no credential | unit | `pytest tests/unit/test_190_egress_ordering.py tests/unit/test_189_no_egress.py -q` | ✅ 5 + 23 |
| 1 the D-05 source fence | 190-14 | 5 | CONN-03 | **D-05/D-04** | no transport imported; the key set derived | unit | `pytest tests/unit/test_190_connector_source_fence.py -q` | ✅ 8 |
| 2 the SC#3 fence | 190-14 | 5 | CONN-03 | **T9** | no evaluator on the path; a composed field renders literally | unit | `pytest tests/unit/test_190_ssti_fence.py -q` | ✅ 11 |
| 1 the dedicated check action | 190-15 | 6 | CONN-02 | T-190-15-CHK | takes an id and NOTHING else; sends nothing | unit | `pytest tests/unit/test_190_connector_check.py -q` | ✅ 14 |
| 2 Gate 2 — org + `is_enabled` ONLY | 190-15 | 6 | CONN-02 | U-07a | a failed verdict blocks neither the bind nor the run | unit | same + `grep -c "last_check_verdict" phase_types.py` → **0** | ✅ 14 |
| 3 the client function | 190-15 | 6 | CONN-02 | — | `Check credential` actually renders | unit | `npx vitest run …/ConnectionsTab.test.tsx` | ✅ 36 |
| 1 `ConnectionsTab.tsx` | 190-16 | 5 | CONN-02 | T-190-16-T7/U02 | no credential rendered; a non-admin's write affordances are ABSENT | unit | `npx vitest run …/ConnectionsTab.test.tsx` | ✅ 34→36 |
| 2 `SettingsPage.tsx` — the sixth tab | 190-16 | 5 | CONN-02 | D-25 | routing key 5; zero renumbered keys | unit + grep | same + `grep -c 'value="5"'` → **2** | ✅ |
| 3 the suite + the count-gate pin | 190-16 | 5 | CONN-02 | — | both gate knobs move in the creating commit | gate | `node scripts/vitest-count-gate.cjs` | ✅ OK |
| 1 the push/split shell | 190-17 | 6 | CONN-02 | T-190-17-FOCUS | a real focus trap and restore | unit | `npx vitest run …/ConnectionFormPanel.test.tsx` | ✅ 31→63 |
| 2 fields, 🔒 footer, org-shared line | 190-17 | 6 | CONN-02 | T-190-17-SECRET/DEST | secret is TEXT on edit; footer always on | unit | same | ✅ |
| 3 the suite + the count-gate pin | 190-17 | 6 | CONN-02 | — | the pin catches a deletion | gate | `node scripts/vitest-count-gate.cjs` | ✅ OK |
| 1 `connectionRefusalCopy.ts` | 190-18 | 7 | CONN-03 | T-190-18-CODE | the closed six-row map, fenced on BOTH sides of the language boundary | unit | `npx vitest run …/ConnectionFormPanel.test.tsx` | ✅ 63 |
| 2 the two asymmetric refusals + the guards | 190-18 | 7 | CONN-03 | T-190-18-ASYM | egress leaves Save enabled; `no_encryption_key` disables it with a RESOLVING `aria-describedby` | unit | same | ✅ 63 |
| 3 character-identity assertions + the pin | 190-18 | 7 | CONN-03 | T-190-18-SWAP | a refusal never renders `fail*`; an unreachable host never renders `refus*` | unit | same + count gate | ✅ ⭐ **the whole-word fence was MEASURED not to work** |

**SAMPLING-CONTINUITY CHECK — STATED EXPLICITLY:**
**No 3 consecutive tasks without an automated verify.** Every one of the 51 rows carries an
`<automated>` command that was run. **Zero exceptions, and none is claimed.** The single
`checkpoint:human-action` in the phase (190-03 Task 3, the migration apply) carries **four live
DB checks** driven after the apply, so even the human-gated task has mechanical verification.

---

## SC#10 — The 8-Row Cross-Provider Scoreboard

**The roster is DERIVED from `MODEL_CAPABILITIES`, never re-typed.** Both the derivation command
and its output are pasted here so the next reader can re-derive rather than trust.

```
$ cd backend && venv/Scripts/python.exe -c "from app.config import MODEL_CAPABILITIES as M; \
    import collections; c=collections.Counter(v['provider'] for v in M.values()); \
    print(len(M), len(c)); print(sorted(c.items()))"
61 8
[('anthropic', 7), ('deepseek', 2), ('google', 7), ('minimax', 8),
 ('moonshot', 3), ('openai', 17), ('openrouter', 9), ('zhipu', 8)]
```

```
$ cd backend && venv/Scripts/python.exe -c "
import re, collections
from app.config import MODEL_CAPABILITIES as M
def ver(mid): return tuple(int(x) for x in re.findall(r'\d+', mid))
g = collections.defaultdict(list)
for k, v in M.items(): g[v['provider']].append(k)
for p in sorted(g):
    rep = max(g[p], key=lambda m: (ver(m), m)); c = M[rep]
    print(p, rep, len(g[p]), c.get('native_tools'), c.get('emit_tier'))"

provider    representative (newest)      n      native_tools  emit_tier
anthropic   claude-sonnet-5              7      True          force
deepseek    deepseek-v4-pro              2      True          force
google      gemini-3.5-flash             7      True          force
minimax     MiniMax-M3                   8      True          force
moonshot    kimi-k2.6                    3      True          coerce
openai      gpt-5.6-terra                17     True          force_strict
openrouter  z-ai/glm-5.2                 9      False         force
zhipu       glm-5.2                      8      True          force
```

**Every representative EXISTS in `MODEL_CAPABILITIES` by construction** — each is a key of the
registry, selected by grouping and taking the highest version tuple. None is hand-typed, so none
can resolve `capability_source=inferred` and silently lose `emit_tier`.

**What each row exercises:** a **published workflow containing an `external_action` step, run end
to end**, per provider. A connector step is not an LLM step — the row proves the *surrounding
run* is provider-correct while the step itself sends.

| # | Provider | Representative model | `native_tools` | `emit_tier` | Status |
|---|----------|----------------------|---|---|--------|
| 1 | openai | `gpt-5.6-terra` | True | `force_strict` | ⛔ **BLOCKED — no runnable artefact (BLOCK-190-UAT-01)** |
| 2 | anthropic | `claude-sonnet-5` (native SDK) | True | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 3 | google | `gemini-3.5-flash` (historically the highest-risk tool-call row) | True | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 4 | deepseek | `deepseek-v4-pro` (`strict_json_schema` inert — D-122-04) | True | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 5 | zhipu | `glm-5.2` | True | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 6 | minimax | `MiniMax-M3` | True | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 7 | moonshot | `kimi-k2.6` (the only `emit_tier: coerce` native rows) | True | **`coerce`** | ⛔ **BLOCKED — BLOCK-190-UAT-01** |
| 8 | openrouter | `z-ai/glm-5.2` (the non-native tool path) | **False** | `force` | ⛔ **BLOCKED — BLOCK-190-UAT-01** |

**⛔ rows, never silent omissions. All eight are present; none was dropped.**

### BLOCK-190-UAT-01 — the blocking dependency, MEASURED at close rather than assumed

Every SC#10 row requires *a published workflow containing an `external_action` step*. That
artefact **does not exist**, and neither do two further preconditions. Measured against the live
local database (`psycopg2`, `127.0.0.1:54322`) on 2026-08-09:

```
connector_connections rows                                    → 0
workflow_definitions by status                                → published 129 · draft 79
published defs containing an external_action phase            → 1   ⚠ CORRECTED
ANY def (any status) containing an external_action phase      → 5   ⚠ CORRECTED
app_settings.feature_visibility                               → {skill_studio, model_management,
                                                                 governance_health, workflow_authoring,
                                                                 visual_workflow_canvas}
                                                                 — `live_connectors` ABSENT ⇒ cold default "off"
```

> ### ⚠ CORRECTION (2026-08-09, at phase verification) — the two `external_action` counts above were FALSE
>
> The close's SQL read `definition->'phases'`, but **`workflow_definitions.definition` is a jsonb
> column holding a JSON *string scalar* for 194 of 222 rows**, so that expression silently returns
> zero rows rather than erroring. Re-derived two ways that agree: a raw
> `definition::text LIKE '%external_action%'` → **5**, and a Python walk after unwrapping the
> string scalar. The published one is **`ff3c6ca3` "Weekly Status Report"** (`send_email`), authored
> during Phase 189's UAT.
>
> A second level error compounded it: **`phase_type` lives inside `phase["config"]`, not at the
> phase top level** — a structural walk reading `phase["phase_type"]` also returns 0. Both the
> close's query and the first correction attempt made that mistake.
>
> **Consequence — this is the part that matters: `BLOCK-190-UAT-01` is TWO links, not three.**
> Link 1 below is already satisfied. The owed rows need a destination and the flag; **they do not
> need authoring.** The correct query form is
> `((definition #>> '{}')::jsonb)` first, then read `phase['config']['phase_type']`.

So the chain each row needs is **two links long; link 1 is already satisfied**:

1. **an `external_action` step authored into a definition, and that definition published** — zero
   definitions in the entire database contain one;
2. **a bound `connector_connections` row** — zero rows, and the create endpoint is gated on
   `live_connectors`, so one cannot be made until (3);
3. **`live_connectors` turned ON** — an **operator** action by design (`PUT /admin/visibility`,
   D-26 / D-25: *the operator sets the lock*), and there is still **no Control Room card for it**
   (`D-190-DEF-09`).

**Why this plan did not simply build them.** Authoring a workflow, publishing it and flipping a
platform-wide kill-switch are not measurements — they are new artefacts and a **global setting
change** in the operator's live environment. CLAUDE.md's own scoreboard recipe praises the
Phase-185 method precisely because it *"scores the whole board without mutating any global
setting, so the operator's environment is untouched"*; turning `live_connectors` on is exactly
such a mutation. G-7 and D-32 also forbid a closing documentation plan from shipping new surface.
**Stated as a decision, not as an inability.**

### The measured method (§M1), preserved — it is still correct and still costs what it says

There is no workflow-run POST route; a run launches through `POST /threads/{thread_id}/messages`,
and `MessageCreate` carries `model`, `provider` **and** `workflow_definition_id` on one request.
**Per-request routing WORKS** — no global setting is mutated by the routing itself, so rows
cannot contaminate each other and the operator's model preference is untouched.

**The measured cost:** the per-thread anchor takes a **409 lock**
(`workflow_kickoff.py:146-173`), so **8 rows need 8 DISTINCT THREADS to run in parallel; two rows
on one thread are serial.** This is a plan input, recorded before UAT rather than discovered
during it.

**What is already proved without these rows:** the connector layer is provider-agnostic by
construction — `_adapter_args` is a closed two-column projection and no adapter reads a model or
a provider (`grep -c "provider\|model" ` over the three adapters returns only vendor-name prose).
What the eight rows would prove is that the **surrounding run** is provider-correct, which is a
harness property, not a connector property. That is why they are ⛔ rather than fatal.

---

## The Other Three SC#10 Axes (CLAUDE.md UAT recipe)

| Axis | Required row | Status |
|------|--------------|--------|
| **Multi-tool** | a workflow with `retrieve` (KB) **+** `external_action` in one run | ⛔ **BLOCKED — BLOCK-190-UAT-01** (the same missing artefact). **Partial automated cover:** `test_190_ssti_fence.py::test_the_composition_layer_is_a_closed_lookup_not_a_language` drives the real executor end-to-end with an upstream phase feeding the connector step, asserting the adapter-call count is exactly **1** |
| **Parallel-thread** | Thread A streaming a workflow run while Thread B accepts a new prompt (409-safe: different threads) | ⛔ **BLOCKED — BLOCK-190-UAT-01.** ⚠ The 409 anchor is a **measured** property of the shipped code (`workflow_kickoff.py:146-173`), not an assumption, so the row's design is settled even though the row is owed |
| **Long-message** | ≥ 50 prior messages **or** a ≥ 5 KB prompt on a thread that then kicks off a connector workflow | ⛔ **BLOCKED — BLOCK-190-UAT-01**, and manual per provider even once unblocked |

**None of the three is omitted. All three are represented, each with its reason and its blocking
id.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| **Row A — the send** | CONN-02 | No automation can prove a message *arrived* | Publish a workflow with a bound `external_action` step → run → approve the armed checkpoint → confirm the email/ticket/message actually arrives | ⛔ **awaiting operator-provided destination (D-30)** + BLOCK-190-UAT-01 |
| **Row B — the honest terminal** | CONN-02 / D-17 | Lived-experience read of the card word | The **same definition** with the connection **unbound** → run → the step reads *"Not sent — recorded"*, status `recorded_not_sent`, never *"Complete"* | ⛔ **BLOCK-190-UAT-01** — ⚠ **this file's own earlier claim that Row B is "runnable today, no operator dependency" is CORRECTED on measurement**, see below |
| **Kill-switch both ways (G-4)** | CONN-03 / D-26 | Lived-experience toggle | Flip `live_connectors` **off** → the step records and reads *"Not sent — recorded"*. Flip **on** → it sends | ⛔ **operator action** (`PUT /admin/visibility`; no Control Room card — `D-190-DEF-09`) + BLOCK-190-UAT-01. **Automated cover exists in BOTH directions** — see below |
| **Settings → Connections at scale (sketch 155-C)** | CONN-02 | Visual/instrument-table read | With ≥ 6 connections across all three capabilities, the table stays legible and the 🔒 endpoint footer is always visible | ⛔ **0 connections exist** (measured) and the create surface is gated off |
| **Add-a-connection push/split panel (sketch 156-A)** | CONN-02 | Visual/interaction read | The two refusals sketch 156 promises are actually shown by the backend | ⛔ same gate. **Both refusals ARE built and driven** (190-18 plants A, B, C-v2) — what is owed is the lived read |
| **Rendered geometry at 375px** | CONN-02 | jsdom computes no layout | Drive the panel at a real 375px viewport; confirm the OFF notice, the org-shared line **and the refusal blocks** are reachable | ⬜ **owed, named by 190-17 and made more pressing by 190-18** (the refusal blocks are now the tallest content this surface has) |
| **Long-message axis** | SC#10 | No automation for ≥ 50-message threads | per-provider, manual | ⛔ BLOCK-190-UAT-01 |

### ⚠ CORRECTION — Row B's dependency was under-stated by this file, and it is measured

This document previously read: *"Row B has **no operator dependency** and should be driven first."*
**The credential half of that is true and the environment half is false.** Row B needs no
mailbox, Jira project or Slack channel — but it does need a **published workflow containing an
`external_action` step**, and zero definitions in the database contain one (measured above). It
is therefore ⛔ on BLOCK-190-UAT-01, not runnable today.

**What stands in for it, and what does not.** The *mechanism* Row B tests is **automated and
proved**: 190-13 drove D-17 on **three axes** (status · first body line · sentinel key) across
**two real engine runs**, with three plants each observed RED —

| Outcome | key returned | engine writes | first line |
|---|---|---|---|
| adapter's own `ok` | neither sentinel | `completed` | `Sent. …` |
| send FAILED | `failure` | `failed` | `SEND FAILED — nothing arrived.` |
| golden run / switch off / unbound / disabled | `recorded_intent` | `recorded_not_sent` | `NOT SENT — recorded only.` |

— and 190-15 added the disabled branch to the same terminal, plant-driven. **What remains
unproved is the lived-experience read**: that a person looking at the card sees *"Not sent —
recorded"* and not *"Complete"*. A DOM/DB assertion is not a person reading a card, and this file
will not pretend otherwise.

### The kill-switch — automated in BOTH directions, lived-experience OWED

| Direction | Automated evidence | Driven by |
|---|---|---|
| **OFF** | `test_with_live_connectors_OFF_the_same_step_records_instead_of_refusing` asserts the shipped record body; `test_190_connectors_api.py` case 9 asserts the WRITE is refused 403 | 190-13, 190-09 (plant-driven) |
| **ON** | the ordering module turns the switch on as a **stated precondition**, and all three D-06 drives depend on it — an inert switch makes them all fail | 190-13 |

Both directions are exercised mechanically. **The lived toggle — a person flipping it and
watching the card change — is owed**, and it needs the operator both to author the artefact and
to flip the platform switch.

### D-30 — the blocking operator dependency, and it is LARGER than first stated

The three live-send rows require a **throwaway mailbox, a Jira project and a Slack channel**.
Until the operator supplies them each row is:

> ⛔ **awaiting operator-provided destination (D-30)** — the adapter is unit-proven against a
> stub; what is unproven is that a real message arrives.

**Recommended FIRST row: `post_message` (Slack).** It needs only a bot token and a channel id,
its host is a **code constant** (the smallest SSRF surface of the three), it is the one row that
falsifies **T13** — the likeliest shipped defect — and it is additionally the trigger for
**assumption A3** (`auth.test`'s reply shape), so one row retires two open items.

### ⭐ THE `send_email` DEPENDENCY IS STRICTLY LARGER THAN "A THROWAWAY MAILBOX" — and the phase's own guard is why

A local SMTP catch-all (`supabase_inbucket`, part of the local Supabase stack) was investigated as
a way to unblock the `send_email` row without any operator provisioning. **The claim was verified
before being written down, and it is REFUTED — twice, independently.**

**1. There is no reachable SMTP listener.** Inbucket's **web UI answers** (`http://127.0.0.1:54324/`
→ HTTP 200), but its SMTP port does not:

```
port 54325 -> ConnectionRefusedError      port 2500 -> ConnectionRefusedError
port 1025  -> ConnectionRefusedError      port 54327 -> TCP opens, no banner, EHLO times out
$ netstat -ano | grep LISTENING | grep ':543..'   → 54321 54322 54323 54324 54327 only
```

**2. And the stronger reason: `egress.py` REFUSES it, by design.** Driven against the shipped
guard rather than argued:

```
$ python -c "from app.security.egress import validate_destination, EgressRefused; ..."
smtp://127.0.0.1               -> REFUSED reason_code=scheme_not_tls
smtps://127.0.0.1              -> REFUSED reason_code=address_not_public
smtp+starttls://127.0.0.1      -> REFUSED reason_code=address_not_public
smtps://localhost              -> REFUSED reason_code=host_not_allowed
```

with the audit lines reading exactly D-08's shape —
`egress refused: capability=send_email host=127.0.0.1 reason=address_not_public address=127.0.0.1`.

**Inbucket is a plaintext, loopback-only catch-all, which is precisely the address CONN-03 SC#2
exists to refuse.** Using it would require disabling the two guards this phase's headline
security property rests on. So the `send_email` row's dependency is not "a mailbox" — it is **a
publicly-routable SMTP host with TLS**. That is a strictly stronger operator dependency than D-30
originally recorded, and it is recorded here rather than discovered at UAT.

*(This is a genuinely good outcome dressed as a bad one: the guard refused the one destination
that would have made the row cheap, which is the guard working.)*

---

## The Demo Sentence — Both Halves Are UAT Rows

> *"a published workflow paused for approval, the operator approved, and an email actually
> arrived — and the same workflow, with the connection unbound, still says 'Not sent —
> recorded' rather than pretending."*

| Half | Status at close |
|---|---|
| **A — the send** | ⛔ owed (D-30 + BLOCK-190-UAT-01). The mechanism is built, unit-proven per capability and fenced; what is unproven is that a real message arrives |
| **B — `recorded_not_sent`** | ⛔ owed as a **lived read** (BLOCK-190-UAT-01). The **mechanism is PROVED** on three axes across two real engine runs, with three plants |

**Neither half is claimed as proved. Both are named.** The demo sentence is therefore **half
built and zero demonstrated** at close — a true statement, and the one this phase's discipline
requires over a comfortable one.

---

## G-6 — How We'd Know This Failed (from CONTEXT D-31)

**Each of the eight conditions is reported below, and DRIVEN is distinguished from ARGUED.**

| # | Failure condition | Caught by | Verdict |
|---|---|---|---|
| 1 | A send happens with **no** approval, or during a **publish** | W0-1 / T10 | ✅ **DRIVEN.** `httpx.AsyncClient.send was called - outbound egress attempted` on the publish path (190-13), green on the gate in the same commit. ⭐ **Plus a second door nobody had named**: A4 — a restart-stranded golden run was **resumable and would have SENT once per boot**; driven RED, closed at the root |
| 2 | A phase reads *"Complete"* for a send that did not leave the app | **T13** | ✅ **DRIVEN three times, on three vendors.** Slack: `one message posted (… ts=None)` for `channel_not_found`. Jira: `one issue created (key=UNKNOWN)` for a body with `errorMessages`. SMTP: `ok=True` over a wire carrying `Bcc: attacker@evil.com` |
| 3 | A credential appears in the definition JSONB, an SSE frame, an API response, or a log line | T5 / T6 / T7 | ⚠ **DRIVEN for three of the four surfaces; the SSE frame is ARGUED.** JSONB ✅ (190-12 plant 1) · API response ✅ (190-06/190-09, an **import failure**) · log line ✅ (190-06 case 5, the *ciphertext* assertion) · rendered DOM ✅ (190-16 plant G, 190-18 plant J). **No test asserts over an emitted `phase_*` SSE frame** — see § What is ARGUED |
| 4 | Org B's workflow successfully sends using org A's connection | W0-2 / T8 | ✅ **DRIVEN, and the leak was REPRODUCED before it was closed** — org A held org B's decrypted bot token. Closed on **two** gates, the second driven independently |
| 5 | A request reaches `169.254.169.254`, `127.0.0.1`, or any RFC1918 address | T1 / T4 (29-address corpus) | ✅ **DRIVEN.** Four separate clause deletions, each naming its own address; plus T3's **twenty logged requests** to the metadata endpoint under the redirect plant |
| 6 | The guard passes because a credential was **absent** (the n8n inversion) | W0-3 | ⚠ **CORRECTED 2026-08-09 (code review WR-01) — DRIVEN, and the RED was worse than predicted** (the wrong ordering raised **nothing at all**: a step aimed at `169.254.169.254` returned the ordinary *"Not sent — recorded"* because nothing ever looked) — **but the ✅ over-stated its SCOPE.** The pre-credential guard is structural for `post_message` only; for `create_ticket` and `send_email` the shipped model carries no `base_url`, so GATE 3's destination is `None` and `validate_destination` is not called before the resolve. No reachable bypass (both binders validate first). Full measurement in § *CORRECTION TO W0-3's ✅*; code half deferred as `D-190-DEF-10` |
| 7 | A `PhaseFormPanel.tsx` / `PhaseNodeCard.tsx` diff is non-empty | D-23 / D-24 numstat fences | ✅ **DRIVEN phase-wide at close** — all eight files empty against **both** candidate bases and the worktree, existence confirmed at each rev first |
| 8 | One email arrives twice from one run | D-18 at-most-once; manual Row A | ⚠ **HALF DRIVEN.** *At-most-once* is asserted mechanically in all three adapters — exactly one call reaches the binder on failure, **with the recorder's second queued response a SUCCESS on purpose**, so a retrying adapter would have reported a send rather than failing noisily; `retry`/`backoff`/`sleep` are fenced per line. **The "arrives twice" half needs Row A and is OWED** |

**Five of eight fully driven. Three carry a named, non-driven or narrower-than-claimed half
(3, 6, 8). Nothing is asserted without saying which it is.** ⚠ The count moved from *six of
eight* on 2026-08-09 when row 6's ✅ was corrected by code review WR-01; it is restated rather
than silently adjusted, because a score that only ever improves is not a score.

---

## What is ARGUED rather than driven — carried to `/gsd:secure-phase 190`

| # | Item | What is argued | Why it is not driven | What would close it |
|---|---|---|---|---|
| **ARG-1** | **T7's SSE clause** — *"no `phase_*` SSE frame carries a credential"* | The frames are composed from the phase output; `_external_action_body` is the single composer; the audit-receipt fence sweeps the whole payload at any depth; the response model cannot carry a secret at all | No test asserts over an **emitted SSE frame**. Grepping the 190 suites for an SSE assertion returns only substring matches inside the word *"assert"* | One case that captures a real `phase_recorded_not_sent` / `phase_transition` frame from an engine run and sweeps it for the sentinel, with a positive control |
| **ARG-2** | **A4's generalisation** | *"any FUTURE per-run suppression flag will have the same blind spot"* in the resume path | The specific defect **was** driven and closed at the root, with a fence asserting the flag stays un-threaded. The generalisation is a design claim | Nothing today; it is a note for the next phase that adds a per-run flag |
| **ARG-3** | **D-18's *"halts the run"*** | CONTEXT D-18 says a failed send *"halts the run"* | **Measured FALSE against the shipped engine** (190-13): a `failure` flips the PHASE to `failed`, then the engine **continues to the next phase** and terminalizes the run — its own explicit, commented decision. At-most-once **is** shipped and grep-checked | A wording reconciliation in CONTEXT/ROADMAP, **not** unshipped work. Changing the semantic would need a `harness_engine.py` edit that 190-13's acceptance forbids |

---

## Residuals and assumptions — the collected input for `/gsd:secure-phase 190`

| Id | Kind | Statement | Trigger |
|---|---|---|---|
| **RESIDUAL-190-01** | accepted residual, fenced | **Both DNS-pin recipes depend on non-public attributes** — `smtplib.SMTP._host` (private; `connect()`'s non-assignment is an implementation detail) and `request.extensions["sni_hostname"]` (an httpx/httpcore internal convention). A minor upgrade could silently un-pin the connection **while every functional test still passes** — an un-pinned connection simply re-resolves and still works. Fenced by `test_190_residual_fence.py`, both halves driven RED against a simulated upgrade. Environment when written: httpx **0.28.1**, httpcore **1.0.9**, CPython **3.12.6** | ⚠ **The stated trigger CANNOT FIRE and that is measured:** `requirements.txt:38` is `httpx>=0.28.0` with **no upper bound**, so httpx can move on any fresh install or container rebuild with nobody editing the file. What actually protects the pin is that the fence runs on **every** test run, against the **installed** library |
| **A1** | accepted assumption, fenced by a safe fall-back | **Jira's error-envelope shape is not driven against a live account.** `{"errorMessages": [...], "errors": {...}}` — Atlassian states the status-code half; the body shape is MEDIUM confidence. **The verdict does not break if it is wrong** (gate 1 status and gate 3 issue-key are independent of the envelope); what degrades is the WORDING, which falls back to the reply's own decoded text — still verbatim, still the host's words | The first live `create_ticket` row (D-30). Capture the real failure body, compare against `JIRA_ERROR_ENVELOPE`, correct `_provider_words` / `_carries_error` if it differs |
| **A2** | accepted residual, named | **An unreadable reply AFTER a create leaves the outcome genuinely unknown.** `EgressResponseTooLarge` / `EgressResponseUndecodable` can only occur after the POST has left, so the issue may or may not exist and the reply that would say which is unreadable. **Not painted with a §4d heading** (the host answered ⇒ not *unreachable*; it was not our refusal ⇒ not *refused*), and **not resolvable by a retry** — D-18 forbids one and Jira's create takes no idempotency key at this scope | A live `create_ticket` row ending in either terminal, **or** the first report of a duplicate ticket from one run. Either is the moment to reconsider D-18's deferral |
| **A3** | accepted assumption, fails CLOSED | **Slack's `auth.test` is not driven against a live workspace.** §R11 documents `chat.postMessage` only; the identity endpoint's no-body call shape and reply field names are not in the research. **A wrong guess produces a check that refuses to go green, never one that goes green wrongly** — usability degrades, honesty does not. `send` is unaffected | The first live `post_message` row (D-30) — **already the recommended FIRST row**, so this closes for free with T13 |
| **THREAT-190-15-REQTIME** | **new surface, in NO plan's register** | The credential check is the **first synchronous outbound network call made from a user HTTP request in this codebase** — every prior egress path is inside the harness engine. Two consequences: (a) a **request-time SSRF surface** (mitigated by the pinned binders and the allow-list, but the *caller* is a browser rather than a run), and (b) an **outbound-latency amplifier** — the SMTP path can hold a request for up to `SMTP_TIMEOUT_SECONDS`, so an admin clicking Check repeatedly can occupy workers. **There is no rate limit** (D-32 fences one); the audience is bounded to org admins by `require_org_manage` | `/gsd:secure-phase 190` must disposition it — it is not in any plan's `<threat_model>` |
| **THREAT-190-13-RESUME** | new surface | The resume sweep re-drives runs on boot with a ctx built by a **second** builder that does not carry `is_golden_run`. Closed for golden runs at the root; **any future per-run suppression flag has the same blind spot**, and the correct pattern is to make the path unreachable rather than to thread the flag | Any future per-run suppression flag |
| **THREAT-190-11-BEARER** | flagged, scoped | `slack_adapter.py` **constructs a credential header**, which its sibling deliberately does not. Unavoidable (the vendor's auth *is* a bearer token). **190-14's credential fence must stay SCOPED** — `Authorization` appears exactly twice under the package, both in that file, so a tree-wide ban would be RED on correct code. The property fenced instead is *the token appears in no body, no log and no refusal*, driven across all four failure shapes | Do not "complete" the fence by removing the exemption |
| **D-190-DEF-08** | latent defect, tripwired not fixed | **An import cycle on the connector registry.** `import app.services.connectors.registry` in a cold interpreter raises `ImportError: cannot import name 'get_adapter' from partially initialized module`. Unreachable today for exactly one measured reason: `phase_types.py:94` is its **only** module-scope importer. Guarded by a sole-importer tripwire, strengthened at 190-15 to **classify** module-scope vs function-local rather than count | The first plan needing to import the registry from anywhere else — the Open Platform client (SEED-013), a worker entry point, a management script, or `api/connectors.py` growing a capability list |
| **(inherited)** | measured, not introduced | A **second** latent cycle: `import app.models.connector` first in a cold interpreter raises `ImportError` (`models.connector → harness.grounding → harness/__init__ → phase_types → connector_service → models.connector`). **Verified present at HEAD before 190-15's first commit.** `app.main` boots fine | Same class as D-190-DEF-08 |

---

## Close: the four gates, the fence sweep and the scope fence

### A. The eight empty diffs (D-23 / D-24) — phase-wide, VERBATIM

Existence was sanity-checked **first at every rev**, because an empty `--numstat` and a path typo
are indistinguishable (190-05's recorded lesson). All eight resolved OK on disk, at `de122b9a`
and at `83a93c9a`.

```
>>>BEGIN git diff --numstat de122b9a HEAD -- <the eight>
<<<END
>>>BEGIN git diff --numstat 83a93c9a HEAD -- <the eight>
<<<END
>>>BEGIN git diff --numstat HEAD -- <the eight>   (worktree)
<<<END
```

**All three print NOTHING.** The eight: `PhaseFormPanel.tsx` (D-23, whose one gated line 189-14
already spent) · `PhaseNode.tsx` · `PhaseNodeCard.tsx` · `phaseNodeCardContract.ts` ·
`ownProperty.ts` · `NodeCornerMarks.tsx` · `NodeRunOverlay.tsx` · `NodeIconWell.tsx`.

**This is the PHASE-WIDE fence** — the per-plan checks were checkpoints; this comparison against
the phase's own base is the only one that catches a file opened in one plan and closed in another.

### B. No plants survive

`grep -rc PLANT backend/app` → zero occurrences in every file. `frontend/src` non-test files →
zero. `grep -rn "PLANT-"` over both trees → nothing. Test-file mentions proved **prose-only** by
tokenizer (above).

### C. The four gates

| Gate | Command | Base `83a93c9a` | HEAD `a115e5a4` | Verdict |
|---|---|---|---|---|
| Backend suite | `pytest tests/ -q` | 211 failed · 3372 passed · 1 error | **211 failed · 3575 passed · 1 error** | ✅ failures unchanged, **+203 passes**; set-diff shows **0** disappeared and **2** new, both the untouched flaky `test_114_explain_index.py` |
| Frontend suite | `npm test` | — | **21 failed · 4686 passed (4707)**, 8 of 249 files | ✅ **not a regression signal** (D-190-DEF-05/-06). Attribution **re-measured**: running only the named rot set reproduces **21 failed** — i.e. *every* whole-suite failure lives in it |
| Count gate | `node scripts/vitest-count-gate.cjs` | 2727 / 2714 / 0 failed / 48 files, exit 0 | **2851 / 2838 / 0 failed / 51 files**, exit 0, `count gate OK` | ✅ drift `+13` → `+13`; this plan added **0** drift |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json \| grep -c "error TS"` | **33** | **33** | ✅ at baseline. The bare form still checks **0** files |

### D. Zero installs — the Package Legitimacy Audit stays NOT APPLICABLE

```
$ git diff --numstat 83a93c9a HEAD -- backend/requirements.txt frontend/package.json frontend/package-lock.json
(prints nothing)
$ git diff --numstat de122b9a HEAD -- <the same three>
(prints nothing)
```

**Zero packages installed across the whole phase.** Research recorded the Package Legitimacy
Audit as NOT APPLICABLE for exactly this reason, and it remains so. Three vendor SDKs were
deliberately **refused** (`slack_sdk`, a Jira SDK, any HTTP wrapper) because each would construct
its own client and break D-05 outright.

### E. G-7 — run at close, verdict recorded VERBATIM

```
$ node scripts/check-gap-closure-rounds.cjs 190

G-7 gap-closure round cap — 190-live-connector-slice-connector-security-stretch
  plans: 19 total · 0 gap-closure

G-7 clear — no gap-closure plans in this phase.

exit=0
```

**Zero gap-closure rounds. G-7 clear.** Recorded now so a later `--gaps` routing starts from a
measured number rather than a remembered one. Note the script's derivation: it counts
`gap_closure: true` frontmatter and, failing that, distinct commits that ADDED gap-closure plan
files — both are zero here.

### F. Reported bugs — no report was folded

```
$ grep -rl "folded_into: 190" .planning/reported-bugs/ | wc -l
0
```

**Zero.** Matches CONTEXT `<deferred>`: BUG-260808-02 is **DEFERRED, not folded** (it pairs with
SEED-139 + SEED-140 as one workflow-surface phase); BUG-260807-01 was swept by a `/gsd:fast`
before the phase executed (`f02b5f41`); every other open report is out of this phase's domain.

### G. Cloud parity — re-derived, not quoted

```
$ bash scripts/pending-cloud-migrations.sh
104 … 117  (fourteen files)
```

The queue is **`104 → 117` + `SECRETS_ENCRYPTION_KEY`**, confirming 190-04's correction that both
prose ranges (`099–113` and `099 → 115`) were wrong at **both** ends. **Migrations 116 and 117
join it.** Nothing else is owed: the phase reads **no new env var**, seeds no reference data, adds
no bundled service and changes no sandbox tag — `bash scripts/check-deploy-drift.sh` → `PASS`.

⚠ **One non-code half is owed and is NOT a migration:** `live_connectors` is `"off"` by cold
default in **every** environment. Turning it on is an operator action (`PUT /admin/visibility`),
and **there is still no Control Room card for it** (`D-190-DEF-09`). Until then, every surface
this phase shipped is correctly absent in every environment.

### H. D-32 — the scope fence, RESTATED AT CLOSE (the written line a gap round must argue against)

**NOT built in 190, by construction and not by omission:** broad connector catalog · inbound
webhooks · public REST API · **MCP client** · service accounts · OAuth authorization-code flow ·
a 4th capability · retries / idempotency keys / a send queue · scheduling or automations ·
contact/recipient directory resolution · any expression language or arbitrary-code node on the
canvas · the run-surface approval affordance (BUG-260808-02 — **DEFERRED, not folded**, with its
trigger: the next workflow-surface phase or v3.7 kickoff, whichever comes first).

**A round that adds one of these is a PHASE, not a gap.** Verified mechanically at close:
`test_190_ssti_fence.py::test_the_D32_scope_fence_holds_on_the_canvas_and_on_the_send_path` is
green (3 capabilities, 7 phase types, 1 new config field, no expression-shaped field name, no
re-attempt machinery), and the 189 acronym fence — whose green is part of **D-01's own evidence**
that no client for that protocol was built — is green at `2 passed`.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a named Wave 0 dependency — **51 / 51**
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — **stated explicitly, zero exceptions**
- [x] Wave 0 covers all MISSING references — **all 9 files created and green**
- [x] **All three W0 tests observed RED before their fix landed** — and W0-1's fence was found **VACUOUS** and repaired first, which is why its RED exists at all
- [x] **All 14 falsification rows observed RED against a real plant**; plants restored; `grep -c PLANT` → **0 in production source** (test-file mentions proved prose-only by tokenizer)
- [x] All 7 source fences green, each with its positive control driven
- [x] SC#10 roster **derived** from `MODEL_CAPABILITIES` (not re-typed) — **8 / 8 rows present**
- [ ] **Every row PASS or ⛔-with-reason** — ⛔ **8 / 8 blocked** on `BLOCK-190-UAT-01`, each with a named reason and a blocking id. **No row omitted.**
- [x] Owed manual rows recorded as a **DECISION** in ROADMAP + STATE.md, naming the first row to run (`post_message` / Slack)
- [x] No watch-mode flags
- [x] Feedback latency measured: < 8 s (quick) / 486 s (full backend)
- [x] `nyquist_compliant: true` — **set on the evidence above**, not by default: every task maps to an automated command that was run, and the sampling-continuity rule holds with zero exceptions

**Approval:** ✅ **CLOSED WITH OWED ROWS — 2026-08-09, plan `190-19`.**

**The decision, stated plainly:** every automatable property of this phase is proved; the twelve
live/lived rows are ⛔ with named reasons and named blockers. **This is a decision to close, not
a claim that everything ran.** The first row to run when the operator returns is **Slack
`post_message`** — it falsifies T13, retires assumption A3, and needs only a bot token and a
channel id.
