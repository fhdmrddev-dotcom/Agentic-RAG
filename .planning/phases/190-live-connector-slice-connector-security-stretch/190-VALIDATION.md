---
phase: 190
slug: live-connector-slice-connector-security-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-08
---

# Phase 190 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `190-RESEARCH.md` § Validation Architecture (measured, not asserted).
> **Every number below carries the command that produced it. Re-measure before quoting —
> the project's standing rule is "don't inherit unmeasured claims", and this phase's own
> research measured SIX inherited claims FALSE.**

---

## Test Infrastructure

| Property | Value (measured 2026-08-08) |
|----------|-----------------------------|
| **Backend framework** | `pytest` — `backend/pytest.ini` → `testpaths = tests` |
| **Frontend framework** | `vitest` + jsdom — `frontend/vitest.config.ts`; `npm test` → `vitest run` |
| **Frontend count gate** | `node scripts/vitest-count-gate.cjs` — **2727 running / 2714 pinned / 0 failed / 48 files** (⚠ already drifted **+13**: `ExternalActionSection.test.tsx` pins 25 but runs 34) |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` → **33 errors (baseline)**. ⚠ Without `-p tsconfig.app.json` it checks **ZERO** files |
| **Quick run command (backend)** | `cd backend && python -m pytest tests/unit/test_190_egress.py tests/unit/test_190_connector_service.py -x -q` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/components/workflows/ConnectionPicker.test.tsx` |
| **Full suite command (backend)** | `cd backend && python -m pytest tests/ -q` |
| **Full suite command (frontend)** | `cd frontend && npm test` **then** `node scripts/vitest-count-gate.cjs` |
| **Estimated runtime** | quick ~15 s · backend full ~4 min · frontend full ~90 s |

**Measured pre-190 baselines to pin against:**

| Scope | Command | Measured |
|---|---|---|
| 189 unit surface | `pytest tests/unit/test_189_no_egress.py tests/unit/test_189_external_action_model.py tests/unit/test_audit_event_registration.py tests/unit/test_publish_service.py -q` | **67 passed** |
| Harness engine | `pytest tests/test_harness_engine.py -q` | **46 passed** |
| Typecheck | `npx tsc --noEmit -p tsconfig.app.json` | **33** |
| Count gate | `node scripts/vitest-count-gate.cjs` | **2727 / 2714 / 0 failed / 48 files** |

---

## Sampling Rate

- **After every task commit:** run the relevant quick command (backend or frontend)
- **After every plan wave:** run the full suite for the side(s) that wave touched
- **After ANY wave touching `frontend/src/components/workflows/`:** `npm test` **and** the count gate **and** `tsc -p tsconfig.app.json` — the count gate and `tsc` have two separate blast radii and neither implies the other
- **Before `/gsd:verify-work`:** both full suites green, count gate green, `tsc` at or below **33**
- **Before `/gsd:secure-phase`:** every row in the falsification set below observed **RED first**, plant restored md5-identical, `grep -c PLANT` → **0**
- **Max feedback latency:** ~15 s (quick) / ~4 min (full backend)

---

## Wave 0 Requirements — THE THREE RED TESTS, before any adapter exists

CONTEXT `<specifics>` is explicit: *"Both are latent defects that this phase's own commit
creates… Plan them into Wave 0, RED, before any adapter exists."* Research found a **third**
of the same shape (D-06).

| # | Test | Property | How it goes RED first |
|---|------|----------|------------------------|
| **W0-1** | `tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress` | **D-16** — publishing must not send | **ALREADY EXISTS AND ALREADY PASSES.** It goes RED on the commit that adds the send. Drive it RED, then land the `getattr(ctx, "is_golden_run", False)` gate in the **SAME commit** and drive it green. Do not route around it; do not pre-emptively gate. **The RED observation IS the evidence.** ⚠ Windows trap: build the loop *before* arming the sentinel — `asyncio.run`'s proactor self-pipe is itself a `socket.connect`. |
| **W0-2** | `tests/unit/test_190_cross_org_credential.py` | **D-14** — a definition in org A carrying a `connection_id` owned by org B must NOT resolve | Author the resolver **id-only** first (`SELECT … WHERE id = $1`), drive a real run, **observe the leak** (send succeeds using org B's credential), then land `WHERE id = $1 AND org_id = $2` and observe the refusal. An id-only `SELECT` passes every ordinary test — SEED-124/mig 110 and SEED-125/mig 112 are the two precedents. |
| **W0-3** | `tests/unit/test_190_egress_ordering.py` | **D-06** — the guard runs BEFORE credential resolution, unconditionally | Drive a send with **no credential bound at all**; assert the raised error is the **egress refusal**, not `MissingCredential`. RED-first by writing the resolver call *before* the guard call, observing the wrong error, then reordering. This is the n8n CVE class inverted into a test. |

**Wave 0 test files to create:**

- [ ] `backend/tests/unit/test_190_egress.py` — the §R14 corpus (**29 driven addresses**), scheme, host label-boundary (§R15), redirect, IP pin, size cap. Covers T1–T4, T11, T14.
- [ ] `backend/tests/unit/test_190_egress_ordering.py` — **W0-3** (D-06). RED first.
- [ ] `backend/tests/unit/test_190_cross_org_credential.py` — **W0-2** (D-14). RED first.
- [ ] `backend/tests/unit/test_190_connector_source_fence.py` — D-05, with a planted positive control.
- [ ] `backend/tests/unit/test_190_credentials.py` — D-11 fail-CLOSED at both write and read; T5–T7.
- [ ] `backend/tests/unit/test_190_smtp_header_injection.py` — T12, with its positive control.
- [ ] `backend/tests/unit/test_190_slack_ok_false.py` — **T13** (net-new threat).
- [ ] `frontend/src/components/workflows/ConnectionPicker.test.tsx` — **registered with `scripts/vitest-count-gate.cjs` in the SAME commit that creates it** (the shipped rule).
- [ ] Re-run of `ExternalActionSection.test.tsx`'s six purity fences **post-mount** (§M4).
- [ ] **No framework install needed** — pytest and vitest are both configured.

---

## The Security Falsification Set (D-28 + two net-new)

**Each row must be OBSERVED RED against a real plant in production source**, then the plant
restored md5-identical with `grep -c PLANT` → **0** (the shipped 189 idiom).

⚠ **The Phase-185 lesson binds: verify the PROPERTY (nothing reaches a non-public IP), not
the PATCH (this CIDR is blocked). A deny-list cannot be made fail-closed by extension.**

| # | Threat | STRIDE | Falsifying test | The plant that must turn it RED |
|---|--------|--------|-----------------|----------------------------------|
| T1 | SSRF via org-configured host | Tampering | drive `create_ticket` with `config.base_url = https://169.254.169.254/` → refusal naming the host | delete the `refuse_reason` call from the validator |
| T2 | DNS rebinding / TOCTOU | Tampering | resolver stub returns a public IP on call 1, `127.0.0.1` on call 2; assert the socket went to the **call-1** IP | replace `url.copy_with(host=ip)` with the hostname URL |
| T3 | Redirect-based bypass | Tampering | stub a 302 → `http://169.254.169.254/`; assert the client does **not** follow | flip `follow_redirects=True` |
| T4 | Cloud metadata endpoint | Info disclosure | the §R14 corpus: `169.254.169.254` + `::ffff:169.254.169.254` + `64:ff9b::a9fe:a9fe` | delete each `_unwrap` clause **individually** — **four separate RED observations** |
| T5 | Credential leak in logs | Info disclosure | drive a refusal and a failure; secret substring appears **zero** times in captured logs, **with a positive control proving the capture works** | log the resolved row instead of `row["id"]` |
| T6 | Credential leak in the definition JSONB | Info disclosure | after binding + publishing, `workflow_definitions.definition` contains `connection_id` and **no** secret/host/token key | write `config["smtp_password"]` in the picker |
| T7 | Credential leak in an SSE / API response | Info disclosure | `GET /connectors/connections` returns no `secret_ciphertext`; no `phase_*` SSE frame carries one | add `secret_ciphertext` to the response model |
| T8 | **Cross-org credential resolution (D-14)** | Elevation | **W0-2** | id-only `SELECT` |
| T9 | SSTI via a composed field | Tampering | a field containing `{{7*7}}` / `{{''.__class__}}` renders **literally**, not evaluated | swap `SandboxedEnvironment` for `Environment` |
| T10 | **Publish-time egress (D-16)** | Tampering | **W0-1** | remove the `is_golden_run` gate |
| T11 | Unbounded response / decompression | DoS | stub a 100 MB / gzip-bomb response; the read is capped and the phase fails cleanly | remove the size cap |
| T12 | **SMTP header injection** | Tampering | `subject = "Renewal\r\nBcc: attacker@evil.com"` → refusal (not 500, not a silent strip); **plus a positive control** proving a hand-built raw message *would* have produced a `Bcc:` line | replace `send_message(msg)` with `sendmail(f, t, raw)` |
| T13 | ⭐ **NEW — Slack `ok:false` read as success** | Repudiation | stub `200 {"ok":false,"error":"channel_not_found"}`; the phase lands **`failed`**, never `completed` | check only `resp.status_code` |
| T14 | ⭐ **NEW — host userinfo / homograph bypass** | Spoofing | `https://slack.com@evil.com/`, `https://slack.com.evil.com/`, `https://notslack.com/`, `https://xn--slck-hoa.com/` all refused | match against the raw URL string instead of `httpx.URL(u).host` |

**T13 and T14 are net-new findings from this phase's research and MUST be added to D-28's
minimum threat list at plan-phase.** T13 is the most likely way this phase ships a lie — it
is D-31's *"a phase reads Complete for a send that did not leave the app"* verbatim.

---

## Source Fences (empty-diff and zero-occurrence)

| Fence | Assertion | Positive control |
|-------|-----------|------------------|
| **D-05** | `backend/app/services/connectors/**` contains **zero** occurrences of `httpx.`, `requests.`, `smtplib.`, `urllib.request`, `socket.`, **and `.sendmail(`** | plant a direct `httpx.AsyncClient()` in a real adapter file, observe RED, restore md5-identical, `grep -c PLANT` → 0 |
| **D-23** | `git diff --numstat HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` reads **`0 0`** | self-evidencing |
| **D-24** | `git diff --numstat` reads **`0 0`** for `PhaseNode.tsx`, `PhaseNodeCard.tsx` and the six fenced card-subtree modules (`phaseNodeCardContract.ts`, `ownProperty.ts`, `NodeCornerMarks.tsx`, `NodeRunOverlay.tsx`, `NodeIconWell.tsx`) | self-evidencing |
| **§M4** | `ExternalActionSection.test.tsx`'s **six purity fences** still pass *after* the `ConnectionPicker` mount line lands | the fences already carry their own positive controls (`:398-412`) |
| **§M3** | `phaseVocabulary.ts` still has **zero** import statements after the D-24 line edit | plant `import x from "y"`, observe RED |
| **D-04** | the adapter registry's key set `==` `EXTERNAL_ACTION_CAPABILITIES` — a module-scope `assert`, **derived, never a re-typed list** | plant a 4th key, observe the `assert` fire at import |
| **RESIDUAL-190-01** | `"_host" not in inspect.getsource(smtplib.SMTP.connect)` **and** `"sni_hostname" in inspect.getsource(httpcore._async.connection)` | assert each pattern matches a planted literal |

**RESIDUAL-190-01 is a named residual risk, not a defect:** both DNS-pin recipes depend on
**non-public stdlib/httpcore attributes**. The fence exists so a library upgrade that removes
them fails loudly instead of silently un-pinning the connection. It belongs in SECURITY.md
with its own re-open trigger.

---

## Per-Task Verification Map

> Populated by `/gsd:plan-phase` once plans exist. Every task must map to an automated command
> or an explicit Wave-0 dependency; **no 3 consecutive tasks without an automated verify.**

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD at plan-phase* | — | 0 | CONN-03 | T10 / D-16 | publishing performs no egress | unit | `pytest tests/test_harness_engine.py -k golden_run_of_an_external_action -q` | ✅ exists | ⬜ pending |
| *TBD at plan-phase* | — | 0 | CONN-03 | T8 / D-14 | org A cannot resolve org B's connection | unit | `pytest tests/unit/test_190_cross_org_credential.py -q` | ❌ W0 | ⬜ pending |
| *TBD at plan-phase* | — | 0 | CONN-03 | D-06 | guard refuses before credential resolution | unit | `pytest tests/unit/test_190_egress_ordering.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## SC#10 — The 8-Row Cross-Provider Scoreboard

**The roster is DERIVED from `MODEL_CAPABILITIES`, never re-typed.** Measured 2026-08-08:

```
TOTAL model ids: 61   providers: 8
  anthropic n=7 · deepseek n=2 · google n=7 · minimax n=8
  moonshot n=3 · openai n=17 · openrouter n=9 · zhipu n=8
```

Exactly the eight providers CLAUDE.md's roster rule names. **Derive one representative per
provider at plan-time by grouping `MODEL_CAPABILITIES` — prefer the newest, and prefer a
registry-backed id.** An id absent from the registry resolves `capability_source=inferred`
and silently loses `emit_tier`, measuring a weaker configuration than the one that ships
(SEED-040 / SEED-135).

**What each row exercises:** a **published workflow containing an `external_action` step, run
end to end**, per provider. A connector step is not an LLM step — the row proves the
*surrounding run* is provider-correct while the step itself sends.

**The measured method (§M1) — ⚠ this INVERTS D-29's caution.** There is no workflow-run POST
route; a run launches through `POST /threads/{thread_id}/messages`, and `MessageCreate` carries
`model`, `provider` **and** `workflow_definition_id` on one request. **Per-request routing
WORKS — no global setting is mutated, so the operator's environment is untouched and rows
cannot contaminate each other.** Verdicts read from `workflow_runs` / `workflow_phases` /
`harness_audit`.

**The measured cost:** the per-thread anchor takes a **409 lock**
(`workflow_kickoff.py:146-173`), so **8 rows need 8 DISTINCT THREADS to run in parallel; two
rows on one thread are serial.** Stated here as a plan input, not a mid-UAT discovery.

| # | Provider | Representative model | Status |
|---|----------|----------------------|--------|
| 1 | openai | *derive at plan-time* | ⬜ |
| 2 | anthropic | *derive at plan-time* (native SDK) | ⬜ |
| 3 | google | *derive at plan-time* (historically highest-risk tool-call row) | ⬜ |
| 4 | deepseek | *derive at plan-time* (`strict_json_schema` inert — D-122-04) | ⬜ |
| 5 | zhipu | *derive at plan-time* | ⬜ |
| 6 | minimax | *derive at plan-time* | ⬜ |
| 7 | moonshot | *derive at plan-time* (the only `emit_tier: coerce` native rows) | ⬜ |
| 8 | openrouter | *derive at plan-time* (`native_tools: False` — the non-native tool path) | ⬜ |

**⛔ rows, never silent omissions.** Any provider with no key configured, or blocked by a known
defect, is recorded **⛔ with the reason and the blocking issue id** — never dropped. *A
scoreboard that lists only what passed is not a scoreboard.*

---

## The Other Three SC#10 Axes (CLAUDE.md UAT recipe)

| Axis | Required row | Status |
|------|--------------|--------|
| **Multi-tool** | a workflow with `retrieve` (KB) **+** `external_action` in one run | ⬜ |
| **Parallel-thread** | Thread A streaming a workflow run while Thread B accepts a new prompt (409-safe: different threads) | ⬜ |
| **Long-message** | ≥ 50 prior messages **or** a ≥ 5 KB prompt on a thread that then kicks off a connector workflow | ⬜ manual |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| **Row A — the send** | CONN-02 | Requires a real external destination; no automation can prove a message *arrived* | Publish a workflow with a bound `external_action` step → run → approve the armed checkpoint → confirm the email/ticket/message actually arrives | ⛔ **awaiting operator-provided destination (D-30)** |
| **Row B — the honest terminal** | CONN-02 / D-17 | Lived-experience read of the card word | The **same definition** with the connection **unbound** → run → the step reads *"Not sent — recorded"*, status `recorded_not_sent`, never *"Complete"* | ⬜ (no operator dependency — **runnable today**) |
| **Kill-switch both ways (G-4)** | CONN-03 / D-26 | Lived-experience toggle | Flip `live_connectors` **off** → an `external_action` step records and does not send, reading *"Not sent — recorded"*. Flip **on** → it sends. **Exercise BOTH directions** | ⬜ |
| **Settings → Connections at scale (sketch 155-C)** | CONN-02 | Visual/instrument-table read | With ≥ 6 connections across all three capabilities, the instrument table stays legible and the 🔒 endpoint footer is always visible | ⬜ |
| **Add-a-connection push/split panel (sketch 156-A)** | CONN-02 | Visual/interaction read | The two refusals sketch 156 promises are actually shown by the backend — **see Open Question 3: build the gates or delete the sentence** | ⬜ |
| **Long-message axis** | SC#10 | No automation for ≥ 50-message threads | per-provider, manual | ⬜ |

### D-30 — the blocking operator dependency, named now not at UAT

The three live-send rows require a **throwaway mailbox, a Jira project and a Slack channel**.
Until the operator supplies them each row is:

> ⛔ **awaiting operator-provided destination (D-30)** — the adapter is unit-proven against a
> stub; what is unproven is that a real message arrives.

**The phase may legitimately close with these owed** — but **as a DECISION, recorded in the
ROADMAP progress row and `STATE.md`, naming which row to run first.** Never as a claim that
everything ran.

**Recommended first row: `post_message` (Slack).** It needs only a bot token and a channel id,
its host is a code constant (smallest SSRF surface), and it is the one row that falsifies
**T13** — the likeliest shipped defect.

---

## The Demo Sentence — Both Halves Are UAT Rows

> *"a published workflow paused for approval, the operator approved, and an email actually
> arrived — and the same workflow, with the connection unbound, still says 'Not sent —
> recorded' rather than pretending."*

Row **A** is the send. Row **B** is `recorded_not_sent` on the **same definition** with the
connection unbound (D-17). **Row B is not optional** — it is the half competitors do not have,
and it is the only row that proves D-17's terminal survived the phase that made sending real.
Row B has **no operator dependency** and should be driven first, before Row A unblocks.

---

## G-6 — How We'd Know This Failed (from CONTEXT D-31)

Each of these is an observable condition, and each maps to a row above:

| Failure | Caught by |
|---|---|
| A send happens with **no** approval, or during a **publish** | W0-1 / T10 |
| A phase reads *"Complete"* for a send that did not leave the app | **T13** |
| A credential appears in the definition JSONB, an SSE frame, an API response, or a log line | T5 / T6 / T7 |
| Org B's workflow successfully sends using org A's connection | W0-2 / T8 |
| A request reaches `169.254.169.254`, `127.0.0.1`, or any RFC1918 address | T1 / T4 (29-address corpus) |
| The guard passes because a credential was **absent** (the n8n inversion) | W0-3 |
| A `PhaseFormPanel.tsx` / `PhaseNodeCard.tsx` diff is non-empty | D-23 / D-24 numstat fences |
| One email arrives twice from one run | D-18 at-most-once; manual Row A |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 9 files listed above)
- [ ] **All three W0 tests observed RED before their fix landed** — the RED observation is the evidence, not the green
- [ ] **All 14 falsification rows observed RED against a real plant**; plants restored md5-identical; `grep -c PLANT` → 0
- [ ] All 7 source fences green, each with its positive control driven
- [ ] SC#10 roster **derived** from `MODEL_CAPABILITIES` (not re-typed); every row PASS or ⛔-with-reason
- [ ] Owed manual rows recorded as a DECISION in ROADMAP + STATE.md, naming the first row to run
- [ ] No watch-mode flags
- [ ] Feedback latency < 15 s (quick) / < 4 min (full backend)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
