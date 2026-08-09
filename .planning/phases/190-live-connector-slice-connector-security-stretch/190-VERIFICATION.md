---
phase: 190-live-connector-slice-connector-security-stretch
verified: 2026-08-09T09:20:00Z
status: gaps_found
score: 3/5 success criteria verified
overrides_applied: 0
base_commit: de122b9a
gaps:
  - truth: "SC#5b — the phase carries a verified SECURITY.md (`threats_open: 0`)"
    status: failed
    reason: >-
      No `190-SECURITY.md` exists. Every sibling phase from 184 onward carries one
      (`184-SECURITY.md` … `189-SECURITY.md`); 190 — the only phase in the milestone whose
      requirement text names the gate in as many words — does not. This is the one failed
      criterion that is NOT blocked on an operator dependency: `/gsd:secure-phase 190` can
      run today against shipped, driven code.
    artifacts:
      - path: ".planning/phases/190-live-connector-slice-connector-security-stretch/190-SECURITY.md"
        issue: "Does not exist. `find .planning/phases -name '*SECURITY*'` returns 184-189 and stops."
    missing:
      - "Run `/gsd:secure-phase 190` and land a SECURITY.md with `threats_open: 0`."
      - "Its register must disposition the residuals `190-VALIDATION.md` § Residuals collects, plus the two surfaces no plan's threat model covers."
  - truth: "BLOCK-190-UAT-01's stated blocking chain is measurably wrong in its first link"
    status: failed
    reason: >-
      `190-VALIDATION.md:405-409` and `190-19-SUMMARY.md:174-176` both record
      `published defs containing an external_action phase -> 0` and
      `ANY def (any status) containing one -> (no rows)`, presented as "MEASURED at close
      rather than assumed". Both are FALSE and were false when written. Five workflow
      definitions carry an `external_action` phase, one of them PUBLISHED
      (`ff3c6ca3-0c4a-4f27-83d2-3b65f4561a09` "Weekly Status Report", published
      2026-08-08 05:35 UTC, phase slug `act`, capability `send_email`, `connection_id: null`);
      the other four are drafts created 2026-06-14, 2026-07-10, 2026-07-27 and 2026-08-08
      05:33. All five predate the close. Root cause is the query shape, not the data:
      `workflow_definitions.definition` is a jsonb column holding a JSON **string scalar**
      (double-encoded), so `definition->'phases'` silently yields zero rows —
      `jsonb_object_keys(definition)` on that row errors with `cannot call
      jsonb_object_keys on a scalar`. The correct query decodes first
      (`((definition #>> '{}')::jsonb)->'phases'`) and returns 5.
    artifacts:
      - path: ".planning/phases/190-live-connector-slice-connector-security-stretch/190-VALIDATION.md"
        issue: "§ BLOCK-190-UAT-01 states a three-link blocking chain; link (1) already exists. The block is two links, not three."
      - path: ".planning/REQUIREMENTS.md"
        issue: "Line 155-157 repeats the false measurement as the CONN-02 closing rationale."
    missing:
      - "Correct both records to the measured figures, with the decoding query alongside them."
      - "State the block as TWO links (a bound connection row · `live_connectors` ON), not three."
      - "Note that a Slack `post_message` first row still needs a new authored+published definition — the existing published one is `send_email`."
deferred: []
human_verification:
  - test: "The three live-send rows in `190-VALIDATION.md` § Manual-Only Verifications — Slack `post_message` first, then JIRA `create_ticket`, then `send_email`."
    expected: "A message/ticket/email actually leaves the application and arrives at an operator-provided destination; the phase step reads `completed` from the adapter's OWN verdict, and `harness_audit` carries an `external_action_sent` receipt naming capability + connection id + host and nothing else."
    why_human: "Needs operator-provided destinations (D-30) — a Slack workspace + bot token, a JIRA site + API token, and (measured, not assumed) a PUBLICLY-ROUTABLE SMTP host with TLS, because `egress.py` correctly refuses the local `supabase_inbucket` loopback plaintext catch-all. It also needs `PUT /admin/visibility` to set `live_connectors` to `everyone` — a global setting change in the operator's live environment, with no Control Room card to do it from (`D-190-DEF-09`)."
  - test: "The eight-row SC#10 cross-provider scoreboard (openai · anthropic · google · deepseek · zhipu · minimax · moonshot · openrouter)."
    expected: "Each row drives a published workflow containing an `external_action` step end to end; verdicts read from `workflow_runs` / `workflow_phases` / `harness_audit`."
    why_human: "Same operator dependency (`BLOCK-190-UAT-01`). All eight are currently recorded ⛔ with the blocking id — correctly present rather than dropped."
  - test: "Kill-switch lived read — flip `live_connectors` OFF mid-flight on a two-worker box and confirm a run scheduled on the non-writing worker records rather than sends."
    expected: "`ensure_settings_fresh()` bounds the staleness; the step returns `recorded_not_sent` / \"Not sent — recorded\"."
    why_human: "CR-02's fix is asserted by call-order unit drive only. The real property is multi-worker cache behaviour under a live flip."
  - test: "The three visual rows and the long-message axis in § Manual-Only Verifications."
    expected: "As authored in 190-VALIDATION.md."
    why_human: "Visual appearance and lived-experience scenarios (G-4); jsdom paints nothing."
---

# Phase 190: Live Connector Slice + Connector Security — Verification Report

**Phase Goal:** A user can run 2-3 first-party live connectors from a workflow (email out, JIRA/ticket create, Slack notify), with every outbound secured against SSRF, credential leakage, and cross-tenant bleed (operator HARD gate #3, live-proof half).

**Verified:** 2026-08-09
**Status:** `gaps_found`
**Re-verification:** No — initial verification
**Diff verified:** `de122b9a..HEAD` — 62 files, 23,140 insertions

---

## Headline

**The security half of this phase is real and it survived independent adversarial reading. The live-proof half did not happen, and the phase says so.**

Three of five success criteria are VERIFIED against the codebase and the live database by commands I ran myself. The two that are not resolve very differently, and collapsing them into one verdict would be the exact failure this phase spent nineteen plans avoiding:

- **SC#1 is owed, not broken.** The mechanism is whole and I checked every layer of it; the demo requires operator-provided destinations and a global switch flip. That is a legitimate close-with-owed-rows, and it is recorded as one (`190-VALIDATION.md` frontmatter reads `status: closed-with-owed-rows`; CONN-02/CONN-03 are `Pending` in REQUIREMENTS.md with the reason stated rather than the box silently unticked).
- **SC#5 is half owed and half simply not done.** The cross-org credential-leak test exists, is non-vacuous and passes. The `threats_open: 0` SECURITY.md does not exist, and *nothing about the operator blocks it*. Every sibling phase 184-189 carries one. That is a genuine, actionable gap.

I also falsified one of the phase's own closing measurements. It does not change any criterion's verdict, but it is recorded as a gap because it is wrong in the place this phase claims to be strongest, and because it changes what the operator has to do next.

**G-7 note:** `node scripts/check-gap-closure-rounds.cjs 190` → *G-7 clear — no gap-closure plans in this phase* (19 plans, 0 gap-closure). Neither gap below routes to `/gsd:plan-phase --gaps`. SC#5b routes to **`/gsd:secure-phase 190`**; the measurement correction is a two-file documentation edit (G-3 `/gsd:fast` territory).

---

## Goal Achievement — per Success Criterion

| # | Success Criterion | Status | Evidence I checked myself |
|---|---|---|---|
| 1 | A user can **run** 2-3 first-party live connectors from a workflow (email · JIRA · Slack) — the demo-able external-integration proof | ✗ **FAILED — owed on an operator dependency, not broken** | Mechanism verified end to end (below). Live DB `127.0.0.1:54322`: `connector_connections` → **0 rows**; `app_settings.feature_visibility` → `{skill_studio, model_management, governance_health, workflow_authoring, visual_workflow_canvas}` — `live_connectors` **absent** ⇒ cold default off. **No send has ever occurred.** |
| 2 | Every connector outbound passes an **unconditional** SSRF / egress allow-list guard **regardless of credential state** | ✓ **VERIFIED** | Both socket-opening binders validate as their FIRST statement, credential-blind: `egress.py:566` (`send_pinned_http`) and `egress.py:748` (`open_pinned_smtp`). No adapter can open a socket another way — `grep -rn "import httpx\|import smtplib\|AsyncClient\|SMTP(" backend/app/services/connectors/` → **0 hits**, machine-fenced with positive controls. |
| 3 | The "authenticated ≠ safe" RCE class is closed — all expression/template evaluation sandboxed, NO arbitrary-code node on the business canvas | ✓ **VERIFIED (proved, not built — correctly claimed as such)** | `grep -rnE "\beval\(\|\bexec\(\|\bcompile\(\|__import__\|Template\(\|Environment\("` over `connectors/`, `egress.py`, `phase_types.py`, `api/connectors.py`, `connector_service.py` → **1 hit, a docstring**. Only two `Environment(` constructions in the whole backend, both `SandboxedEnvironment(autoescape=True)`. No `code` phase type in the `PhaseConfig` union. |
| 4 | Connector credentials are org-scoped, Fernet-encrypted (`enc:v1:` reuse), resolved server-side by reference — never in the definition JSONB or the client | ✓ **VERIFIED (code half AND live DB half)** | Live DB: `secret_ciphertext` grants for `authenticated` are **INSERT, UPDATE only — no SELECT**; `anon` holds **nothing at all** on the table. Code half: `_SELECTABLE_COLUMNS` derived from `ConnectorConnectionResponse`, named on all three user-JWT reads and pinned onto every representation write via `_project()`. |
| 5 | A dedicated cross-org credential-leak test passes; the phase carries a verified SECURITY.md (`threats_open: 0`); broad catalog / inbound webhooks / public API explicitly NOT built | ⚠ **PARTIAL → FAILED** | Leak test ✓ (ran it — 3 tests, non-vacuous). Exclusions ✓ (`grep -rni "\bmcp\b" backend/app --include=*.py` → **0**; no webhook/inbound route). **SECURITY.md ✗ — the file does not exist.** |

**Score: 3/5 verified.**

---

## SC#1 — the mechanism is whole; the run is owed

Verified present, substantive and wired at every layer:

| Layer | Artifact | Evidence |
|---|---|---|
| Adapters ×3 | `smtp_adapter.py` 482 L · `jira_adapter.py` 631 L · `slack_adapter.py` 561 L | Real vendor calls through the binders. Slack's verdict requires HTTP 200 **and** `ok: true`; JIRA's requires 2xx **and** no error envelope **and** an issue KEY — not a shared response checker. |
| Seam | `connectors/registry.py` | Closed capability→module map, key set `assert`-derived from `EXTERNAL_ACTION_CAPABILITIES` at import; `_load_adapter` cross-checks the adapter's own `CAPABILITY` against its registry key. A fourth key aborts the pytest session at collection. |
| Executor | `phase_types.py:2186-2340` | Six ordered gates, present and readable: golden-run · kill-switch · egress · unbound · org-scoped resolve · dispatch. |
| API | `api/connectors.py` (571 L) | 6 routes; `main.py:732` includes the router. |
| Settings UI | `ConnectionsTab.tsx` (991 L) + `ConnectionFormPanel.tsx` (1582 L) | Mounted at `SettingsPage.tsx:1418`. |
| Canvas bind | `ConnectionPicker.tsx` (384 L) | Rendered at `ExternalActionSection.tsx:223`. |
| Client data flow | `lib/api.ts:5634-5800` | Six real `fetch` calls against `/connectors/connections*` — not stubs. |
| Schema | migrations 116 · 117 · 118 | All three confirmed APPLIED on the live DB (table exists; `harness_audit` CHECK carries `external_action_sent`; 118's grants measured). |

**What is missing is the run.** Three links were claimed to be missing; **two actually are**:

1. ~~a published definition containing an `external_action` step~~ — **this already exists** (see the gap below).
2. a bound `connector_connections` row — **0 rows**, confirmed.
3. `live_connectors` turned ON — **absent from `feature_visibility`**, confirmed. Settable only via `PUT /admin/visibility` (`admin.py:113` allow-lists it); no Control Room card (`D-190-DEF-09`).

This is a legitimate operator dependency and it is honestly recorded. I found **no** place where a live send is claimed to have happened: all 8 SC#10 provider rows and the live-send rows read ⛔ with the blocking id `BLOCK-190-UAT-01`, none dropped.

---

## SC#2 — judged, not split

**The criterion is met.** The stated judgement, either way as asked:

The criterion's subject is *"every connector **outbound**"*. An outbound is a socket, and this phase has exactly two socket-opening functions. Both call `validate_destination` as their first executable statement, and `validate_destination` reads no credential in any form — its parameters are `(capability, url/host, port, allowed_host, resolver)`. The n8n inversion (`#28218`: *"protection activates conditionally based on credential presence"*) therefore cannot occur: there is no branch on credential presence anywhere upstream of either binder.

That property is machine-fenced rather than asserted. `test_190_connector_source_fence.py::test_no_connector_module_names_a_transport` walks `connectors/**` for transport construction in any spelling, carries `test_the_banned_token_matcher_actually_matches` (all six contract tokens fire) and `test_the_walk_is_not_vacuous` (the walk reaches its roots), and was driven RED against a real planted `httpx.AsyncClient()` carrying no import. I re-derived the property independently by grep: zero transport imports or constructions under `connectors/`.

**WR-01 is real and it is not this criterion.** `_pre_credential_destination` (`phase_types.py:1948`) returns `None` for `create_ticket` and `send_email` because `ExternalActionPhaseConfig` is `extra='forbid'` and carries no `base_url`, so GATE 3 is a no-op for two of three capabilities on the shipped path. That costs the *executor-level defence-in-depth ordering* D-06 wanted — not the guard. No outbound reaches a socket unvalidated, which I confirmed at the binders rather than inferring from the review. The review itself graded it Warning for exactly this reason, the deferral (`D-190-DEF-10`) names the binder-level drive that is currently asserted nowhere, and VALIDATION's score was corrected downward ("Six of eight fully driven" → **"Five of eight"**, `190-VALIDATION.md:596`) — a score that moved the honest direction.

**One thing the fixer chose not to do, and I agree with recording it rather than accepting it silently.** The executor docblock at `phase_types.py:2113-2115` still states the property as an absolute — *"a send with no credential bound at all raises the EGRESS REFUSAL rather than a missing-credential error"* — which is false for two of three capabilities. The fix report argues that correcting the prose beside a fence that still cannot see the production path would "document the gap rather than close it". That is a defensible call, but the sentence a future reader meets is currently wrong. It is bounded inside `D-190-DEF-10`, which requires both halves in one commit; I am flagging it, not re-opening it.

---

## SC#3 — proved, not built (and that is the honest claim)

`190-14` says this criterion was satisfied by **not adding an evaluator**, and I verified that independently rather than taking it:

- No evaluator on the connector path — my own grep across `connectors/`, `egress.py`, `phase_types.py`, `api/connectors.py`, `connector_service.py` for `eval(` / `exec(` / `compile(` / `__import__` / `Template(` / `Environment(` returns exactly one hit, and it is prose inside a docstring at `phase_types.py:1997`.
- `_adapter_args` is a closed two-column projection; `_BODY_ARG_FOR_CAPABILITY` is a three-key dict with a module-scope `assert` against the closed capability set. There is no syntax, no interpolation, no `{{ }}`.
- The only two Jinja environments in the entire backend — `template_render_service.py:657` and `tool_dispatcher.py:2473` — are both `SandboxedEnvironment(autoescape=True)`. Neither was written by 190; the phase asserts they have not moved, which is the correct scope of the claim.
- No arbitrary-code node exists on the canvas. The `PhaseConfig` union has seven members; the nearest candidate, `ProgrammaticPhaseConfig`, takes `fn: str` — a `PROGRAMMATIC_PHASE_REGISTRY` **key**, not code.

`test_190_ssti_fence.py` additionally drives `{{7*7}}` through the real executor and asserts it reaches the adapter as five literal characters. Ran it: green.

---

## SC#4 — verified in code AND against the live database

CR-01 was real: as originally shipped, `secret_ciphertext` was readable over PostgREST by any authenticated org member. I confirmed the closure independently rather than accepting the fix report.

**Live DB, `information_schema.column_privileges` for `connector_connections.secret_ciphertext`:**

```
authenticated : INSERT, UPDATE          <- NO SELECT
service_role  : SELECT, INSERT, UPDATE, REFERENCES
postgres      : SELECT, INSERT, UPDATE, REFERENCES
anon          : (nothing)
```

`anon` holds nothing on the table at all — the fix went one step past the review, which named only `authenticated`.

**The code half, which the review correctly said the migration forces:** because Postgres expands `SELECT *` to every column and PostgREST's default projection is `select=*`, every user-JWT query had to name its columns. `_SELECTABLE_COLUMNS` (`connector_service.py:139`) is `",".join(_RESPONSE_KEYS)` — **derived from `ConnectorConnectionResponse`, never retyped** — and is applied at `:525`, `:552`, `:583` and through `_project()` on every representation write. The single `select("*")` that remains (`_fetch_connection_row`, `:304`) runs on the service-role client, is the only caller that needs the ciphertext, and is `WHERE id = $1 AND org_id = $2` with no default on `org_id`.

**Never in the definition JSONB:** `ExternalActionPhaseConfig.connection_id: str | None` is the only field added (`models/harness.py:277`) — an id, not a host, token, channel or address. I confirmed against the live data: all five stored `external_action` phases carry `connection_id: null`.

**Greenfield parity, which nobody asked for and which would have silently re-shipped CR-01:** `pg_dump --no-privileges` drops ACLs, so migration 118 was invisible to a `full-schema.sql` bootstrap. `grep -c '^GRANT\|^REVOKE' supabase/full-schema.sql` → **4**, and lines 5995-6017 carry 118's REVOKE/GRANT verbatim. Confirmed.

---

## SC#5 — one half verified, one half simply absent

**The cross-org credential-leak test — VERIFIED.** `test_190_cross_org_credential.py`, 3 cases, ran green. It is non-vacuous by construction: the same id resolves for its owning org (so the refusal is the *scope*, not an unconditional raise), the fetch is asserted to have been called **with org A** (so a resolver that raised for an unrelated reason cannot pass), and the message is asserted to carry neither the ciphertext nor the `enc:v1:` prefix nor any of `forbidden` / `not permitted` / `403` / `belongs to` — a cross-org id must read as ABSENT, not as an existence oracle.

**The SECURITY.md — FAILED.**

```
$ find .planning/phases -name "*SECURITY*"
184-SECURITY.md  185-SECURITY.md  186-SECURITY.md  187-SECURITY.md
188-SECURITY.md  188.1-SECURITY.md  188.2-SECURITY.md  189-SECURITY.md
```

190 is absent. Every phase since 184 carries one; the phase whose requirement text names the gate *in as many words* — *"mandatory `/gsd:secure-phase` (`threats_open: 0`)"* — does not. REQUIREMENTS.md states this plainly and refuses to mark CONN-03 complete because of it, which is the right call. But an accurately-recorded absence is still an absence: this is the one failed criterion with **no operator dependency at all**, over code that is shipped, driven and reviewed.

**The exclusions — VERIFIED.** `grep -rni "\bmcp\b" backend/app --include=*.py` → **0**. No inbound webhook route, no public API surface. The SC#1 amendment (first-party adapters behind an MCP-shaped seam, recorded as `D-v3.6-02` with a re-open trigger) is a documented ROADMAP amendment with a structural reason, not a quiet descope — and its own stated basis (zero MCP code) re-measures true.

---

## The measurement I falsified

`190-VALIDATION.md` § BLOCK-190-UAT-01 and `190-19-SUMMARY.md:174-176` both record, under the heading *"MEASURED at close rather than assumed"*:

```
published defs containing an external_action phase        -> 0
ANY def (any status) containing an external_action phase  -> (no rows)
```

Both are false, and were false when written.

```sql
select d.id, d.name, d.status, d.created_at,
       p->'config'->>'capability', p->'config'->>'connection_id'
from workflow_definitions d,
     lateral jsonb_array_elements(((d.definition #>> '{}')::jsonb)->'phases') p
where p->'config'->>'phase_type' = 'external_action'
order by d.created_at;
```

→ **5 rows**, one of them **published**:

| id | name | status | created |
|---|---|---|---|
| `99c58806…` | Doc Q&A (098 UAT — Weekly reports scoped) | draft | 2026-06-14 |
| `09ac8f3a…` | KB Cited Answer (3–5 Bullets) | draft | 2026-07-10 |
| `207fdd0f…` | Compliance Gap Report | draft | 2026-07-27 |
| `fdc29e13…` | Answer a weekly-reports question and email the requester | draft | 2026-08-08 05:33 |
| **`ff3c6ca3…`** | **Weekly Status Report** | **published** | **2026-08-08 05:35** |

All five predate the close (2026-08-09). All carry `capability: send_email`, `connection_id: null`.

**The root cause is the query shape, not the data.** `workflow_definitions.definition` is a jsonb column holding a **JSON string scalar** — the document is double-encoded. `jsonb_object_keys(definition)` on any row errors with `cannot call jsonb_object_keys on a scalar`, and any `definition->'phases'` path expression silently returns zero rows rather than failing. A close measurement written in the obvious shape reads "(no rows)" and means "my query cannot see this column", which is indistinguishable from absence unless you check.

**Why it is recorded as a gap and not shrugged off.** It does not change SC#1's verdict — nothing was sent, 0 connections exist, the switch is off. But it is wrong in the exact place this phase's declared discipline is strongest, it is repeated verbatim into `REQUIREMENTS.md:155-157` as the closing rationale for CONN-02, and it has a practical consequence: the blocking chain is **two links, not three**. The operator does not need to author and publish an `external_action` workflow for a `send_email` row — one is already published. (A Slack `post_message` first row, which VALIDATION recommends because it falsifies T13, does still need a new definition.)

---

## Anti-Patterns Found

| Scope | Pattern | Result |
|---|---|---|
| All 62 files in `de122b9a..HEAD` | `TBD` / `FIXME` / `XXX` / `HACK` | **0 hits** — debt-marker gate clean |
| Same | `TODO` | **0 hits** |
| `connectors/**` | transport construction in any spelling | **0 hits** (also machine-fenced) |
| `backend/app/**` | MCP client | **0 hits** |

No blockers, no warnings.

---

## Behavioral Spot-Checks (run by me, this session)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full 190 backend surface | `pytest tests/unit/test_190_*.py tests/unit/test_189_no_egress.py tests/test_harness_engine.py tests/integration/test_190_secret_column_privilege.py -q -p no:randomly` | **314 passed** in 6.31 s | ✓ PASS |
| Security core (SSTI · cross-org · egress · ordering) | `pytest tests/unit/test_190_ssti_fence.py tests/unit/test_190_cross_org_credential.py tests/unit/test_190_egress.py tests/unit/test_190_egress_ordering.py -q` | **96 passed** | ✓ PASS |
| CR-01 live-DB privilege gate | included above (`test_190_secret_column_privilege.py`, 8 tests, hits real Postgres) | passed | ✓ PASS |
| Connector frontend | `npx vitest run ConnectionPicker.test.tsx ConnectionsTab.test.tsx ConnectionFormPanel.test.tsx` | **119 passed / 3 files** | ✓ PASS |
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33 errors** — exactly the recorded baseline, unmoved | ✓ PASS |
| Frontend count gate | `node scripts/vitest-count-gate.cjs` | `count gate OK` — 2851 running / 2838 pinned / **0 failed** / 51-51 files, drift **+13** | ✓ PASS |
| G-7 round cap | `node scripts/check-gap-closure-rounds.cjs 190` | `G-7 clear` — 19 plans, 0 gap-closure | ✓ PASS |
| Migrations applied | live DB: table `connector_connections`; `harness_audit` CHECK contains `external_action_sent`; 118 grants | 116 · 117 · 118 all present | ✓ PASS |

Every self-reported figure I re-derived matched — 314, 33, 2851/2838/+13, the `full-schema.sql` ACL count of 4 — with the single exception of the definitions measurement above.

---

## Open write-surface finding `D-190-DEF-14` (WR-06) — judged

**Verified as described, and judged ACCEPTABLE at phase close.**

`dependencies.py:542-543` returns unconditionally for an operator *before* reading the audience, so `require_visible("live_connectors")` is a no-op for operators and the connector CRUD surface stays reachable by curl while the switch is off. I confirmed both halves:

- the write surface is genuinely open to an operator with the switch off — the short-circuit is the first statement in `_dep`;
- **it cannot cause a send.** The send-path gate is a *separate* read, `feature_audience(_LIVE_CONNECTORS_FEATURE) != "everyone"` at `phase_types.py:2228`, which has no operator short-circuit and is a positive test (fail-closed against a hand-edited row and against any fifth audience — the Phase 185 lesson applied). With `live_connectors` absent from `feature_visibility`, every step records and sends nothing.

The privilege leak is therefore nil in substance: the only actor who can bypass the switch is the actor who can flip the switch. `require_visible` is shared by four other governed features, so narrowing it is a cross-feature change that belongs to a plan, not a fix round. Accepting it here is right.

---

## Requirements Coverage

| Requirement | Status in REQUIREMENTS.md | My verdict |
|---|---|---|
| **CONN-02** | Pending — "MECHANISM SHIPPED, LIVE PROOF OWED" | **Concur.** Mechanism verified at every layer; zero sends. The stated rationale contains the falsified definitions measurement (gap 2), but the conclusion stands. |
| **CONN-03** | Pending — "EVERY SECURITY CLAUSE SHIPPED AND DRIVEN; the requirement's OWN mandatory gate has not run" | **Concur, and this is the correct call.** SC#2/#3/#4 and SC#5's leak test all verified independently. `/gsd:secure-phase 190` is the named closing condition and it has not run. |

No orphaned requirements: `grep -E "Phase 190" .planning/REQUIREMENTS.md` maps CONN-02 and CONN-03 only, both claimed by this phase's plans.

---

## Gaps Summary

Two gaps, neither of which is a gap-closure round.

**1 — SECURITY.md is missing (`/gsd:secure-phase 190`).** The single failed criterion with no operator dependency. Every sibling phase 184-189 carries one; the phase whose requirement names the gate verbatim does not. The register it must disposition is already collected in `190-VALIDATION.md` § Residuals, including two surfaces no plan's threat model covered. **This is the recommended next action** — it can run today against shipped, driven, reviewed code, and it is CONN-03's own stated closing condition.

**2 — the BLOCK-190-UAT-01 measurement is false in its first link.** Five definitions carry an `external_action` phase, one published, all predating the close; a double-encoded jsonb column made the closing query blind. Two files to correct (`190-VALIDATION.md`, `REQUIREMENTS.md`), plus the decoding query recorded alongside so the next person does not repeat it. G-3 `/gsd:fast` scope.

**What is NOT a gap:** the twelve ⛔ UAT rows. They are blocked on operator-provided destinations — a Slack workspace + token, a JIRA site + token, and a publicly-routable TLS SMTP host — plus a global switch flip. That block was investigated properly (the local `supabase_inbucket` catch-all was refuted twice, and `egress.py`'s refusal of a loopback plaintext destination is the guard working, not a defect). Closing with those rows owed is a legitimate decision, it is recorded as a decision in three places, and it names which row to run first. **Every criterion that can be met without the operator's destinations is met — except the SECURITY.md, which is not blocked by the operator at all.**

**Cloud parity owed (carried forward):** migrations `099 → 118`, and **118 is security-bearing**.

---

_Verified: 2026-08-09_
_Verifier: Claude (gsd-verifier) — goal-backward, adversarial stance_
