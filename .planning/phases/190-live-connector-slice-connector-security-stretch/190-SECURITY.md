---
phase: 190
slug: live-connector-slice-connector-security-stretch
status: verified
threats_open: 0
asvs_level: 1
block_on: high
created: 2026-08-09
base_commit: de122b9a
register_authored_at_plan_time: true
---

# Phase 190 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> **Register provenance:** authored at plan time. All 19 plans (`190-01` … `190-19`) carry a
> parseable `<threat_model>` block; the consolidated register is **114 threats** plus the
> recurring `T-190-SC` = **115**. **No new threats were scanned for or added** — this audit
> verifies the declared register only. Two surfaces that arrived without a threat row, and one
> threat CLAUSE no plan's mitigation covers, are recorded under *Unregistered flags*.
>
> ⚠ **Every CLOSED verdict below cites a file:line this auditor read, or a command this auditor
> ran with its output.** A SUMMARY claim was treated as a claim. Every summary in this phase
> predates the standard-depth code review (`f64a0ebb`, `50d058e3`) and the verification pass, so
> **every threat was verified against HEAD**, never against the summary that declared it.
>
> ⚠ **This phase is the app's FIRST outbound-to-arbitrary-destination capability.** The
> adversarial default applied throughout was: *the mitigation is absent until a file:line and a
> reachable, falsifiable test prove otherwise.* Three fences in this phase were measured
> **vacuous by the phase itself** (189's armed golden-run fence, D-05's six literal substrings,
> and 190-14's named-site SSTI assertion satisfied by a docstring eighteen lines away). Those
> measurements are the reason a green suite was not accepted as evidence anywhere below.

---

## Verification method

| Disposition | Count | How it was verified |
|---|---|---|
| `mitigate` | 108 | Located in the cited file **at HEAD**, read, and the declared guard **executed**. A guard that exists but cannot fail was treated as not-closed. Where a plan claimed a grep count, an empty diff or a DB fact, it was **re-derived**. |
| `accept` / `accept-with-control` / `-fence` / `-trigger` / `-decision` | 7 | Entry present in the Accepted Risks Log below, **plus** the residual check where one was cheap (the fence executed; the live DB queried; the trigger's firability re-examined). |

**Six threats declared `mitigate` were DOWNGRADED by this audit to accepted-risk** — not because
the code is wrong, but because the mitigation as *declared* is present at reduced scope or is
argued rather than driven. Each is named with an owner and a concrete re-open trigger
(`AR-190-08`, `AR-190-11`). A downgrade is recorded so it cannot later read as a clean close.

### Commands run for this audit (foreground, read-only — no `db push`, no `db reset`, backend not started)

```
backend $ pytest tests/unit/test_190_egress.py tests/unit/test_190_egress_ordering.py \
      tests/unit/test_190_credentials.py tests/unit/test_190_cross_org_credential.py -q -p no:randomly
  → 93 passed

backend $ pytest tests/unit/test_190_smtp_header_injection.py tests/unit/test_190_slack_ok_false.py \
      tests/unit/test_190_ssti_fence.py tests/unit/test_190_connector_source_fence.py \
      tests/unit/test_190_residual_fence.py tests/unit/test_190_jira_adapter.py \
      tests/unit/test_190_connectors_api.py tests/unit/test_190_connector_check.py \
      tests/unit/test_190_review_fix_data_layer.py tests/unit/test_190_review_fix_executor.py -q -p no:randomly
  → 140 passed

backend $ pytest tests/unit/test_189_no_egress.py tests/integration/test_190_secret_column_privilege.py -q
  → 31 passed
backend $ pytest tests/integration/test_190_secret_column_privilege.py -v
  → 8 passed — LIVE :54322, **not skipped** (each of the eight node ids listed PASSED)
backend $ pytest tests/test_harness_engine.py -q -p no:randomly
  → 50 passed

frontend $ npx vitest run ConnectionPicker.test.tsx ConnectionsTab.test.tsx \
                          ConnectionFormPanel.test.tsx phaseVocabulary.test.ts
  → 236 passed / 4 files
frontend $ npx tsc --noEmit -p tsconfig.app.json          → 33   (the recorded baseline, unmoved)
repo     $ node scripts/vitest-count-gate.cjs             → count gate OK — 51/51 pinned,
                                                            0 failing, 2851 running / 2838 pinned
```

**Live database (`127.0.0.1:54322`, `psycopg2`, read-only), re-derived by this audit:**

```
column_privileges  connector_connections.secret_ciphertext
   authenticated : INSERT, UPDATE              <- NO SELECT
   service_role  : SELECT, INSERT, UPDATE, REFERENCES
   postgres      : SELECT, INSERT, UPDATE, REFERENCES
   anon          : (absent entirely)
table_privileges   connector_connections
   anon          : (absent entirely — the role holds NOTHING on this table)
pg_class           relrowsecurity = t
pg_policies        4 policies, all TO {authenticated}:
   _select  USING  org_id IN (SELECT current_user_org_ids())          -- no is_system escape
   _insert  CHECK  current_user_has_permission(org_id,'org:manage') AND org_id IN (…)
   _update  USING/CHECK  current_user_has_permission(org_id,'org:manage') …
   _delete  USING  current_user_has_permission(org_id,'org:manage')
harness_audit_event_type_check     -> 'external_action_sent' PRESENT, 24 literals (was 23)
connector_connections              -> 0 rows
app_settings.feature_visibility    -> {skill_studio, model_management, governance_health,
                                       workflow_authoring, visual_workflow_canvas}
                                      `live_connectors` ABSENT  ⇒ cold default "off"
```

**Repository facts re-derived by this audit (not quoted from any summary):**

```
git diff --numstat de122b9a..HEAD -- <the eight D-23/D-24 fenced files>   → EMPTY
git diff --numstat de122b9a..HEAD -- backend/requirements.txt
                                      frontend/package.json package-lock.json → EMPTY
grep -rn "PLANT" backend/app frontend/src (non-test)                     → 0
grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql                       → 4
grep -rn "rate_limit\|slowapi\|Limiter" backend/app/api/connectors.py    → 0  (see AR-190-10)
```

---

## The headline property (CONN-03 SC#2) — verified against HEAD, three ways

**SC#2: every connector outbound passes an unconditional SSRF / egress guard, regardless of
credential state.**

### (a) There are exactly TWO sockets in the product, and both validate FIRST

`backend/app/security/egress.py` is the sole socket owner. `send_pinned_http` (`:523`) and
`open_pinned_smtp` (`:706`) each call `validate_destination` as their **first executable
statement** (`:565`, `:747`) — read end to end by this auditor. `validate_destination`'s
parameters are `(capability, url_or_host, port, allowed_host, resolver)`: **no credential in any
form**, so there is no expression anywhere upstream on which a credential-presence branch could
be written. That is the n8n `#28218` inversion made structurally impossible rather than merely
avoided.

The order inside the validator is the property, and it is written in that order (`:349` → `:424`):
capability (closed set, no permissive default) → scheme (`https` / `smtps` / `smtp+starttls`
only; **`http://` refused with no localhost carve-out**, `:372`) → host from `httpx.URL(...).host`
never the raw string (`:386`) → ASCII (`:393`) → label-boundary allow-list (`:277`) → **every**
resolved address (`:406`, a loop — one private answer refuses the whole destination) → the pin
(`:424`).

### (b) No adapter can open a socket another way — and the fence is NON-VACUOUS

`tests/unit/test_190_connector_source_fence.py::test_no_connector_module_names_a_transport`
walks `backend/app/services/connectors/**` for transport construction **as a property, not as a
substring**, and carries two independent controls: `test_the_banned_token_matcher_actually_matches`
(`:156`) proves all six contract tokens fire on real transport source and do **not** fire on
lookalikes, and `test_the_walk_is_not_vacuous` (`:240`) proves the walk reached its roots. It was
driven RED against a real planted `httpx.AsyncClient()` **carrying no `import httpx`** — which is
precisely the plant the original six literal substrings would have missed.

⚠ **The literal-substring form was measured wrong in BOTH directions and replaced** (190-14):
`import requests` contains none of the six; a docstring ending *"…the number of requests."*
contains one. This is the Phase-185 lesson applied — *verify the property, not the patch*.

Independently re-derived by this audit:
`grep -rn "import httpx|import smtplib|AsyncClient|SMTP(" backend/app/services/connectors/` → **0**.

### (c) The executor's own pre-credential gate — CLOSED for `post_message`, a NO-OP for two

**This is the one place the declared mitigation is narrower than its sentence, and it is stated
here rather than smoothed.** `_pre_credential_destination` (`phase_types.py:1948`) returns the
step's `base_url` if one exists, else the per-capability constant (`:1921`). Slack's is
`SLACK_API_BASE`; `create_ticket` and `send_email` are `None`, because 190-06 settled that
non-secret destination config lives on the **connection row**, and `ExternalActionPhaseConfig`
is a `_StrictBase` (`extra='forbid'`) carrying no `base_url` (`models/harness.py:172,277`).

So GATE 3 (`phase_types.py:2237-2239`) fires for one capability of three on the shipped shape.

**What this costs, measured rather than argued:**

| Capability | GATE 3 (executor, pre-credential) | Binder validates before the socket | Plaintext materialized before validation |
|---|---|---|---|
| `post_message` | ✅ fires — destination is a code constant | ✅ | no (GATE 3 precedes GATE 5's resolve) |
| `send_email` | ✗ no-op | ✅ `open_pinned_smtp` (`smtp_adapter.py:368`) runs **before** `credential.secret` (`:388`) | no — the lazy `.secret` property is preserved |
| `create_ticket` | ✗ no-op | ✅ `send_pinned_http` validates first | **yes, by one frame** — `auth=(…, credential.secret)` is evaluated as a call ARGUMENT at `jira_adapter.py:479` |

The Jira adapter **states this difference in its own docblock** (`jira_adapter.py:99-107`) rather
than leaving it to be discovered. The security property is unaffected — the credential is never
transmitted to a destination that was not validated — but the *lazy-decrypt bonus* the mail path
gets for free is not available on the HTTP path.

**Verdict:** the SC#2 property is **CLOSED**. The executor-level D-06 defence-in-depth ordering
is **accepted risk `AR-190-08`** (owner: `D-190-DEF-10`), because the drive that proves it uses a
`SimpleNamespace` config the shipped model forbids — a limit `test_190_egress_ordering.py`
records in its own docstring at `:46-52` and pays down where it honestly can, with a
**real-model** `post_message` case at `:455-500` that asserts `getattr(config,"base_url",None) is
None` so a model change moving it back would be noticed.

⚠ **One shipped sentence is now false and is recorded, not repaired here.** The executor docblock
at `phase_types.py:2113-2115` states the ordering as an absolute — *"a send with no credential
bound at all raises the EGRESS REFUSAL"* — which holds for `post_message` only. The fixer's
argued reason for leaving it (correcting the prose beside a fence that cannot see the production
path would document the gap rather than close it) is defensible, and `D-190-DEF-10` requires both
halves in one commit. **This audit does not accept that as closure of the sentence**; it is folded
into `AR-190-08`.

---

## The D-28 minimum list — all fourteen, verified at HEAD

Each row: the mitigation's **file:line**, the **test**, whether the test was **observed RED**, and
this audit's verdict. Every RED transcript below is recorded verbatim in `190-VALIDATION.md`
§ *The Security Falsification Set*; every test below was **re-run green by this audit**.

| # | Threat | Mitigation (file:line, read at HEAD) | Test | RED observed | Verdict |
|---|---|---|---|---|---|
| **1** | SSRF via an org-configured host | `egress.py:277` `_host_is_allowed` — label boundary `h == suffix or h.endswith("." + suffix)`; `send_email` uses `_CALLER` mode requiring **exact equality** with the org-configured host and **fails closed when none is configured** (`:286-288`) | `test_host_matching_is_a_label_boundary_never_a_substring` | ✅ PLANT 6 → `evilatlassian.net` / `notslack.com` accepted | **closed** |
| **2** | DNS rebinding / TOCTOU | `egress.py:573` `httpx.URL(url).copy_with(host=pinned.ip)`; SMTP `:697-699` sets `client._host` then `connect(pinned.ip, …)`. **No hostname fallback exists** — an unavailable pin is a refusal (`:17-19`) | `test_T2_the_socket_goes_to_the_CALL_ONE_ip_not_a_reresolved_one` (resolver answers public, then `127.0.0.1`) | ✅ `assert 'slack.com' == '142.250.185.78'` — the request went out **by name** | **closed** |
| **3** | Redirect-based bypass | `egress.py:594` client-level **and** `:615` per-send `follow_redirects=False`, set explicitly *"a default is not a guarantee"*; `:618-631` a 3xx **raises** `redirected` rather than returning to the adapter | `test_T3_a_302_to_the_metadata_endpoint_is_NOT_followed` | ✅ `httpx.TooManyRedirects` + **twenty** logged `GET http://169.254.169.254/latest/meta-data/`. ⭐ *the pin held on request 1 and the redirect walked around it* | **closed** |
| **4** | Cloud metadata endpoint | `egress.py:112-146` `_unwrap` peels **four** IPv6→IPv4 embeddings CPython does not (`ipv4_mapped`, `sixtofour`, `teredo`, and SIIT `::ffff:0:0:0/96` + NAT64 `64:ff9b::/96` which have **no CPython accessor**); `:157` `fec0::/10` checked **before** the unwrap because `is_global` answers True for it; `:164` multicast | 29-address corpus; `test_T1_…refused_by_the_resolve_step`, `test_each_of_the_four_unwrap_clauses_is_load_bearing`, `test_the_audited_address_is_the_UNWRAPPED_one` | ✅ **four separate REDs**, one per clause. ⭐ PLANT 2 (`::ffff:0:7f00:1`, SIIT) is *the hole that would have shipped* | **closed** |
| **5** | Credential leak in logs | `egress.py:310-327` `_refuse` emits capability/host/reason only; `EgressRefused.__init__` (`:190-197`) is **keyword-only with no `**kwargs`**, so `raise EgressRefused(cap, response.text)` does not compile. `connector_service.py:244` `ResolvedConnection.__repr__` redacts; `@dataclass(repr=False)` at `:194` | `test_a_refusal_never_carries_a_credential` (with a positive control proving the log capture works) · `test_EgressRefused_cannot_be_constructed_with_a_body` · `test_190_credentials.py` case 5 | ✅ `T5: the stored CIPHERTEXT reached a log line` — ⭐ the **ciphertext** assertion fired, not the plaintext one | **closed** |
| **6** | Credential leak in the definition JSONB | `models/harness.py:277` — `connection_id: str | None` is the **only** field added; `_StrictBase` `extra='forbid'` at `:172`. Client half: `ConnectionPicker.tsx:244` writes exactly `{ connection_id: id }` | `ConnectionPicker.test.tsx:332-339` — `expect(Object.keys(patch)).toEqual(["connection_id"])` + a `/secret|token|password|host|base_url/i` sweep | ✅ plant `smtp_password` → `expected [ 'connection_id', 'smtp_password' ] to deeply equal [ 'connection_id' ]` | **closed** |
| **7** | Credential leak in an SSE / API response | `connector_service.py:99` `_RESPONSE_KEYS` derived from the model; `:109` a **module-scope assert** that `secret_ciphertext`/`secret` are absent; `models/connector.py:231` response model has no secret field and `extra='forbid'` | module-scope assert · `test_190_connectors_api.py::test_no_response_shape_can_carry_the_credential` · `ConnectionsTab` DOM sweep | ✅ **exit 4, a COLLECTION ERROR** — the plant could not even be imported | **closed** for the API/DOM half. ⚠ **the SSE clause is ARGUED** → `AR-190-11` |
| **8** | ⭐ **Cross-org credential resolution (D-14)** | `connector_service.py:361-363` — `org_id` is **positional-required with no default**; `_fetch_connection_row:289` is `.eq("id").eq("org_id")` (`:305-306`); **and** a second gate at `:397` re-checks the returned row's own `org_id`, which is the term that survives a future fetch seam dropping the predicate. A miss is `ConnectorNotFound`, never a forbidden status (`:147-154`) | `test_190_cross_org_credential.py` (3 cases) · `test_the_resolver_signature_takes_an_org_id` via `inspect.signature` · the belt-plant case | ✅ `RESOLVED SECRET FOR ORG A : xoxb-ORG-B-REAL-BOT-TOKEN-NEVER-CROSS-A-TENANT` / `LEAKED : True`. ⭐ the **recorded-fetch-call** assertion fired, not `pytest.raises` | **closed** |
| **9** | SSTI via any composed field | **No evaluator was added.** `phase_types.py:1985-2005` `_adapter_args` is a closed projection over `adapter.INPUT_SCHEMA` + a three-key `_BODY_ARG_FOR_CAPABILITY` (`:1930`) with a module-scope `assert` against the closed set (`:1936`). The only two Jinja environments in the backend remain `SandboxedEnvironment(autoescape=True)` | `test_190_ssti_fence.py` — source fence + `test_the_shipped_sandboxed_path_is_still_the_only_jinja_path` + a **behavioural** drive that `{{7*7}}` reaches the adapter as five literal characters | ✅ PLANTS C·D·E·F. ⭐ **PLANT F caught the fence being INERT** — the named-site assertion had been satisfied by a **docstring eighteen lines above** the construction | **closed** |
| **10** | ⭐ **Publish-time egress (D-16)** | `phase_types.py:2194` — `if getattr(ctx,"is_golden_run",False): return _record(...)`, GATE 1, above every other send gate. **The resume door too:** `db/workflows.py:868` `AND wr.is_golden_run = false` in the SQL **and** `:879` a post-fetch re-check — both gates, the D-14 shape | `test_harness_engine.py:1142` (a REAL golden run, five-surface sentinel imported not re-typed) · `:1592 test_a_resumed_run_can_never_be_a_golden_run` | ✅ `httpx.AsyncClient.send was called - outbound egress attempted` → ⭐ **PUBLISHING performed the external action**. ⚠ **The 189-armed fence was GREEN-because-vacuous** (unbound step; switch off); 190-13 **asserted both preconditions** (`:1206-1218`) before the RED was real | **closed** |
| **11** | Unbounded response / decompression bomb | `egress.py:634-644` Content-Length pre-check; `:648-654` **`aiter_raw`** wire cap (raw, so the cap is not paid after decoding); `:477-520` `_decode_bounded` uses `zlib.decompressobj().decompress(raw, max_bytes+1)` which bounds the **OUTPUT**; an unknown `Content-Encoding` is **refused, not guessed** (`:490`); `Accept-Encoding: identity` requested (`:581`) | `test_T11_an_oversized_response_is_capped_and_fails_cleanly` · `test_T11b_a_gzip_bomb_is_capped_on_the_DECOMPRESSED_size` (chunk-pull counted, so a reader that buffers-then-raises fails) | ✅ `DID NOT RAISE` ×2 — a 5 KB body expanding to 5 MB sailed through | **closed** |
| **12** | SMTP header injection | `smtp_adapter.py:351-359` — `EmailMessage()` with every header set via `msg[...]`, so the **stdlib's own `ValueError` is the guard** (no regex); re-raised carrying the header **NAME only** (`:117`). Envelope validated **separately** with `parseaddr` (`:159`, `:344-348`) because `To:` is a header and `RCPT TO` is not. Only `send_message` is used (`:223`) | `test_190_smtp_header_injection.py` — 13 cases incl. `test_a_CRLF_in_the_subject_is_REFUSED_not_stripped_and_not_a_500` | ✅ **two** plants. ⭐ PLANT B: `AdapterResult(ok=True…)` over a wire reading `Subject: Renewal\r\nBcc: attacker@evil.com`. ⚠ **PLANT A alone leaves the three CR/LF cases GREEN** — it falsifies the source fence, not T12 | **closed** |
| **13** | ⭐ **Slack `200 {"ok": false}` read as success** | `slack_adapter.py:447` status gate **and** `:467` `payload.get("ok") is not True` — **identity, not truthiness**, because `{"ok": "false"}` is a non-empty string. `egress.PinnedResponse` (`:454-465`) is deliberately **uninterpreted** with a docblock forbidding a shared `success` flag; no `raise_for_status` and no shared `_check_response` with Jira | `test_190_slack_ok_false.py` — 13 cases + the `ok:true` non-vacuity control | ✅ **13 failed, 12 passed** — the success path logged `one message posted (channel=… ts=None)` for a reply saying `channel_not_found` — ⭐ the SAME line a real success writes | **closed** |
| **14** | ⭐ **Host bypasses** (`slack.com@evil.com`, homographs) | `egress.py:386` host is read from **`httpx.URL(parsed).host`** — strips userinfo, drops query and fragment, lowercases; `:393` a non-ASCII (IDNA-decoded) host gets its **own** refusal code rather than a silent allow-list miss; `:274` `_normalise_host` strips the trailing dot | `test_the_host_comes_from_the_PARSED_url_never_the_raw_string` · `test_a_non_ascii_host_is_refused_with_its_own_reason_code` · `test_a_userinfo_or_homograph_host_cannot_reach_slack` | ✅ PLANT 6 → **13 failed** — `slack.com@evil.com`, `slack.com:443@evil.com`, `evil.com/?x=https://slack.com`, `evil.com#slack.com`, `slack.com.evil.com` **all accepted** | **closed** |

**Fourteen of fourteen carry a plan, a test, a plant and a verbatim RED. None is argued.**

---

## ⚠ CR-01 — re-verified at HEAD, in BOTH halves, against the LIVE database

The review found `secret_ciphertext` readable over PostgREST by any authenticated org member. The
fix report claims closure via migration 118 plus explicit column projections. **Neither half was
accepted; both were re-derived.**

**The DB half** — this auditor's own `information_schema` query is reproduced in full above.
`authenticated` holds **INSERT and UPDATE on the secret column and no SELECT**; **`anon` holds
nothing at all on the table**, which is one step past what the review named. Eight live-DB cases
in `tests/integration/test_190_secret_column_privilege.py` **PASSED and did not skip** (verified
with `-v`, node ids listed). Three of the eight exist to stop the fix being wrong in the other
direction: the safe columns still read (together **and individually**); `authenticated` keeps
INSERT/UPDATE on the secret column so an org admin can still store one; and **`service_role` still
reads it**, without which the harness resolver breaks every send.

**The code half — this is the half a green DB test cannot prove.** Postgres expands `SELECT *`
to every column and checks SELECT on each, so one missing column refuses the whole statement, and
**PostgREST's default projection is `select=*`**. Every user-JWT query therefore had to name its
columns, and does: `_SELECTABLE_COLUMNS` (`connector_service.py:139`) is `",".join(_RESPONSE_KEYS)`
— **derived from `ConnectorConnectionResponse.model_fields` (`:99`), never retyped** — applied at
`:525` (list), `:552` (get), `:583` (update's ownership check), and through `_project()` (`:258-272`)
on all four representation writes, because postgrest-py 2.x exposes no chaining `?select=` for
POST/PATCH/DELETE. The single surviving `select("*")` (`_fetch_connection_row`, `:304`) runs on the
**service-role** pool, is the one caller that legitimately needs the ciphertext, and is
`WHERE id AND org_id` with no default on `org_id` — and its docstring says so, so the asymmetry
reads as a decision.

`_project` is checked for **REACH, not just RED**:
`test_CR01_the_project_helper_actually_sets_the_param_on_a_REAL_builder`
(`test_190_review_fix_data_layer.py:72`) drives a **real** `postgrest.SyncPostgrestClient` builder
with a control asserting postgrest does not set `select` by itself. Without it, every other CR-01
case would pass against a `_project` that had silently stopped working after a library upgrade,
because they all run against doubles. **This is exactly the failure mode this audit exists to
catch, and the phase caught it first.**

**Greenfield parity — a defect the review did not make, closed in the same commit.**
`regenerate-full-schema.sh` runs `pg_dump --no-privileges`, so 118's `REVOKE`/`GRANT` did not
survive regeneration while its `COMMENT` did: **a greenfield bootstrap would have silently
re-shipped CR-01.** Re-derived by this audit: `grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql`
→ **4**, and the four lines are 118's verbatim (`full-schema.sql:5995-5996, 6017`). The general
case — nothing fences a *future* privilege-narrowing migration against the same omission — is
`AR-190-13`.

## CR-02 / CR-03 / CR-04 — re-verified at HEAD

| Finding | Fixed at | Read by this audit | Why the drive is honest |
|---|---|---|---|
| **CR-02** kill switch read an unbounded-stale cache | `phase_types.py:2215` `await ensure_settings_fresh()` **above** the audience read; imported into the module's own namespace (`:99`) so the ordering fence's `monkeypatch.setattr` still binds | ✅ | The drive asserts the recorded call **ORDER** `["fresh","audience"]`, not an outcome — an outcome assertion reads identically on a warm cache, which is the exact condition under which the defect does not reproduce. `test_CR02_a_failing_refresh_never_turns_the_gate_into_a_crash` is its partner |
| **CR-03** kill switch failed **OPEN** for 3 of 4 audiences | `phase_types.py:2228` — `if feature_audience(...) != "everyone": return _record(...)`. A **positive** test, not an absence | ✅ | Parametrised over `operators`, `role`, `""`, `something-new` — none is an audience anyone writes today and **all must still refuse**, which is what makes it fail-closed against a **fifth** audience. `test_CR03_everyone_really_does_open_it_or_the_case_above_is_vacuous` is the non-vacuity partner. **This is the Phase-185 lesson verbatim: a deny-list cannot be made fail-closed by extension** |
| **CR-04** blocking DNS on the event loop, 3 sites | `egress.py:565` and `:747` and `phase_types.py:2239` — all three wrapped in `run_in_threadpool`. `validate_destination` deliberately **stays a plain sync module attribute** so the D-06 ordering fence keeps binding the thing the executor calls; only the thread moved | ✅ | The drive asserts a **thread identity** (`assert 96204 != 96204`), because nothing else distinguishes *off the loop* from *fast enough today*. ⚠ The SMTP site was the sharp one — the **connect** had been threadpooled since 190-07 while the DNS lookup **preceding** it stayed on the loop; half a fix read exactly like a whole one | Residual (a lookup budget so a hostile nameserver cannot hold a threadpool slot) → `AR-190-10` |

---

## Trust Boundaries

| Boundary | Description | Data crossing |
|---|---|---|
| org-configured host string → **our socket** | **The boundary this phase creates.** Untrusted tenant input decides a destination for the first time in the product | scheme, host, port — validated at `egress.py:330` before any socket exists |
| DNS answer → connection target | The TOCTOU window. **Every** answer is validated (`:406`) and the **first** is pinned (`:424`); the connection goes to the IP while TLS verifies the NAME (`:573`, `:609`, `:697`) | `(ip, hostname, port, scheme)` |
| remote server → our client | A 30x is the remote deciding where we connect next; a large body is the remote deciding how much memory we spend | refused (`:626`) / capped on the wire **and** after decompression (`:648`, `:499`) |
| **org A run → org B credential row** | The tenant boundary. Crossed by an `id`-only `SELECT`, which passes every ordinary test | `connection_id` (authored, untrusted) → scoped by the **RUN's** org at two independent gates |
| definition JSONB → client / export | A definition is copyable, exportable, hand-editable and reaches the browser verbatim | **an id and nothing else** (`models/harness.py:277`) |
| **publish (golden run) → the wire** | `D-189-DEF-04`, inert until this phase's own commit made it live | nothing — GATE 1 (`phase_types.py:2194`) |
| **boot resume sweep → the wire** | The *second* door D-16's gate does not watch; a second ctx builder does not carry `is_golden_run` | nothing — excluded in SQL **and** re-checked (`db/workflows.py:868,879`) |
| operator kill switch → the send path | With `live_connectors` not `"everyone"`, an `external_action` step behaves exactly as it did in 189 | `recorded_not_sent` — a genuine, already-tested state |
| user HTTP request → **outbound socket** | **New in this phase.** `POST /connectors/connections/{id}/check` is the first synchronous outbound call made from a user request in this codebase | destination + stored credential; org-admin only, **no rate limit** (`AR-190-10`) |
| composed workflow text → a vendor renderer | ADF / SMTP headers / Slack text | closed two-column lookup, **no evaluator** (`phase_types.py:1985`) |
| PostgREST (browser, user JWT) → `connector_connections` | Column privileges **and** RLS are independent gates, and both were needed | safe columns only; `secret_ciphertext` unreadable by `authenticated`, `anon` holds nothing |
| harness engine (service-role / BYPASSRLS) → the row | RLS is **not** the gate here — the application org filter is (D-15 case 2) | `WHERE id AND org_id`, plus a post-fetch re-check |
| adapter → the wire | D-05: adapters own no socket; the only door is `egress.py` | property-matched source fence with three controls |

---

## Threat Register — 115 threats

Verdict key: **closed** · **accepted-risk** (with an `AR-190-nn` entry naming owner + trigger) ·
**OPEN**.

### Plan 190-01 — Wave 0: the three RED tests

| ID | Category | Disposition | Evidence read/run by this audit | Verdict |
|---|---|---|---|---|
| T-190-01-T8 | Elevation of privilege | mitigate | `connector_service.py:361-363` — `org_id` positional, no default; `inspect.signature` assertion + non-vacuity control. Re-run green | closed |
| T-190-01-T10 | Tampering | mitigate | Baseline recorded green-**because-inert**, and 190-13 proved it: both preconditions now ASSERTED at `test_harness_engine.py:1206-1218`. RED then green in one commit | closed |
| T-190-01-D06 | Tampering | mitigate → **downgraded** | Ordering exists (`phase_types.py:2237` above `:2258`) and is driven — but the `create_ticket` drive uses a `SimpleNamespace` the shipped model forbids; the real-model case covers `post_message` only | **accepted-risk** `AR-190-08` |
| T-190-01-VAC | Repudiation | mitigate | Every 190 drive carries a non-vacuity control; REDs recorded verbatim in the test files' own docstrings, not only in summaries. Spot-verified in `test_190_egress_ordering.py:55-75`, `test_190_review_fix_executor.py:197`, `test_harness_engine.py:1173-1192` | closed |

### Plan 190-02 — the egress guard

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-02-T1 | Tampering | mitigate | `egress.py:399-418` resolve-then-check-every-answer; PLANT 5 RED | closed |
| T-190-02-T4 | Information disclosure | mitigate | `egress.py:112-170`; 29-address corpus; metadata endpoint asserted in **three** forms (`169.254.169.254`, `::ffff:169.254.169.254`, `64:ff9b::a9fe:a9fe`); four clause deletions RED **individually** | closed |
| T-190-02-T14 | Spoofing | mitigate | `egress.py:386,393,277`; PLANT 6 → 13 failures | closed |
| T-190-02-D08 | Information disclosure | mitigate | `egress.py:190-197` keyword-only, no `**kwargs`; `:310-327` one WARNING carrying capability/host/reason; sentinel test **with** a positive control proving the log capture works | closed |
| T-190-02-DENY | Tampering | **accept-with-control** | `AR-190-01`. `ip.is_global` is itself a CPython table — stated at `egress.py:34-38` rather than claimed as a pure property. The artefact is the **corpus**, and each clause carries its own driven RED | closed (accepted) |

### Plan 190-03 — migrations 116 · 117

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-03-T8 | Elevation of privilege | mitigate | Live DB: `relrowsecurity = t`, **4** policies, all `TO authenticated`, SELECT is `org_id IN (SELECT current_user_org_ids())` with **no `is_system` escape branch** — the exact branch SEED-125 had to close. Queried by this audit | closed |
| T-190-03-PRIV | Elevation of privilege | mitigate | Live DB: INSERT/UPDATE/DELETE policies all carry `current_user_has_permission(org_id,'org:manage')`. Queried by this audit | closed |
| T-190-03-SECRET | Information disclosure | mitigate | `COMMENT ON COLUMN` present in `full-schema.sql:771` (read); the real fence is `models/connector.py:67` `extra='forbid'` per-capability config models — a `smtp_password` key is unconstructable | closed |
| T-190-03-ORPHAN | Tampering | mitigate | `autofill_org_id_by_owner('created_by')` + `NOT NULL`; the trigger fails safe to NULL which the column rejects. Belt: `connector_service.py:491` **hard-sets** `org_id` from the authenticated caller, never from the body | closed |
| T-190-03-MIG | Tampering | mitigate | `ls supabase/migrations/` → `116_connector_connections.sql`, `117_harness_audit_external_action_sent.sql`, `118_connector_secret_column_privilege.sql` — all match `^[0-9]+_[a-z0-9_]+\.sql$`; **no letter suffix** (a `116b` is silently skipped by the CLI and would ship a table that does not exist) | closed |
| T-190-03-DATA | Denial of service | mitigate | `supabase db push` / `db reset` **never run**. ⚠ Deviation recorded, not normalised: 116/117 (190-03) and 118 (the fix round) were applied via `psycopg2` `autocommit`, **no reset**, because the session was unattended — the fallback D-21 names in as many words. Live DB retains dev data (0 connector rows is the *correct* count, not a wipe) | closed |

### Plan 190-04 — the D-01 ROADMAP amendment

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-04-01 | Repudiation | mitigate | `docs/CONNECTOR-ARCHITECTURE.md` `+119 / -0` in `git diff --numstat de122b9a..HEAD` — **append-only**, re-derived by this audit. The verdict cannot have been quietly rewritten | closed |
| T-190-04-02 | Tampering | mitigate | ROADMAP SC#1 corrected with the superseded wording preserved; `.planning/prd-reset/DECISIONS.md` gains the superseding `D-v3.6-02` pointer (`+17/-…` in the diff) | closed |
| T-190-04-03 | Tampering | mitigate | The amendment's own basis re-measured by this audit: `grep -rni "\bmcp\b" backend/app --include=*.py` → **0**; `test_189_no_egress.py` Case A run green (31 passed) | closed |
| T-190-04-04 | Denial of service | mitigate | `git diff --numstat de122b9a..HEAD -- deploy/onebox.env.example docs/OPERATOR.md docker-compose.prod.yml` → EMPTY, and the phase reads **no new env var** (`SECRETS_ENCRYPTION_KEY` is the shipped one), so `check-deploy-drift.sh` is unaffected | closed |
| T-190-04-G7 | Tampering | mitigate | D-32 restated as a written line in ROADMAP and at `190-VALIDATION.md` §H. `node scripts/check-gap-closure-rounds.cjs 190` → **G-7 clear**, 19 plans, 0 gap-closure | closed |

### Plan 190-05 — the `Not connected` badge retires by DATA

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-05-T6 | Information disclosure | mitigate | `phaseVocabulary.ts` `notConnectedOf` reads **only** `phase.config.connection_id`; no host/token/secret key is read and the canvas renders no new string. `phaseVocabulary.test.ts` green (part of 236) | closed |
| T-190-05-FENCE | Tampering | mitigate | **Re-derived by this audit:** `git diff --numstat de122b9a..HEAD` over all eight fenced files → **EMPTY** | closed |
| T-190-05-IMPORT | Tampering | mitigate | Re-derived: `grep -cE "^\s*(import|const .* = require\()" phaseVocabulary.ts` → **0**. Plant was a real `import type` in production source; both fences fired; restored md5-identical | closed |
| T-190-05-BADGE | Spoofing | mitigate | No badge added; the max-2 badge guard is a **typecheck error** since 188.2-01. `tsc --noEmit -p tsconfig.app.json` re-run by this audit → **33**, the baseline unmoved | closed |
| T-190-05-PIN | Repudiation | mitigate | `node scripts/vitest-count-gate.cjs` re-run by this audit → `count gate OK`, 51/51 pinned, **0 failing** | closed |

### Plan 190-06 — the credential layer

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-06-T8 | Elevation of privilege | mitigate | See D-28 row 8. **The id-only resolver was authored first and the leak OBSERVED** before the scoped one landed; two gates at `:305-306` and `:397`; a cross-org miss is `ConnectorNotFound` (`:147-154`), never a forbidden status | closed |
| T-190-06-T5 | Information disclosure | mitigate | `connector_service.py:244` redacting `__repr__` + `repr=False` at `:194`; logs carry `row["id"]`, capability and **sorted config KEYS** (`:444-447`), never values. Plant RED with the ciphertext in the captured line | closed |
| T-190-06-T7 | Information disclosure | mitigate | `models/connector.py:231` + the module-scope assert at `connector_service.py:109`. Plant → **collection error** | closed (SSE clause → `AR-190-11`) |
| T-190-06-T6 | Information disclosure | mitigate | `models/connector.py:67` `extra='forbid'` on every config model; `models/harness.py:277` the reference only | closed |
| T-190-06-D11 | Information disclosure | mitigate | **Fail-CLOSED at BOTH ends, inverting the shipped `app_settings` polarity.** Write: `connector_service.py:479` refuses when `get_cipher()` is None. Read: `:420` refuses a non-envelope value (`sso_provider_service`'s `return raw` is the fail-OPEN precedent this deliberately does **not** copy) and `:433` refuses an envelope with no key. Both plants RED | closed |
| T-190-06-ORACLE | Information disclosure | mitigate | `connector_service.py:583-585` ownership validated FIRST, org-scoped, so an unowned id 404s **regardless of body validity**. `test_an_unowned_id_404s_whatever_the_body_says` green | closed |
| T-190-06-BLOCK | Denial of service | mitigate | `aexec` / `run_in_threadpool` on every driver call (D-v2.5-01). Strengthened by CR-04 — see the CR table | closed |

### Plan 190-07 — the transport binders

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-07-T2 | Tampering | mitigate | D-28 row 2 | closed |
| T-190-07-T2b | Spoofing | mitigate | `egress.py:584` `Host:` header, `:609` `request.extensions["sni_hostname"]`, `:697` `client._host` set **before** `connect()` — *a pin that loses SNI is worse than no pin*. `test_T2b_the_TLS_identity_survives_the_pin` asserts it directly | closed |
| T-190-07-T3 | Tampering | mitigate | D-28 row 3 | closed |
| T-190-07-T11 | Denial of service | mitigate | D-28 row 11 | closed |
| T-190-07-RES | Tampering | **accept-with-fence** | `AR-190-02`. `test_190_residual_fence.py` **5 passed** in this audit's run, against the **installed** library | closed (accepted) |
| T-190-07-BLOCK | Denial of service | mitigate | `egress.py:747` **and** `:766` — the DNS resolve **and** the blocking connect both threadpooled. ⚠ Only the second was true before CR-04 | closed |

### Plan 190-08 — the connectors package + SMTP adapter

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-08-T12 | Tampering | mitigate | D-28 row 12 | closed |
| T-190-08-ENV | Tampering | mitigate | `smtp_adapter.py:159` `parseaddr` on **every envelope recipient**, asserted independently of the header path — `msg["To"] = "v@example.com, attacker@evil.com"` raises nothing, so the two channels must be validated separately. `:223` `send_message(..., to_addrs=<the validated list>)` carries the list, never a re-read of the header | closed |
| T-190-08-D05 | Tampering | mitigate | Property matchers, three controls; PLANT A RED. Re-derived by this audit: **0** transport imports/constructions under `connectors/` | closed |
| T-190-08-D04 | Elevation of privilege | mitigate | `registry.py:58` module-scope `assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES)`. ⭐ PLANT B (a 4th key) **aborted the whole pytest session at COLLECTION** — a stronger RED than a failing test. *A fourth capability is a phase, not a dictionary entry* | closed |
| T-190-08-CHECK | Repudiation | mitigate | `test_check_authenticates_and_issues_no_DATA_command` — UI-SPEC §5c's *"and nothing was sent"* is proved at the level it is claimed | closed |
| T-190-08-D18 | Repudiation | mitigate | No retry/backoff/queue on this path, grep-asserted per line. ⚠ See the **ARG-3** note — D-18's *"halts the run"* wording is measurably not the shipped engine semantic; at-most-once **is** shipped | closed |
| T-190-08-LEAK | Information disclosure | mitigate | `smtp_adapter.py:117` refusals carry the header **NAME** and the composer's explanation, never the value | closed |

### Plan 190-09 — the router + kill switch

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-09-U02 | Elevation of privilege | mitigate | `api/connectors.py:335,372,413,437` — `Depends(require_org_manage)` on all four writes; driven by an **API-only** test (`test_a_plain_member_cannot_write_and_the_api_alone_says_so`), so the hidden button is explicitly not the gate. Backed at the DB by the three `org:manage` RLS policies queried above | closed |
| T-190-09-T7 | Information disclosure | mitigate | See T-190-06-T7 | closed |
| T-190-09-LEAK | Information disclosure | mitigate | `api/connectors.py:186` one `_NOT_FOUND`; cross-org and absent ids collapse to 404; the forbidden status is never constructed. `test_a_connection_id_from_another_org_is_absent_never_forbidden` green | closed |
| T-190-09-FLAG | Tampering | mitigate | `_GOVERNED_FEATURES["live_connectors"] == "off"` **read, not retyped**; live DB confirms the key is **absent** from `feature_visibility` ⇒ cold default. `test_the_kill_switch_refuses_writes_off_and_permits_them_on` exercises **both** directions with `org:manage` granted in both halves, so the audience is the only variable | closed for the declared scope (non-operator). ⚠ **the OPERATOR path is `AR-190-09`** |
| T-190-09-503 | Denial of service | **accept** | `AR-190-03` | closed (accepted) |

### Plan 190-10 — Jira adapter

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-10-ADF | Tampering | mitigate | `_plain_text_to_adf` **builds** a document from a string; author-supplied ADF is refused by a raise. Plant (dict passthrough) RED. This is also D-09's per-field-templating fence | closed |
| T-190-10-AUTH | Information disclosure | mitigate | `jira_adapter.py:479,603` — `auth=(email, token)` handed to `httpx`; **no `base64` call and no hand-built `Authorization` string** in the file (grep-asserted). A hand-built string is one interpolation from a log line | closed |
| T-190-10-STATUS | Repudiation | mitigate | Jira's own status codes drive the verdict; a source fence asserts **no shared response helper with Slack**. Flattening the two IS the T13 defect | closed |
| T-190-10-WORD | Repudiation | mitigate | 401/403 → `rejected`; transport miss → `unreachable`; `EgressRefused` → `refused`. All three §4d buckets asserted. A refusal must never render *"failed"* | closed |
| T-190-10-D18 | Repudiation | mitigate | Exactly one call reaches the binder, asserted; no retry/backoff/sleep | closed |
| T-190-10-A1 | Repudiation | **accept-with-trigger** | `AR-190-04` | closed (accepted) |

### Plan 190-11 — Slack adapter

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-11-T13 | Repudiation | mitigate | D-28 row 13 | closed |
| T-190-11-SPLIT | Repudiation | mitigate | No shared `_check_response`; `raise_for_status` asserted **absent** from the file. Verified by grep at HEAD | closed |
| T-190-11-HOST | Spoofing | mitigate | `slack_adapter.py:241` builds every URL from `SLACK_API_BASE`, **imported from `egress.py:232`** with exactly one spelling; a `config.base_url` pointing at `evil.com` is proved not to move the request. ⭐ This is the guard suite's genuine negative control — one of the three destinations is unforgeable by construction | closed |
| T-190-11-TOKEN | Information disclosure | mitigate | `slack_adapter.py:335` `Authorization: Bearer`; a body `token` key asserted **absent** — Slack accepts it and it is deliberately not used, because *a token in a body is a token in a log* | closed (see UF-190-03 on the fence's necessary scoping) |
| T-190-11-D18 | Repudiation | mitigate | One call, asserted; `rate_limited` is not retried | closed |
| T-190-11-CHECK | Repudiation | mitigate | `check()` calls `auth.test` only (`:533`); a test asserts `chat.postMessage` is never called. ⚠ The **call shape** is A3 → `AR-190-06` | closed |

### Plan 190-12 — ConnectionPicker + the slug seam

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-12-T6 | Information disclosure | mitigate | D-28 row 6 | closed |
| T-190-12-U07a | Repudiation | mitigate | Copy rule 5 grep-asserted: no `cannot` / `no step will be allowed` / `never bound`. Gate 1 is client-only and the sentence says *the picker*, matching its exact reach | closed |
| T-190-12-FENCE | Tampering | mitigate | `ExternalActionSection.tsx` is `+2 / -0` in the phase diff; its **six** purity fences were **RE-RUN after the mount** rather than assumed, file unmoved at 34 tests | closed |
| T-190-12-D23 | Tampering | mitigate | Re-derived: `PhaseFormPanel.tsx` numstat vs `de122b9a` → **EMPTY**. The write seam is `SelectedPhaseSlugContext.tsx`, a context, not a fourth prop | closed |
| T-190-12-A11Y | Denial of service (screen reader) | mitigate | Real `<label>`; failing options `aria-disabled` with the reason as adjacent DOM text; `role="alert"`; **no `title=`**. Suite green (236) | closed |
| T-190-12-CRASH | Denial of service | mitigate | Optional accessors + a disconnected state, asserted by a standalone-render test | closed |

### Plan 190-13 — the ordered send path

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-13-T10 | Tampering | mitigate | D-28 row 10 — GATE 1 at `phase_types.py:2194`, shape 1 (skip the send, keep the record) so `_external_action_body` remains the single composer | closed |
| T-190-13-A4 | Tampering | mitigate | ⭐ **The plan's own test proved the path REACHABLE and the plan reported it rather than routing around it.** Closed at the ROOT: `db/workflows.py:868` SQL predicate **and** `:879` post-fetch re-check, with the docblock arguing *"a golden run is not a thing to resume"* rather than *"a resumed golden run must not send"*. `test_a_resumed_run_can_never_be_a_golden_run` green | closed (the **generalisation** is ARG-2 → UF-190-02) |
| T-190-13-D06 | Tampering | mitigate → **downgraded** | See §(c) above | **accepted-risk** `AR-190-08` |
| T-190-13-T8 | Elevation of privilege | mitigate | `phase_types.py:2258` `resolve_connection(str(connection_id), org_id=str(org_id))`; `:2246-2254` a run with **no org fails CLOSED** to `recorded_not_sent` rather than resolving unscoped | closed |
| T-190-13-T9 | Tampering | mitigate | Input resolution unchanged; no evaluator added. D-28 row 9 | closed |
| T-190-13-T13 | Repudiation | mitigate | `phase_types.py:2334` — only the adapter's own `ok` produces `completed`; `failed` and `recorded_not_sent` proved distinguishable on **status, body first line and sentinel-key presence** | closed |
| T-190-13-T5 | Information disclosure | mitigate | `_write_send_receipt` (`:2008-2039`) carries capability, connection id, destination **HOST**, raw status, phase — and nothing else. `test_harness_engine.py:1491-1516` asserts the receipt **exists** (anti-vacuity) then sweeps the whole payload at any depth for the sentinel, for a bare `xoxb-` prefix, **and for the request body** | closed |
| T-190-13-D18 | Repudiation | mitigate | Grep-asserted against `HEAD~`; no retry, backoff or queue reaches this path | closed |
| T-190-13-D26 | Tampering | mitigate | GATE 2 at `:2228`, hardened by CR-03 to a positive test. Exercised in both directions | closed |

### Plan 190-14 — the fence suite

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-14-D05 | Tampering | mitigate | Property matchers + matcher control + non-vacuity walk; PLANT A RED, restored md5-identical | closed |
| T-190-14-D04 | Elevation of privilege | mitigate | `registry.py:58`; PLANT B aborted collection; `test_every_capability_resolves_to_an_importable_adapter` and `test_the_registry_key_set_is_derived_not_retyped` (equality alone is a patch — a hand-typed matching list would pass it) | closed |
| T-190-14-T9 | Tampering | mitigate | D-28 row 9. ⭐ PLANT F is the evidence that matters: it **caught the fence being inert** | closed |
| T-190-14-D32 | Tampering | mitigate | `test_no_expression_language_was_added_to_the_phase_config` + `test_the_D32_scope_fence_holds_on_the_canvas_and_on_the_send_path`, green. Exactly one new field, whose name suggests no expression/template/mapping surface | closed |
| T-190-14-VAC | Repudiation | mitigate | Every fence lists its positive control first and asserts its own walk is non-vacuous. Spot-verified at `:156`, `:213`, `:240` | closed |

### Plan 190-15 — the credential check + Gate 2

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-15-CHK | Information disclosure | mitigate | `api/connectors.py:434-440` — the route takes an **id and nothing else**; there is no request body, so **no plaintext secret crosses the wire for a non-storage purpose**. The signature *is* the security property, and it is asserted | closed |
| T-190-15-SEND | Repudiation | mitigate | Parametrised across all three capabilities with the transport recorder armed: no `chat.postMessage`, no issue POST, no SMTP `DATA` | closed |
| T-190-15-U07a | Repudiation | mitigate | `last_check_verdict` asserted to appear **zero** times in `phase_types.py`; door (b) asserted as a **POSITIVE** test so a later server bind-gate fails loudly rather than silently contradicting the shipped copy | closed |
| T-190-15-STALE | Denial of service | mitigate | GATE 2's reach is exactly the row's ORG and `is_enabled` (`phase_types.py:2259-2290`); it reads no stored verdict, so a rotated credential is never refused by a two-day-old check | closed |
| T-190-15-U02 | Elevation of privilege | mitigate | `api/connectors.py:437` `require_org_manage`, with the asymmetry (check is admin-only, bind is org-wide) named in a code comment so a later reader does not "fix" it | closed |
| T-190-15-D17 | Repudiation | mitigate | A disabled connection is treated as UNBOUND → `recorded_not_sent`, sharing the shipped terminal and its single composer; `resolve_connection:404` refuses **before** any decryption | closed |

### Plan 190-16 — Settings → Connections

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-16-T7 | Information disclosure | mitigate | Rendered-DOM sweep for secret-shaped keys; plant G RED (`expected '<section aria-label="connections" …' not to contain 'secret'`). Suite green | closed |
| T-190-16-U02 | Elevation of privilege | mitigate | The Add affordance is **removed** for a non-admin (absence asserted, not merely `disabled`); the API gate is the real enforcement | closed |
| T-190-16-A11Y | Denial of service (screen reader) | mitigate | `aria-label="More actions for {name}"` with three distinct names across three rows; every state carries a glyph **and** a word so it reads in greyscale | closed |
| T-190-16-BANNER | Repudiation | mitigate | Exactly one banner node asserted, zero per-row notices; the technical name appears once, in a `<code>` | closed |
| T-190-16-DESTRUCT | Denial of service | mitigate | Victim-naming sheet graded by whether a victim exists, victim named in the button label; Enable flips directly (restorative asymmetry); every write lands as a receipt | closed |
| T-190-16-ICON | Spoofing | mitigate | Capability marks from the already-installed `fluent-emoji`, never vendor logos; each slug confirmed to resolve at build time (the Phase-127 empty-icon trap) | closed |

### Plan 190-17 — the add/edit panel

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-17-SECRET | Information disclosure | mitigate | A `font-mono` `<span>` of dots — **never** an `input[type=password]` with a fake value; asserted by a test that queries for both. The response model makes the copy true | closed |
| T-190-17-DEST | Spoofing | mitigate | The 🔒 destination footer is rendered **always**, derived during render, never behind an Advanced disclosure (024-A's cure for BUG-260616-01); a refused destination is styled and worded distinctly | closed |
| T-190-17-FOCUS | Denial of service (keyboard) | mitigate | A **real** focus trap and focus restore, asserted via `document.activeElement` rather than by the presence of a handler. Ten plants driven RED | closed |
| T-190-17-U02 | Elevation of privilege | mitigate | Non-admin gets static text, no `Replace`, no actions; the API gate is the enforcement | closed |
| T-190-17-D23 | Tampering | mitigate | Re-derived: `PhaseFormPanel.tsx` numstat → EMPTY; never imported; its two type rules are MIRRORED | closed |
| T-190-17-SCOPE | Tampering | mitigate | Exactly 4 / 5 / 3 fields asserted. No OAuth surface, no advanced section, no extra vendor field (D-03, D-32) | closed |

### Plan 190-18 — refusal copy, check moments, graded guards

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-18-T5 | Information disclosure | mitigate | A sentinel secret asserted absent from `innerHTML`, every `data-` attribute, every `aria-label` and every `title` — **with** a positive control proving the search works | closed |
| T-190-18-D06 | Repudiation | mitigate | The n8n ordering property in user-facing words, asserted by **character identity** so it cannot be trimmed as filler. ⚠ Accuracy footnote: for `create_ticket` the plaintext exists one frame earlier (`jira_adapter.py:479`, self-documented at `:99-107`); the credential is still never transmitted to a refused destination, so the sentence's substantive claim holds | closed |
| T-190-18-ASYM | Repudiation | mitigate | Egress refusal → Save **enabled**; cipher unavailable → Save **disabled** with `aria-describedby`. Both directions asserted in one file, because the asymmetry IS the contract | closed |
| T-190-18-SWAP | Repudiation | mitigate | A refusal never renders *"failed"*; an unreachable host never renders *"refused"*. All three buckets asserted. ⚠ This phase separately measured a fence that asserted the word `failed` and **missed a sentence containing `failing`** — the character-identity assertions are the response to that | closed |
| T-190-18-U07a | Repudiation | mitigate | Exact-equality against the imported identifier + a grep fence on absolute verbs | closed |
| T-190-18-JARGON | Denial of service (comprehension) | mitigate | Banned-vocabulary fence over the copy module's exports: no `SSRF`, `RFC1918`, `CIDR`, `link-local`, `NAT64`, `SIIT`, `TOCTOU`, `metadata endpoint`, `allow-list` | closed |
| T-190-18-CODE | Tampering | mitigate | A module-scope assertion that the client's reason-key set equals `egress.py:77`'s six codes — mirrored by `egress.py:87`'s own `assert len(REFUSAL_REASONS) == 6` **and** by `EgressRefused.__init__:198` rejecting an unknown code **at raise time**, so a seventh code cannot render an empty block | closed |

### Plan 190-19 — the phase close

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-19-SCORE | Repudiation | mitigate | The roster is DERIVED from `MODEL_CAPABILITIES` by a pasted command; **8 rows present, each ⛔ with `BLOCK-190-UAT-01`, none omitted**. *A scoreboard that lists only what passed is not a scoreboard* — and this one lists nothing as passed | closed |
| T-190-19-FENCE | Tampering | mitigate | Re-derived by this audit against **the phase's own base** `de122b9a` — the only comparison that catches a file opened in one plan and closed in another → EMPTY | closed |
| T-190-19-PLANT | Tampering | mitigate | Re-derived: `grep -rn "PLANT" backend/app frontend/src` (non-test) → **0**. ⚠ The criterion as literally written was **unsatisfiable** (13 test files carry the word in prose); resolved by a **tokenizer** proving zero non-string / non-comment `PLANT` tokens — measured, not gamed | closed |
| T-190-19-D30 | Repudiation | **accept-with-decision** | `AR-190-07` | closed (accepted) |
| T-190-19-A1 | Repudiation | **accept-with-trigger** | `AR-190-04` | closed (accepted) |
| T-190-19-RES | Tampering | **accept-with-fence** | `AR-190-02` | closed (accepted) |
| T-190-19-G7 | Repudiation | mitigate | Re-run by this audit: `node scripts/check-gap-closure-rounds.cjs 190` → **G-7 clear**, 19 plans, 0 gap-closure. D-32 restated as a written line | closed |

### Recurring

| ID | Category | Disposition | Evidence | Verdict |
|---|---|---|---|---|
| T-190-SC | Tampering | mitigate | **Phase 190 installs NOTHING.** Re-derived by this audit: `git diff --numstat de122b9a..HEAD -- backend/requirements.txt frontend/package.json frontend/package-lock.json` → **EMPTY**. `slack_sdk` was explicitly **refused** because it would construct its own client and break D-05 outright, for one POST. The Package Legitimacy Audit stays NOT APPLICABLE, so no legitimacy checkpoint is owed | closed |

---

## Totals

| | Count |
|---|---|
| Threats in the register | **115** (114 + `T-190-SC`) |
| **closed** | **102** |
| **closed (accepted risk)** | **13** |
| **OPEN** | **0** |

**`threats_open: 0` — and it is an honest zero.** Every accepted risk carries an owner and a
concrete, observable re-open trigger; six of them were **downgraded from `mitigate` by this
audit** rather than inherited as clean. Nothing was closed by argument, and the three places where
the shipped code is narrower than its own prose (§(c), `AR-190-08`, `AR-190-09`) are stated in the
body rather than buried in a footnote.

---

## Unregistered flags (WARNING — not blockers)

Every `## Threat Flags` section in `190-01` … `190-19`-SUMMARY.md was written **before** the
standard-depth code review (`f64a0ebb`, `50d058e3`) and before verification. The following surface
therefore has no authored threat row. None is a blocker; each is recorded so it cannot read as
absent.

| Flag | New surface | Where | Why not a blocker |
|---|---|---|---|
| `UF-190-01` | **The first synchronous outbound network call made from a user HTTP request in this codebase** — `POST /connectors/connections/{id}/check`. Every prior egress path is inside the harness engine. Two consequences: a **request-time SSRF surface** (the caller is a browser, not a run) and an **outbound-latency amplifier** | `api/connectors.py:429-440` | Destination still passes the full guard and the pin; audience bounded to `org:manage` by `require_org_manage`; CR-04 moved the DNS off the event loop so the worst case is threadpool occupancy, not a frozen worker. Dispositioned as `AR-190-10` |
| `UF-190-02` | **ARG-2 — the resume-path generalisation.** The specific defect (A4) was driven and closed at the root; the claim that *"any future per-run suppression flag has the same blind spot"* is a design claim with no test | `db/workflows.py:835-888` | The shipped defect is closed at two gates and fenced. The generalisation is a note for the next phase that adds a per-run flag, not shipped surface |
| `UF-190-03` | **`slack_adapter.py` constructs a credential header**, which its two siblings deliberately do not | `slack_adapter.py:335` | Unavoidable — the vendor's auth **is** a bearer token. **190-14's credential fence must stay SCOPED**: `Authorization` appears exactly twice under the package, both in that file, so a tree-wide ban would be RED on correct code. The property fenced instead is *the token appears in no body, no log and no refusal*, driven across all four failure shapes. ⚠ **Do not "complete" this fence by removing the exemption** |
| `UF-190-04` | **`require_visible` has no `ensure_settings_fresh()`** — CR-02's root cause, fixed in the executor and **not** in the dependency that gates the connector CRUD | `dependencies.py:540-542` (read at HEAD by this audit) | **Found by this audit as a distinct half of `D-190-DEF-14`**, which mentions it in passing but which no record measures. Consequence: after an operator flips `live_connectors` OFF, a **non-operator** org admin on a non-writing worker can still CREATE a connection for an unbounded window. Storage only — the send path is a separate, freshness-bounded read. Folded into `AR-190-09` |

---

## ⚠ `D-190-DEF-14` (WR-06) — dispositioned explicitly, not inherited

The verification pass judged this *"bounded and acceptable"*. **This audit re-derived it at HEAD and
reaches the same verdict for a partly different reason, and finds the consequence is LARGER than
either the review or the verification stated.**

**Confirmed present at HEAD**, `dependencies.py:540-542`, read by this auditor:

```python
async def _dep(current_user = Depends(get_current_user), request: Request = None):
    if await is_operator(current_user["id"]):
        return  # operator -> no-op
    from app.models.user_settings import feature_audience, resolve_feature_access
    audience = feature_audience(feature)
```

The operator no-op is the **first statement**, above the audience read. `GET /features`
(`api/features.py:70-72`) and `require_canvas` (`dependencies.py:668-671`) both do the opposite,
deliberately — so this dependency is the odd one out among three consumers of the same idea.

**What this audit adds that neither prior record states: it is not only a WRITE surface — it is an
EGRESS surface.** `require_visible("live_connectors")` gates four endpoints
(`api/connectors.py:331, 367, 409, 433`), and **the fourth is `/check`**, which opens a real
outbound TLS connection to the org-configured SMTP host or Jira site. So with the kill switch at
its cold default `off`, an operator can still cause the application to make an outbound connector
connection. That is a governance-honesty defect in a switch whose entire purpose is to stop
outbound activity, and it is not written down anywhere else.

**Why it is nonetheless an accepted risk and not a BLOCKER — argued so it can be checked:**

1. **No privilege is escalated.** The only actor who bypasses the switch is the only actor who can
   flip the switch, in one request, from the same session.
2. **It cannot cause a SEND.** The send-path gate is an entirely separate read —
   `phase_types.py:2228`, `feature_audience(...) != "everyone"` — with **no operator short-circuit**,
   preceded by `ensure_settings_fresh()` at `:2215`, and parametrised-driven against four
   non-`everyone` audiences. I read both and ran the drive.
3. **The outbound it does permit is still fully guarded.** `/check` goes through the same
   `validate_destination` → pin → no-redirects path as a send; it cannot reach a private IP, the
   metadata endpoint or an unallowed host, and `check()` issues no `DATA` / no `chat.postMessage` /
   no issue POST.
4. **Three independent gates remain.** `require_org_manage`, migration 116's three `org:manage`
   RLS policies (queried live above), and migration 118's column privileges.
5. **Narrowing it is genuinely a cross-feature change.** `require_visible` is shared by four other
   governed features; moving the `"off"` test above the operator no-op changes all five in one
   commit, and at least one may depend on an operator reaching a surface they switched off for
   everyone else. Getting that wrong locks an operator out of their own Control Room.

**Disposition: accepted risk `AR-190-09`, owner and trigger below.** The narrower shape the
deferral names — a dedicated `require_live_connectors` composing the off-check with
`require_visible` — leaves the four other consumers untouched and is the recommended repair.

---

## Accepted Risks Log

| Risk ID | Threat ref | Rationale | Owner | Re-open trigger (observable, never a date) | Accepted |
|---|---|---|---|---|---|
| **AR-190-01** | T-190-02-DENY | `ipaddress.is_global` is itself a table inside CPython, so the address predicate is **not a pure property** and the module says so at `egress.py:34-38` rather than claiming otherwise. What makes it defensible is the **corpus** (29 addresses, both polarities) and the fact that each of the four unwrap clauses carries its **own** driven RED — including the SIIT clause that is *the hole that would have shipped*. | Phase 190 plan `190-02` | A CPython minor upgrade changing `is_global`, **or** a fifth IPv4-embedding form entering the RFC space (`_UNWRAP_ITERATIONS = 4` at `egress.py:109` is a constant, not a `while True`, precisely so a fifth form is a deliberate edit rather than a hang). | 2026-08-08 |
| **AR-190-02** | T-190-07-RES / T-190-19-RES (`RESIDUAL-190-01`) | **Both DNS-pin recipes depend on NON-PUBLIC attributes** — `smtplib.SMTP._host` (private; `connect()`'s non-assignment of it is an implementation detail, not a documented contract) and `request.extensions["sni_hostname"]` (an httpx/httpcore internal convention). A minor upgrade could **silently un-pin the connection while every functional test still passes**, because an un-pinned connection simply re-resolves and still works. Environment when written: httpx 0.28.1 · httpcore 1.0.9 · CPython 3.12.6. | Phase 190 plan `190-07`; next owner = whoever bumps httpx or Python | ⚠ **The originally-stated trigger — "a version bump in `requirements.txt`" — CANNOT FIRE, and that was measured:** `requirements.txt:38` is `httpx>=0.28.0` with **no upper bound**, so httpx moves on any fresh install or container rebuild with nobody editing the file. **What actually protects the pin is that `tests/unit/test_190_residual_fence.py` runs on every test run against the INSTALLED library.** This audit ran it: **5 passed**. The real trigger is therefore *that suite going RED* — and it must never be "fixed" by relaxing the assertion. | 2026-08-08 |
| **AR-190-03** | T-190-09-503 | An unkeyed cipher yields a **503 with a stable reason code**. That is the correct, honest answer when the platform cannot store a tenant credential safely (D-11's fail-CLOSED inversion of the shipped `app_settings` fail-OPEN polarity). The cost is stated in UI-SPEC §4b moment 9 rather than hidden, and the panel disables Save with the reason rather than staying enabled over a retryable failure. | Phase 190 plan `190-09` | `SECRETS_ENCRYPTION_KEY` becoming optional in a deployment shape where storing a connector credential is expected to work. | 2026-08-08 |
| **AR-190-04** | T-190-10-A1 / T-190-19-A1 | **Jira's error-envelope shape is not driven against a live account.** `{"errorMessages": [...], "errors": {...}}` is MEDIUM confidence; Atlassian states only the status-code half. **The verdict does not break if it is wrong** — gate 1 (status) and gate 3 (issue key) are independent of the envelope; what degrades is the **wording**, which falls back to the reply's own decoded text, still verbatim and still the host's words. | The first live `create_ticket` UAT row (D-30) | Capture the real failure body, compare against `JIRA_ERROR_ENVELOPE`, and correct `_provider_words` / `_carries_error` if it differs. | 2026-08-09 |
| **AR-190-05** | assumption **A2** | **An unreadable reply AFTER a create leaves the outcome genuinely unknown.** `EgressResponseTooLarge` / `EgressResponseUndecodable` can only occur once the POST has left, so the issue may or may not exist and the reply that would say which is unreadable. Deliberately **not** painted with a §4d heading (the host answered ⇒ not *unreachable*; it was not our refusal ⇒ not *refused*) and **not resolvable under D-18's no-retry rule** — Jira's create takes no idempotency key at this scope. | Phase 190 plan `190-10`; next owner = whoever revisits D-18 | A live `create_ticket` row ending in either terminal, **or** the first report of a duplicate ticket from one run. Either is the moment to reconsider D-18's idempotency deferral. | 2026-08-09 |
| **AR-190-06** | assumption **A3** | **Slack's `auth.test` call shape and reply fields are not driven live.** §R11 documents `chat.postMessage` only. **A wrong guess produces a check that refuses to go green, never one that goes green wrongly** — the verdict fails CLOSED in every direction, so usability degrades and honesty does not. `send` is unaffected. | The first live `post_message` UAT row (D-30) | Already the **recommended first row**, so this closes for free alongside T13's live confirmation. | 2026-08-09 |
| **AR-190-07** | T-190-19-D30 | **The three live-send rows and all eight SC#10 provider rows are ⛔ *awaiting operator-provided destinations*.** This is a legitimate close-with-owed-rows and is recorded as a **DECISION** in three places, never as a claim that everything ran. ⚠ The blocking chain is **TWO links, not three** — verification falsified the third: five stored definitions carry an `external_action` phase and **one is published** (`ff3c6ca3…`, `send_email`), missed because `workflow_definitions.definition` is a **double-encoded** jsonb string scalar. The remaining links are a bound `connector_connections` row (live: **0**) and `live_connectors` = `everyone` (live: **absent**). | Operator (D-30) | Operator supplies a Slack workspace + bot token, a Jira site + API token, and a **publicly-routable TLS SMTP host** (measured, not assumed: `egress.py` correctly refuses the local `supabase_inbucket` loopback plaintext catch-all — the guard working, not a defect), then flips `live_connectors`. **Run `post_message` first** — it falsifies T13 and closes `AR-190-06` in the same row. | 2026-08-09 |
| **AR-190-08** | T-190-01-D06 / T-190-13-D06 (**downgraded from `mitigate` by this audit**) | **GATE 3 is a no-op in production for `create_ticket` and `send_email`** (WR-01). `_pre_credential_destination` returns `None` for both because `ExternalActionPhaseConfig` is `extra='forbid'` and carries no `base_url` — a settlement 190-06 made deliberately. The **security property holds by another route**: both binders validate as their first statement, and the D-05 source fence proves no other socket exists. What is lost is the executor-level pre-credential ordering as defence-in-depth, plus the lazy-decrypt bonus on the Jira path (`jira_adapter.py:479`, self-documented). **Also folded in: the executor docblock at `phase_types.py:2113-2115` states the ordering as an absolute, which is false for two of three capabilities.** VALIDATION's score was corrected downward (*"six of eight fully driven"* → **five of eight**) — a score that moved the honest direction. | `D-190-DEF-10` | The deferral requires **both halves in one commit**: the binder-level ordering drive (currently *asserted nowhere*) **and** the docblock correction. Fires on: the next plan that opens `_pre_credential_destination` or `ExternalActionPhaseConfig`; **or** any change adding a step-level destination field, which the real-model case at `test_190_egress_ordering.py:489` would notice. | 2026-08-09 |
| **AR-190-09** | `D-190-DEF-14` (WR-06) + `UF-190-04` | **`require_visible` short-circuits for operators before reading the audience**, so with `live_connectors` off an operator can still create/edit/delete connector connections **and run `/check`, which opens a real outbound connection** (`api/connectors.py:331,367,409,433`). ⚠ **Plus a second half this audit measured at HEAD:** the dependency has **no `ensure_settings_fresh()`**, so for non-operators the CRUD gate reads the same unbounded-stale cache CR-02 fixed in the executor. **Neither half can cause a SEND** — GATE 2 is an independent, freshness-bounded, positive read with no operator short-circuit. Storage and a guarded check-connection only; three gates (`require_org_manage`, 116's RLS, 118's privileges) remain. See the dedicated section above for the full argument. | `D-190-DEF-14`; recommended repair = a dedicated `require_live_connectors` composing the off-check **and** `ensure_settings_fresh()`, leaving the four other consumers untouched | ANY of — the next plan that opens `dependencies.py`'s `require_visible`; `D-190-DEF-09`'s Control Room card landing (the operator then has a real UI for this switch and the mismatch becomes visible); the first operator who reports saving a connection the banner says they cannot; **or** the first time `/check` is observed reaching a host while the switch reads off. | 2026-08-09 |
| **AR-190-10** | `THREAT-190-15-REQTIME` (**`UF-190-01` — in no plan's register**) | The credential check is the **first synchronous outbound call from a user HTTP request in this codebase**. Two consequences: a request-time SSRF surface (mitigated by the same pinned binders and allow-list, but the caller is a browser) and an **outbound-latency amplifier** — the SMTP path can hold a request for `SMTP_TIMEOUT_SECONDS`. **There is no rate limit** — re-derived by this audit (`grep rate_limit|slowapi|Limiter api/connectors.py` → 0); D-32 fences adding one. CR-04 closed the sharp half (DNS off the event loop, so a blackholed nameserver degrades throughput rather than freezing every concurrent SSE stream); the review's **second** suggestion — an `asyncio.wait_for` budget so a hostile nameserver cannot hold a threadpool **slot** either — was deliberately **not** taken, because adding a lookup budget is a new behaviour with its own failure mode (a legitimately slow resolver now fails) and D-32 fenced the fix round to defects. | Phase 190; next owner = the first plan that adds rate limiting or a connector queue | The first observed worker-occupancy incident traced to `/check`; **or** any plan that lifts D-32's rate-limit fence; **or** the check surface becoming reachable by a non-`org:manage` audience. | 2026-08-09 |
| **AR-190-11** | **ARG-1** — the SSE clause of T-190-06-T7 / T-190-09-T7 / T-190-16-T7 (**downgraded scope**) | T7's title is *"credential leak in an SSE **or** API response"*. **The API and DOM halves are driven** (a module-scope assert whose plant produced a collection error; an API JSON assertion; a rendered-markup sweep). **The SSE half is ARGUED**: frames are composed from the phase output, `_external_action_body` is the single composer, and the audit-receipt fence sweeps its payload at any depth — but **no test asserts over an emitted SSE frame**. Re-derived by this audit: grepping the 190 suites for an SSE assertion returns only substring matches inside the word *"assert"*, and `test_harness_engine.py:1505-1516` sweeps the **audit receipt**, not the phase output text. | Phase 190; next owner = the first plan touching the `external_action` SSE path | **The closing test is named and small:** one case that captures a real `phase_recorded_not_sent` / `phase_transition` frame from an engine run and sweeps it for the sentinel, **with a positive control**. Fires on: that test landing, or any change to `_external_action_failure_body` that begins interpolating a provider error into user-visible text. | 2026-08-09 |
| **AR-190-12** | `D-190-DEF-08` + the inherited second cycle | **A latent import cycle on the connector registry.** `import app.services.connectors.registry` in a cold interpreter raises `ImportError: cannot import name 'get_adapter' from partially initialized module`. **Unreachable today for exactly one MEASURED reason** — `phase_types.py` is its **only** module-scope importer — and guarded by a sole-importer tripwire strengthened at 190-15 to **classify** module-scope vs function-local rather than count. A **second**, inherited cycle exists (`models.connector → harness.grounding → harness/__init__ → phase_types → connector_service → models.connector`), verified present at HEAD **before** 190-15's first commit. `app.main` boots fine. Availability class only; no confidentiality or integrity consequence. | Phase 190 plan `190-15`; next owner = the first plan importing the registry elsewhere | ⚠ **The tripwire is line-sensitive by design and already moved once** — CR-02/CR-04 added imports above it, so `phase_types.py:94` became `:105`, and the fence firing on that move **is the fence working**: it asserts an exact list, and a list that tolerated drift would also tolerate a second importer arriving on a new line. Fires on: the Open Platform MCP client (SEED-013), a worker entry point, a management script, or `api/connectors.py` growing a capability list. | 2026-08-09 |
| **AR-190-13** | `D-190-DEF-16` | **`full-schema.sql` carries no ACLs**, because `regenerate-full-schema.sh` runs `pg_dump --no-privileges`. Migration 118's `COMMENT` survived regeneration; its `REVOKE`/`GRANT` did not — **a greenfield bootstrap would have silently re-shipped CR-01**. **Partially closed in the same commit:** the grant is mirrored into `scripts/full-schema-supplement.sql`, which the script appends verbatim, and the supplement's maintenance note now lists **ACLs** as a fourth thing `pg_dump` cannot carry. Re-derived by this audit: `grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql` → **4**, at `full-schema.sql:5995-5996, 6017`. **What is deferred is the general case: the mirroring is manual and UNFENCED.** | `D-190-DEF-16`; the recommended shape is a drift check in the exact form of `scripts/check-deploy-drift.sh` | **The next migration containing `GRANT` or `REVOKE`** — or the first greenfield/cloud deploy after which a privilege is observed missing. This is the same class of same-commit-sync obligation CLAUDE.md already fences twice (`Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md`; deploy artefacts) and deserves the same treatment. | 2026-08-09 |

*Accepted risks do not resurface in future audit runs.*

---

## Known operational gaps (recorded, not findings)

| Gap | Status |
|---|---|
| ⚠ **CLOUD PARITY IS OWED AND MIGRATION 118 IS SECURITY-BEARING.** The queue is migrations **099 → 118** plus `SECRETS_ENCRYPTION_KEY`. **Until 118 is applied to the cloud database, cloud has the CR-01 defect**: every authenticated member of an org can read every connector credential envelope in that org straight off PostgREST. Local is fixed; cloud is not. ⚠ **118 and the `connector_service.py` deploy must land in the SAME operation**, in either order but not separately — the code without the grant is harmless, but **the grant without the code breaks every connector read with a `42501`** (`SELECT *` on the user-JWT client). They are one change. | Known and recorded (CLAUDE.md standing rule; `190-REVIEW-FIXES.md` § Cloud parity; the migration's own header). Not a Phase 190 register gap. **This is the single most consequential operational item this phase leaves behind.** |
| **The mechanism ships; the run is owed.** Live DB: `connector_connections` → 0 rows; `live_connectors` absent from `feature_visibility`. **No send has ever occurred**, and no document in this phase claims one has — all twelve UAT rows read ⛔ with `BLOCK-190-UAT-01`, none dropped. | `AR-190-07`. Legitimate close-with-owed-rows, stated as a decision. |
| **ARG-3 — a CONTEXT/ROADMAP wording defect, not unshipped work.** D-18 says a failed send *"halts the run"*. **Measured FALSE against the shipped engine** (190-13): a `failure` flips the PHASE to `failed`, then the engine continues to the next phase and terminalizes the run — its own explicit, commented decision. **At-most-once IS shipped and grep-checked** (no retry, no backoff, no queue, no idempotency key). The fix is a wording reconciliation; changing the semantic would need a `harness_engine.py` edit that 190-13's acceptance forbids. | Recorded. No threat row covers phrasing; nothing security-bearing turns on it. |
| **The BLOCK-190-UAT-01 measurement is false in its first link** (verification gap 2): five definitions carry an `external_action` phase, one published, all predating the close — a **double-encoded jsonb string scalar** made the closing query blind. Two files to correct, plus the decoding query recorded alongside. | Verification's gap 2. G-3 `/gsd:fast` scope. Reflected correctly in `AR-190-07` above. |
| **`D-190-DEF-11` / `-12` / `-13`** — three frontend halves of review findings whose backend halves are fixed (nothing clears a stranded `connection_id` on a capability change; Save is not disabled for an incomplete connection; the canvas badge and panel footer disagree). **None is security-bearing:** WR-03's run half returns the shipped `recorded_not_sent` terminal rather than a stack trace (`phase_types.py:2292-2315`); WR-05's model half refuses empty fields (`models/connector.py:84,92,117-149,195-222`) and a 422 lands visibly in `saveRefusalFrom`. | Deferred with triggers. Whatever lands must re-verify the eight D-23/D-24 fences in its own commit. |
| **`D-190-DEF-04` / `-05` / `-06`** — pre-existing backend and frontend suite rot (211 backend failures; 26 frontend failures in 9 files), **verified unchanged against the recorded baseline** and containing **zero** failures naming a 190 file. | Pre-existing; outside this register. |

---

## Security Audit Trail

| Audit date | Threats total | Closed | Accepted | Open | Run by |
|---|---|---|---|---|---|
| 2026-08-09 | 115 (114 + `T-190-SC`) | 102 | 13 | **0** | gsd-security-auditor |

---

## Sign-Off

- [x] All 115 threats have a disposition (mitigate 108 · accept-family 7), and all 115 have a verdict
- [x] Every `mitigate` threat verified against **HEAD**, with a file:line read or a command run — **no SUMMARY claim accepted as evidence**
- [x] All fourteen of **D-28's minimum threat list** verified: each has a mitigation in code, a test that was **observed RED against a real plant**, and a green re-run by this audit
- [x] **The two latent defects this phase's own commit created are closed at their roots** — D-16 (`phase_types.py:2194`, observed RED then green in one commit) and D-14 (`connector_service.py:363,397`, the leak REPRODUCED before it was closed) — and D-16's **second door**, the resume sweep, is closed at two gates (`db/workflows.py:868,879`)
- [x] The **CR-01 family re-verified in both halves against the LIVE database** by this auditor's own `information_schema` / `pg_policies` queries — `authenticated` holds no SELECT on `secret_ciphertext`, `anon` holds nothing at all, 8 live-DB cases PASSED and did not skip
- [x] **CR-02 / CR-03 / CR-04 re-verified at HEAD**, each with its non-vacuity partner read
- [x] Fences confirmed **NON-VACUOUS**, not merely present — three were measured vacuous by the phase itself and repaired (the 189-armed golden-run fence, D-05's literal substrings, 190-14's docstring-satisfied SSTI assertion); `_project` was additionally checked for **REACH against a real postgrest builder**
- [x] `D-190-DEF-14` (WR-06) **dispositioned explicitly, not inherited** — and this audit found its consequence is larger than recorded (it gates `/check`, an **egress** surface) plus a second, unmeasured half (`UF-190-04`, no `ensure_settings_fresh`)
- [x] Six threats **downgraded from `mitigate` to accepted-risk by this audit** rather than closed on their declared wording (`AR-190-08`, `AR-190-11`)
- [x] Every accepted risk names an **owner** and a **concrete, observable re-open trigger** — including `AR-190-02`, whose originally-stated trigger was measured **unfirable** and replaced
- [x] Unregistered flags recorded (`UF-190-01` … `UF-190-04`) — all post-review or post-verification surface, none a blocker
- [x] Zero installs, zero surviving plants, eight fenced files with empty diffs — all **re-derived**, not quoted
- [x] `threats_open: 0` confirmed, and argued as an **honest** zero rather than asserted
- [x] **No implementation file was modified by this audit**
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-09
