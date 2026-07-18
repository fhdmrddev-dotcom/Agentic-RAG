---
phase: 147
slug: operator-control-plane
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-11
---

# Phase 147 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified against the COMMITTED implementation at HEAD (post code-review; CR-01/CR-02 fixed).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → PUT /admin/flags | Untrusted JWT names a boolean flag to flip on a service-role backend (NO RLS backstop); the key would reach a dynamic SQL SET clause | Flag key + bool → app_settings column write |
| operator → any user's run | Operator Kill drops the ownership filter to cancel a stranger's run | run_id → cancel/zombie-heal on a cross-user run |
| cross-user run metadata → operator UI | The Control Plane lists every user's active run | user/model/kind/elapsed (metadata only — never thread content) |
| operator action → victim's chat | The killed user must not learn WHO killed them or WHY | Cancel terminal state only (attribution stays in operator_audit_log) |
| capability kill-switch → in-flight tool call | A disabled capability must fail closed at BOTH schema and dispatch, across all providers | flag read → hide/refuse decision |
| maintenance flag → every mutating request | A platform-wide write-block that must never trap its own off-switch or block the SSE hot path | maintenance bool → 503 / passthrough |
| public /health → end-user banner | Non-operators (404 on /admin) need a public maintenance signal without leaking other settings | maintenance boolean only |
| client-supplied audit event → operator_audit_log | A free-text action/label would let a client forge ledger rows | Pydantic Literal enum → server-owned (label, action) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified in code at HEAD) | Status |
|-----------|----------|-----------|-------------|----------------------------------------|--------|
| T-147-01 | Tampering (SQLi) | save_app_settings column write + PUT /admin/flags key→SQL | mitigate | Code-constant column allowlist `_DIRECT_COLUMNS` incl. the 3 flags (`main.py:98-111`); values parameterized `$N`, only column names (from code constants) interpolated (`user_settings.py:294-307`); PUT /admin/flags rejects any key ∉ `_FLAG_KEYS` with 422 BEFORE `save_app_settings` (`admin.py:65,443-447`) | closed |
| T-147-02 | Denial of Service | flag read on DB blip | mitigate | Last-known-good TTL cache — `_load_settings_from_db` never resets `_settings_cache` on a read exception (`user_settings.py:242-250`); helpers read that stale cache (`user_settings.py:695-733`); proven by `test_transient_db_failure_returns_last_known_good` (`test_147_flag_failure_semantics.py:106-143`) | closed |
| T-147-COLD | DoS (self-inflicted) | cold-cache polarity | mitigate | `maintenance_mode()` cold/exception → False (`user_settings.py:721-733`); `self_improve_enabled()`/`workflows_enabled()` cold/exception → True (`user_settings.py:695-718`); row defaults mirror polarity (`user_settings.py:538-540`); asserted (`test_147_flag_failure_semantics.py:75-101`) | closed |
| T-147-03 | Elevation of Privilege | GET /admin/runs, /backpressure, /control-plane/record | mitigate | Router-level gate `APIRouter(dependencies=[Depends(require_operator)])` (`admin.py:68-72`); all three are `@router.*` on that router (`admin.py:75,180,498`); never a new ungated router | closed |
| T-147-04 | Information Disclosure | run existence to non-operators | mitigate | Byte-identical `_NOT_FOUND` 404 at the gate incl. absent/invalid JWT fold (`dependencies.py:125,189-197,216`); a missing run id in the operator SELECT (no user filter) still 404s (`admin.py:352-363`) | closed |
| T-147-05 | Information Disclosure (privacy) | cross-user run cards | mitigate | `/admin/runs` returns metadata only — user_email/model/provider/kind/elapsed, no thread content (`admin.py:307-318`, linkage-rule comment `admin.py:193-195`); `ActiveRunsSection` renders only those fields, no drill-in (`ActiveRunsSection.tsx:196-230`) | closed |
| T-147-06 | Elevation of Privilege | operator kill skips ownership SELECT | mitigate | Ownership skip lives ONLY in `kill_run` behind `require_operator` (`admin.py:346-357`); `_cancel_run_internals` makes NO ownership decision (docstring + body `run_lifecycle.py:158-189`); owner path keeps its `.eq(user_id)` Step 1 then delegates (`runs.py:1105-1136`); non-operator → 404 | closed |
| T-147-07 | Information Disclosure (privacy) | operator attribution in victim chat | mitigate | who/why written ONLY to `operator_audit_log` via `request.state.audit_*` (`admin.py:409-415`); victim run finalizes to ordinary `cancelled`/`cancelled_by_user`, nothing operator-identifying passed (`admin.py:395-407`, `run_lifecycle.py:234-242`); MessageItem renders no operator field (grep clean — only unrelated CONTEXT.md comments) | closed |
| T-147-08 | Tampering / double-effect | double-cancel side effects | mitigate | Idempotent-terminal `terminal_noop` (no UPDATE/Redis touch) (`run_lifecycle.py:193-194`); SETNX cancel-lock gates the synthetic sentinel so concurrent cancels emit once (`run_lifecycle.py:265-283`) | closed |
| T-147-09 | Elevation of Privilege (policy) | disabled capability still callable in-flight | mitigate | Layer-1 HIDE: `SAVE_SKILL_TOOL` conditional on `self_improve_on` (`openai_service.py:1058-1064`); Layer-2 REFUSE: `_capability_disabled_message` → plain `capability_disabled` ToolResult at dispatch for web/sandbox/save_skill (`tool_dispatcher.py:3275-3335`); 2nd self-improve seam guarded (`skill_proposer_service.py:355-362`); all read last-known-good TTL cache | closed |
| T-147-10 | DoS (self-inflicted) | maintenance lock-out | mitigate | Allowlist `/auth` + ALL `/admin/*` (incl. PUT /admin/flags off-switch) + `DELETE /runs/{id}` (`maintenance.py:45,64-77`); segment-boundary match guards `/administrate`; cold/blip read → OPEN (`maintenance.py:48-61`) | closed |
| T-147-11 | Denial of Service | blocking I/O in async middleware | mitigate | Flag read is the in-memory TTL helper — no per-request supabase/DB call (`maintenance.py:48-61`); pure-ASGI class, websocket/lifespan pass through untouched, never buffers SSE (`maintenance.py:80-113`) | closed |
| T-147-12 | Elevation of Privilege | client-side operator affordances | mitigate | `isOperator` (from the /admin/me probe) drives RENDERING only (`App.tsx:62-102`); every admin data call hits a server-gated `/admin` route (`api.ts:3646,3658,3671,3685`); a forged flag reaches a shell whose fetches all 404; end-user banner reads PUBLIC /health (`api.ts:3700-3703`) | closed |
| T-147-13 | Tampering | free-text audit action via /control-plane/record | mitigate | Event is a Pydantic `Literal["visit","refresh"]` (unknown → 422) (`admin.py:480-487`); server owns the (label, action) via `_RECORD_MAP` (`admin.py:492-513`); no client string reaches `operator_audit_log` | closed |
| T-147-14 | Tampering | provider-path fork under a flag | mitigate | Refuse branch is a plain `ToolResult` JSON string — no `provider ==` branch (grep confirms none in the gate region) (`tool_dispatcher.py:3260-3335`); dispatch stays byte-identical when the flag is ON/absent | closed |
| T-147-15 | Information Disclosure | public /health settings leak + banner flag source | mitigate | /health returns ONLY `{status, redis, maintenance}` — the single added boolean, no other settings field (`main.py:491-504`); end-user banner reads /health, never /admin (`App.tsx:10-55`, `api.ts:3693-3703`) | closed |
| T-147-16 | Tampering (fat-finger DoS) | accidental maintenance-on | mitigate | Arm-to-confirm: first click only sets `armed` (does NOT call `onSetMaintenance`); Confirm flips, Cancel disarms (`MaintenancePanel.tsx:40-131`) — a single stray click can never wedge the platform | closed |
| T-147-17 | Repudiation / audit noise | silent polls recording | mitigate | Poll GETs `/backpressure` + `/runs` are floor-EXEMPT — no `operator_audit_floor` dependency (`admin.py:75-91,180-196`); only the mount visit-row + manual refresh record via the floor-ATTACHED `/control-plane/record` (`admin.py:498-515`); shell records once on mount + on ↻, silent auto-poll records nothing (`ControlRoomPage.tsx:220-222,231-236,276`) | closed |
| T-147-SC | Tampering (supply chain) | npm/pip package installs | accept | Zero installs — see Accepted Risks Log R-147-SC | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## CR-02 Regression Check (task-mandated)

The code-review BLOCKER CR-02 fix (make `save_app_settings` return a bool; `set_flag` 500s on a
failed write) was verified NOT to open a new gap in the T-147-01 / T-147-13 flag-write audit path:

- `save_app_settings` returns `True` on persist / no-op and `False` only when the `pool.execute`
  UPDATE raises (`user_settings.py:259,291-315`).
- `set_flag` checks the bool and raises 500 BEFORE any success `audit_label`/`audit_action` is set
  (`admin.py:460-468`); the success label is stamped only after a `True` (`admin.py:470-476`).
- The `operator_audit_floor` writes its one row AFTER the `yield`, and the `yield` is NOT wrapped in
  try/except (`dependencies.py:235-256`). A raised `HTTPException` propagates INTO the generator at
  the yield and out again, so the post-yield write block does not execute → **no audit row is written
  on a failed flip**. No false "Turned ON …" receipt is recorded. The belt-and-braces
  `flag.write_failed` stamp (`admin.py:461-464`) only matters if the floor is ever changed to record
  on exceptions — in which case it records a truthful failure, never a false success.
- The success path still writes exactly one honest ledger row; T-147-13's `/control-plane/record`
  endpoint is untouched by CR-02.

Result: T-147-01 (SQLi allowlist) and T-147-13 (server-owned audit mapping) both remain CLOSED; the
CR-02 fix strengthens ledger honesty rather than weakening it.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-147-SC | T-147-SC | Zero npm/pip packages installed in this phase — verified: NO `backend/requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`, or `backend/pyproject.toml` deltas across the phase-147 commit window (`4aae1f3e~1..HEAD`). @lobehub/icons + Radix Sheet used by the new admin UI were already installed pre-147. No supply-chain surface introduced. | Operator (plan-time, RESEARCH Package Legitimacy Audit N/A; audit-confirmed) | 2026-07-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Residual Notes (informational — not open threats)

These are code-review WARNING/INFO items that were **deferred** (acknowledged, not fixed). None maps
to a declared threat in the register, and none is a BLOCKER, so the phase's threat model is fully
closed. They are recorded so a future audit can revisit them.

- **WR-01 — phantom "Ended …" ledger row on a terminal-race kill (audit-copy accuracy).**
  `kill_run` special-cases only `zombie_healed`; a `terminal_noop` outcome (the run finished naturally
  between the list poll and the click) falls into the `else` and records `"Ended {victim}'s run"`
  though no cancel occurred (`admin.py:411-414`). This is an audit-*wording* gap, not one of the
  declared threats (T-147-07 = no operator attribution to the victim; T-147-13 = no client free-text
  in the ledger — both still hold: the row is still server-owned and victim-blind). Candidate fix:
  add an `elif outcome == "terminal_noop"` branch. LOW severity.

- **WR-02 — maintenance strands paused/interactive in-flight runs.** The allowlist does not pass
  `POST /runs/{id}/ask_user_response` or `/continue`, so a run paused on an `ask_user` prompt cannot be
  answered under maintenance (`maintenance.py:64-77`). T-147-10's *declared* mitigation (off-switch
  never trapped: auth + ALL /admin/* + DELETE /runs/{id} reachable, cold-cache OPEN) is fully present
  and closed; WR-02 is an additional in-flight-resume consideration, not part of the declared
  mitigation. Decide explicitly (allowlist the two resume POSTs, or document the freeze) in a
  follow-up.

- **IN-01 — `probe_supabase` selects `*`.** The liveness probe reads `app_settings.select("*")`
  including encrypted api-key columns, only to measure latency (rows discarded, never logged/returned)
  (`health_probe.py`). No leak today; needless exposure surface. Fix: `select("id")`.

- **IN-02 — tuner Kill returns 404 not 409.** A tuner id (no `runs` row) 404s rather than the 409 the
  "non-killable kinds" contract implies (`admin.py:362-363`). Defensible — 404 is non-discoverable and
  the UI never renders a tuner Kill affordance — but diverges from the stated 409. No security impact.

- **Cloud parity at promotion:** migration `097_operator_flags.sql` (3 additive app_settings booleans)
  must be pasted into the cloud Supabase SQL editor at the next production promotion (recorded in
  `DEPLOYMENT-WORKFLOW.md` §5). Runtime is byte-identical until an operator flips a flag.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-11 | 18 | 18 | 0 | gsd-security-auditor (opus) — plan-time register verification against committed HEAD (post CR-01/CR-02 fix); CR-02 flag-write audit-path regression re-checked |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Every `mitigate` threat verified by a code match at the cited file:line
- [x] Accepted risks documented in Accepted Risks Log
- [x] CR-02 fix confirmed to open no new gap in T-147-01 / T-147-13
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-11
