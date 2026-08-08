# Phase 190: Live Connector Slice + Connector Security — STRETCH — Research

**Researched:** 2026-08-08
**Domain:** Outbound egress security (SSRF / DNS-rebinding / header injection), org-scoped credential storage, first-party connector adapters (SMTP · Jira Cloud REST v3 · Slack Web API)
**Confidence:** HIGH on everything measured in-tree and in-venv; MEDIUM on the two vendor API envelopes (fetched from vendor docs, not driven against a live account — D-30's blocking dependency).

> **Every MUST-MEASURE answer below carries the command and its actual output.** Where a
> measurement contradicts `190-CONTEXT.md` or the planning prompt, the contradiction is
> stated loudly under **⚠ CORRECTION** and the CONTEXT decision is named. Six such
> corrections were found. CONTEXT itself predicted this failure mode ("*nothing typechecks
> prose*") and instructed re-derivation; that instruction paid.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All 32 decisions in `190-CONTEXT.md` are locked. They are **not** restated in full here —
the planner reads that file. What follows is the subset this research changes, confirms or
challenges, plus the two non-discretionary items.

**NOT DISCRETIONARY, must not be re-litigated downstream (CONTEXT `### Claude's Discretion`, verbatim):**

> **Two things are NOT discretionary and must not be re-litigated downstream:** D-16 (the
> golden-run send gate) and D-14 (the cross-org leak test), because both are latent defects
> that this phase's own commit creates.

**Explicitly left to research and planning (CONTEXT `### Claude's Discretion`, verbatim):**

> the precise `connector_connections` column list and index set; whether `httpx`'s transport
> hook or an explicit resolve-then-connect wrapper implements D-07 step 5; the Jira REST
> payload shape (ADF vs plain text description); the exact Settings → Connections route and
> its place in the nav; the wording of the egress refusal shown to an author; and the
> plan/wave decomposition.

Every one of those six is answered below with evidence.

**Two ROADMAP amendments require an operator YES/NO at plan-phase:** D-01 (material —
first-party adapters behind an MCP-shaped seam, not MCP-backed nodes) and D-20 (minor — two
migrations, 116 + 117). Research **confirms both premises by measurement**; see §M2 and §M10.

### Deferred Ideas (OUT OF SCOPE — do not research, do not propose)

Per **D-32**: broad connector catalog · inbound webhooks · public REST API · MCP client ·
service accounts · OAuth authorization-code flow · a 4th capability · retries / idempotency
keys / a send queue · scheduling or automations · contact/recipient directory resolution ·
any expression language or arbitrary-code node on the canvas · the run-surface approval
affordance (BUG-260808-02).

Nothing below researches, recommends or costs any of these.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CONN-02** | 2–3 first-party **live** connectors runnable from a workflow (email out, JIRA/ticket create, Slack notify) as the demo-able external-integration proof | §R11 (Slack `chat.postMessage` auth/scopes/`ok:false`), §R12 (Jira v3 `POST /rest/api/3/issue` + ADF), §R10 (SMTP transport + TLS), §M6 (`_exec_external_action` is a **one-line** change for D-16 — no signature change), §M1 (SC#10 rows CAN run per-request) |
| **CONN-03** | Every connector outbound secured: unconditional SSRF/egress allow-list regardless of credential state; sandboxed expression/template evaluation + NO arbitrary-code node; org-scoped Fernet-encrypted credentials by reference; a dedicated cross-org credential-leak test; `threats_open: 0` | §R14 (**the property predicate has FOUR measured holes** — `is_global` alone is not enough), §R15 (registrable-domain matching needs NO new dependency), §R10 (DNS pinning is achievable for **both** httpx AND smtplib — CONTEXT's escape hatch is not needed), §M7 (the exact fail-CLOSED inversion site), §M8 (the RLS predicate to mirror), §M5 (the sentinel to re-scope), §R13 (SMTP header injection is **already** a `ValueError` — the defence is *do not bypass `EmailMessage`*) |
</phase_requirements>

---

## Summary

This is a backend security phase whose entire risk sits in three places, and all three were
measurable before a line was written.

**First, the two latent defects CONTEXT names are both cheaper than feared.** D-16 (publish-time
egress) is a **one-line gate** — `ctx` is a `SimpleNamespace` that already carries
`is_golden_run`, it is already read by the engine at `harness_engine.py:837`, and
`_exec_external_action(phase, accumulated_outputs, ctx)` already receives that same `ctx`. **No
signature change, no threading, no engine edit.** D-14 (cross-org credential resolution) has an
exact shipped RLS predicate to copy — the `skills` SELECT policy at `full-schema.sql:4833` —
and an exact autofill trigger (`autofill_org_id_by_owner('created_by')`).

**Second, the egress guard is harder than CONTEXT assumes, in one specific and measurable
way.** The prompt asked for "the property, not the patch". I built the property-shaped
predicate (`not ip.is_global`) and **drove 29 addresses through it. It has four holes**:
multicast (`224.0.0.1` → `is_global=True`), NAT64 (`64:ff9b::7f00:1` embeds `127.0.0.1`,
`is_global=True`), IPv4-**translated** SIIT (`::ffff:0:7f00:1` — distinct from IPv4-*mapped*,
`ipv4_mapped` returns `None`, `is_global=True`), and IPv6 site-local (`fec0::1` →
`is_global=True`). Each was found by driving a case, not by reasoning. The corrected predicate
is given in §R14 and it is the **unwrap-then-test** shape, not a CIDR list.

**Third, DNS pinning is achievable for BOTH transports** — CONTEXT D-07 step 5's escape hatch
("*if pinning proves impractical for SMTP… a named residual risk*") is **not needed for the
mechanism**. httpx exposes `request.extensions["sni_hostname"]` (verified present in the
installed `httpcore`), and `smtplib.SMTP.connect()` provably never assigns `self._host`
(source-read in this venv), so `SMTP_SSL()` → set `_host = hostname` → `connect(validated_ip,
port)` pins the socket while preserving SNI and certificate hostname verification. **The
residual risk that remains is different and must be named honestly: both recipes depend on
private/undocumented attributes.**

**Primary recommendation:** build `backend/app/security/egress.py` as a **resolve-then-connect
wrapper** (not an httpx transport subclass) that returns a validated `(ip, sni_hostname, port)`
triple, and have both the httpx path and the smtplib path consume that same triple. One
validator, two thin binders, one source fence. Wave 0 lands **three** RED tests before any
adapter exists: D-16's already-armed golden-run fence, D-14's cross-org leak drive, and D-06's
no-credential ordering drive.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Destination validation (scheme · host · IP · pin) | **API / Backend** (`app/security/egress.py`) | — | The socket must be ours (D-01). A client-side or edge check is advisory only. |
| Credential storage + decryption | **Database / Storage** (`connector_connections`) + Backend (`secret_cipher`) | — | CONN-03 SC#4: never in the definition JSONB, never in the client. |
| Credential *resolution* (id → secret) | **API / Backend** (`connector_service.resolve(connection_id, org_id)`) | Database (RLS backstop) | D-15: the harness engine runs on the BYPASSRLS pool, so the **application org filter is the real gate** here and RLS is defence in depth. |
| The send itself | **API / Backend** (`_exec_external_action` → adapter) | — | D-19: after approval, inside the executor, owning no waiting. |
| Publish-time suppression (D-16) | **API / Backend** (executor reads `ctx.is_golden_run`) | — | §M6: the flag is already on the ctx bag at the one site that sets it. |
| Connection CRUD surface | **Frontend Server / Client** (Settings → Connections, sixth tab) | Backend (`/connectors/connections`) | Sketch 155-C: own tab, instrument table. Per-row transactions ≠ the tab-level Save model. |
| Connection *picker* at author time | **Client** (new child of `ExternalActionSection`) | Backend (read endpoint) | §M4: putting the fetch **in** `ExternalActionSection.tsx` breaks two shipped source fences. A child component keeps both green. |
| Kill-switch (`live_connectors`) | **API / Backend** (`admin.py` allowlist) | — | §M9 — but ⚠ **the allowlist CONTEXT names is the wrong one**; see the correction. |

---

# Part I — MUST MEASURE (commands and their actual output)

## M1. Per-request routing on the workflow-run endpoint (D-29) — **MEASURED: YES, it accepts it**

**⚠ This is the answer that changes VALIDATION.md's cost model, and it is the OPPOSITE of the
caution CONTEXT D-29 carried.**

There is **no** `POST /workflows/{id}/run` endpoint. A workflow run is launched **through the
chat message endpoint**:

```
$ grep -n "@router\." backend/app/api/workflows.py
175:@router.get("/published", ...)      223:@router.get("/starters", ...)
600:@router.post(...)   → validate_workflow
782:@router.get(...)     880:@router.post(...) → publish_workflow
976:@router.post(...)   → create_draft            1010:@router.get(...)
1042:@router.patch(...)  1139:@router.delete(...)  1215:@router.get(...)
1245:@router.delete(...) 1386:@router.post(...)   → generate_workflow
```

No run route. The launch site:

```
$ grep -rn "create_workflow_run" backend/app --include=*.py | grep -v "def create_workflow_run"
backend/app/api/threads.py:928:        _active_workflow_run_id = await create_workflow_run(
backend/app/services/harness/publish_service.py:803:    run_id = await create_workflow_run(   # ← the golden run
```

**The endpoint is `POST /threads/{thread_id}/messages`. The exact request model class is
`app.models.message.MessageCreate`** (`backend/app/models/message.py`), and it carries all
three fields on the same request:

```python
class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    provider: str | None = None   # override active provider for this request
    agent_mode: str = "default"
    workflow_definition_id: UUID | None = None   # ← THIS message kicks off the named workflow
    folder_id: UUID | None = None
```

And they are threaded straight into the run row:

```
$ grep -n "_resolved_model\|_resolved_provider" backend/app/api/threads.py
858:    _resolved_model, _resolved_provider, ... = await resolve_run_model(
928:        _active_workflow_run_id = await create_workflow_run(
939:            model=_resolved_model,                      # SEED-047
```

**Consequence for VALIDATION.md:** the Phase-185 cheap-scoreboard method **applies verbatim**.
Each SC#10 row is one `POST /threads/{id}/messages` with `{content, model, provider,
workflow_definition_id}` — **no global setting is mutated**, so the operator's environment is
untouched and rows cannot contaminate each other.

**⚠ BUT — the rows are NOT free-running in parallel on one thread.** The kickoff takes a
per-thread anchor lock that 409s:

```
$ grep -n "409\|active_workflow_run_id" backend/app/services/workflow_kickoff.py
146:    _existing_anchor = (thread_row or {}).get("active_workflow_run_id")
166:            # (SC#2 / MODE-02 — the binding 409, not just a grayed button)
173:                status_code=status.HTTP_409_CONFLICT,
```

**So: 8 rows run in parallel only across 8 DISTINCT THREADS; two rows on one thread are
serial-by-409.** State that in VALIDATION.md as the measured cost, not as a discovery.

## M2. Re-derived baselines — **do not inherit, these are the measured numbers**

### Migration head — **CONFIRMED 115, next free 116**

```
$ ls supabase/migrations/ | tail -1
115_workflow_phases_recorded_not_sent.sql
$ ls supabase/migrations/ | wc -l
109
```

CONTEXT D-10's claim (head 115, 109 files, next free 116) is **correct in all three halves**.

### `harness_audit` CHECK — **CONFIRMED: column `event_type`, 23 literals**

```
$ grep -n "harness_audit_event_type_check" supabase/full-schema.sql
1124:    CONSTRAINT harness_audit_event_type_check CHECK ((event_type = ANY (ARRAY[...])))
$ sed -n '1124p' supabase/full-schema.sql | grep -o "'[a-z_]*'::text" | wc -l
23
```

The exact 23, in the CHECK's own order:

```
phase_started · phase_completed · phase_transition · gate_passed · gate_failed ·
tool_refused · run_started · run_completed · run_failed · emit_forced · emit_recovered ·
emit_validated · emit_rejected · emit_rendered · emit_integrity_failed · emit_failed ·
judge_verdict · publish_attempted · publish_blocked · publish_succeeded · policy_applied ·
validator_ask_user_approved · action_risk_pending
```

Confirmed at the Python layer too:

```
$ python -c "from app.db.workflows import _AUDIT_EVENT_TYPES; print(len(_AUDIT_EVENT_TYPES), type(_AUDIT_EVENT_TYPES).__name__)"
23 frozenset
```

CONTEXT D-20 is **correct in both halves** (`event_type`, not `kind`; 23, at `:1124`).

### `tsc` baseline — **CONFIRMED 33**

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
33
```

(`tsc --noEmit` without `-p tsconfig.app.json` checks **zero** files here — CLAUDE.md memory
is correct. Always pass the project.)

### Frontend count gate — **⚠ CORRECTION #1: the pins are ALREADY DRIFTED +13**

```
$ node scripts/vitest-count-gate.cjs
  ExternalActionSection.test.tsx               25      34      +9
  PhaseTimeline.test.tsx                       17      21      +4
  -------------------------------------------------------------
  total                                      2714    2727     +13
  total 2727  ·  failed 0  ·  pinned total 2714
count gate OK — 48/48 pinned files present, no per-file decrease, 0 failing.
```

**The plan must NOT quote `ExternalActionSection.test.tsx: 25`.** That is the *pin*
(`scripts/vitest-count-gate.cjs:697`); the file **runs 34**. The gate passes because it only
fails on a decrease — so the drift is invisible unless you run it. This is the sixth
consecutive phase to meet a stale count-gate baseline (CONTEXT `<code_context>` predicted it).
**Measured HEAD figures for the plan to pin against: running total 2727 · pinned total 2714 ·
failed 0 · 48/48 files.**

### Backend suite baselines

```
$ python -m pytest tests/unit/test_189_no_egress.py tests/unit/test_189_external_action_model.py \
    tests/unit/test_audit_event_registration.py tests/unit/test_publish_service.py -q
67 passed, 1 warning in 1.48s

$ python -m pytest tests/test_harness_engine.py -q
46 passed, 1 warning in 0.31s
```

## M3. `phaseVocabulary.ts` zero-import property — **MEASURED: HOLDS**

```
$ grep -nE "\bimport\b|\brequire\(|from ['\"]" frontend/src/components/workflows/phaseVocabulary.ts
509: * why it is EXPORTED from a module the picker can import rather than kept private.
679:  //     module has ZERO import statements today and this is not the change that should
```

Two hits, **both inside comments**. Zero real import statements. The property stands at HEAD.

**Can a connection-aware `notConnectedOf` be written without breaking it? YES — and no new
data has to reach it.** The whole point of D-13 is that the phase config stores a
`connection_id` **inside the JSONB the function already receives**:

```ts
export function notConnectedOf(phase: PhaseSpecJSON): boolean {
  if (phase.config?.phase_type !== EXTERNAL_ACTION_PHASE_TYPE) return false
  return true                    // ← 190 replaces THIS line
}
```

`phase.config` is already the parameter. The replacement line is a pure read of that same
object — e.g. a truthiness/shape test on `phase.config?.connection_id`. **Nothing new must
reach it via `canvasModel.buildPhaseData`, and no import is needed.** The zero-import property
survives by construction, and `EXTERNAL_ACTION_PHASE_TYPE` is a file-local `const` at
`phaseVocabulary.ts:500`, not an import.

## M4. The exact line D-24 edits, and the ⚠ **STRUCTURAL COLLISION** in D-23

### D-24's line — **⚠ CORRECTION #2: the line numbers in CONTEXT and in the prompt are BOTH wrong**

```
$ grep -n "notConnectedOf" frontend/src/components/workflows/phaseVocabulary.ts
810:export function notConnectedOf(phase: PhaseSpecJSON): boolean {
$ wc -l frontend/src/components/workflows/phaseVocabulary.ts
813
```

Measured: the function is **`phaseVocabulary.ts:810-813`**. The file is 813 lines and the
function is the last thing in it. CONTEXT D-24 says `:811-814`; the prompt says `:788-814`;
CONTEXT `<canonical_refs>` says `:788-814`. **All three are off.** The line D-190 replaces is
**812** (`return true`). This is exactly the "nothing typechecks prose" class CONTEXT flagged
for `PHASE_GLYPHS` — re-grep, never cite.

### ⚠ CORRECTION #3 (the big one) — **D-23 as written breaks two shipped source fences**

CONTEXT D-23 says the connection picker "extends the EXISTING `ExternalActionSection.tsx`" and
`PhaseFormPanel.tsx` gains ZERO lines. Both halves are in tension with measured facts.

**Fact A — the props interface has THREE properties, not six:**

```
$ sed -n '88,98p' frontend/src/components/workflows/ExternalActionSection.tsx
export interface ExternalActionSectionProps {
  capability: string
  onChange: (value: string) => void
  onPersist: () => void
}
```

CONTEXT says "*its six contract properties are each separately guarded; keep all six*". There
are **three props**. The "six" are the six **source-purity fences** in
`ExternalActionSection.test.tsx:381-412`, which is a different thing entirely and matters much
more:

```ts
it("imports nothing from the API client and opens no request", () => {
  expect(src).not.toMatch(/from\s+["']@\/lib\/api["']/)
  expect(src).not.toMatch(/fetch\(/)
  expect(src).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  expect(src).not.toMatch(/["'`]\/(workflows|api)\//)      // nor any route string
})
it("is a LEAF — no context, no store, no effect", () => {
  expect(src).not.toMatch(/useContext|useStore|useEffect|zustand/)
})
it("carries NO title attribute — guidance cannot regress into a tooltip", () => {
  expect(src).not.toMatch(/title=/)
})
```

**A connection picker must read `GET /connectors/connections?capability=…`. Putting that read
inside `ExternalActionSection.tsx` turns all six of those fences RED.**

**Fact B — the mount is one line with exactly three props:**

```
$ sed -n '1052,1054p' frontend/src/components/workflows/PhaseFormPanel.tsx
          {pt === "external_action" && (
            <ExternalActionSection capability={asStr(cfg.capability)} onChange={set("capability")} onPersist={onPersist} />
          )}
```

and the write seam is capability-specific:

```
$ grep -n "const set = " frontend/src/components/workflows/PhaseFormPanel.tsx
730:  const set = (key: string) => (v: string | number) => onChange({ [key]: v })
```

`onChange={set("capability")}` is **bound to the `capability` key**. Writing `connection_id`
through it is impossible without a fourth prop — which makes `PhaseFormPanel.tsx`'s numstat
**non-zero**, violating D-23's own `0 0` requirement.

### THE RESOLUTION — and it satisfies D-23 and D-24 exactly as written

**Build the picker as a NEW SIBLING COMPONENT (`ConnectionPicker.tsx`) that
`ExternalActionSection` renders, and let the child own the fetch AND the write.**

- `PhaseFormPanel.tsx` diff = **`0 0`** ✅ (D-23 satisfied literally)
- `ExternalActionSection.tsx` gains **one import + one JSX line**; all six purity fences read
  `externalActionSectionSource` — a *string of that file only* — so **all six stay GREEN**
  provided the child's name contains no banned token. ⚠ **`ConnectionPicker` must not be
  imported via a path string matching `/(workflows|api)/`** — use `"./ConnectionPicker"`, a
  relative sibling import, which does not match the fence regex `["'`]\/(workflows|api)\//`
  (it requires a leading slash). Verified against the fence's own positive control.
- The child owns `useEffect` + the API read + the store write. There **is** a zustand store to
  write through without touching the panel:

```
$ grep -rln "zustand" frontend/src/components/workflows
frontend/src/components/workflows/builderStore.ts
frontend/src/components/workflows/BuilderStoreProvider.tsx
```

**The plan must fence this deliberately:** add a `ConnectionPicker.test.tsx` and register it
with `scripts/vitest-count-gate.cjs` **in the commit that creates it** (the shipped rule
`ExternalActionSection.test.tsx:12` states verbatim), and add a RED-first assertion that
`ExternalActionSection.tsx` still passes all six purity fences after the mount line lands.

## M5. `test_189_no_egress.py` — the sentinel, and how to re-scope it

**File:** `backend/tests/unit/test_189_no_egress.py`, **669 lines**.

**The mechanism** (`_block_all_http`, `:84-145`) — four transports, patched in a load-bearing
order:

```python
monkeypatch.setattr(httpx.Client,      "send",     _sync_send,  raising=True)
monkeypatch.setattr(httpx.AsyncClient, "send",     _async_send, raising=True)
monkeypatch.setattr(smtplib.SMTP,      "__init__", _blocked("smtplib.SMTP.__init__"), raising=True)
monkeypatch.setattr(urllib.request,    "urlopen",  _blocked("urllib.request.urlopen"), raising=True)
monkeypatch.setattr(socket.socket,     "connect",  _blocked("socket.socket.connect"), raising=True)
```

> `⚠ ORDER MATTERS: socket.socket.connect goes on LAST.` (`:115-117`)

**Its five inertness controls** (one per transport, `:266-335`) each prove the patch actually
bound. `aiohttp` is deliberately **not** patched (not a declared dependency).

**How the golden-run fence imports it** (`backend/tests/test_harness_engine.py:1139`):

```python
from tests.unit.test_189_no_egress import _block_all_http
```

**The Windows trap, confirmed in the test's own words (`test_harness_engine.py:1143-1148`):**

```python
# ⚠ THE LOOP IS BUILT BEFORE THE SENTINEL ARMS, and that ordering is load-bearing on
# Windows: `asyncio.run` creates a fresh proactor loop whose self-pipe is a
# `socketpair()`, i.e. a `socket.connect` the sentinel would catch — measured, as the
# first version of this fence failing in `proactor_events._make_self_pipe` rather than
# in the executor. Building it first keeps the raw-socket layer armed for the STEP.
loop = _asyncio.new_event_loop()
try:
    _block_all_http(monkeypatch)
    r = _drive_approved_external_action(wf, mock_asyncpg_pool, is_golden_run=True, loop=loop)
finally:
    loop.close()
```

### How to re-scope the sentinel deliberately (never delete it)

The sentinel's meaning changes from *"nothing sends, ever"* to *"nothing sends **on the paths
that must not send**"*. Three targets, three different re-scopes:

| Consumer | 190's meaning | Re-scope |
|---|---|---|
| `test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress` | **UNCHANGED and MANDATORY.** A golden run must still perform zero egress after the send exists. | **Do not touch it.** It goes RED on the send commit and D-16's gate turns it green again. Drive RED → green in the same commit (CONTEXT D-16). |
| `test_189_no_egress.py` **Case A** — the source fence walking `backend/app/**` for the token `mcp` | Still true (D-01 builds no MCP client). | **Do not touch it.** Its passing is now part of D-01's amendment evidence. |
| `test_189_no_egress.py` **Case B** — patched-transport falsification against `_exec_external_action` | **Becomes FALSE for a bound connection.** | Re-scope its *drive*, not its *sentinel*: keep `_block_all_http` byte-identical and add the case's precondition — the phase has **no `connection_id`** (D-17's `recorded_not_sent` terminal), which is a real, permanent, shipping state. Add a **new** positive case: with a `connection_id` bound and the sentinel armed, the executor **must** raise `_EgressAttempted` — proving the send is live rather than accidentally still inert. |

**The RED-first discipline is not optional here.** The shipped project idiom (CONTEXT
`<code_context>` → Established Patterns) is: plant in **production source**, observe RED,
restore md5-identical, `grep -c PLANT` → 0.

## M6. `_exec_external_action` — **MEASURED: D-16 is a ONE-LINE GATE, no signature change**

### ⚠ CORRECTION #4 — the line range CONTEXT gives is wrong

```
$ grep -n "_exec_external_action\|RECORDED_INTENT_KEY\|def _external_action_inputs" backend/app/services/harness/phase_types.py
1705:RECORDED_INTENT_KEY = "recorded_intent"
1729:def _external_action_inputs(accumulated_outputs: dict, ctx) -> dict:
1810:async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict:
1884:        RECORDED_INTENT_KEY: {"capability": capability, "inputs": resolved},
1902:    "external_action": _exec_external_action,
```

CONTEXT and `<canonical_refs>` both say `phase_types.py:1667-1903`. Measured, the function is
**`:1810-1886`**; the block CONTEXT describes (copy tables + `RECORDED_INTENT_KEY` +
`_external_action_inputs` + `PHASE_TYPE_REGISTRY_ENTRIES`) actually spans **`:1700-1903`**.

### The exact signature and return keys

```python
async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict:
    ...
    return {
        "text": _external_action_body(capability, resolved),
        RECORDED_INTENT_KEY: {"capability": capability, "inputs": resolved},
    }
```

Both keys are load-bearing: `text` is what `_latest_phase_text` scans for; `recorded_intent`
is what the engine branches on to write `recorded_not_sent`.

### **Does `ctx` already carry `is_golden_run` at this call site? YES.**

```
$ grep -rn "is_golden_run" backend/app/services/harness_engine.py
778:    # A LIVE RUN IS BYTE-IDENTICAL. ``ctx.is_golden_run`` is set at exactly one site
833:    # ``ctx.is_golden_run`` inside the executor (the send is skipped, the record is not — so
837:    if _armed and getattr(ctx, "is_golden_run", False):
```

The engine already reads it off `ctx` at `:837`. The one site that sets it
(`publish_service.py:840-868`):

```python
ctx = SimpleNamespace(
    run_id=run_id, ..., pool=pool, emit=_emit, ...,
    # ── D-19 (189, CONFLICT 1) — the ONE ctx in the tree that IS a golden run ──
    is_golden_run=True,
)
```

`ctx` is a plain `SimpleNamespace` (no typed class), it is passed **unchanged** into
`run_workflow` → `_run_phase_with_gates` → the executor. **So D-16 is:**

```python
if getattr(ctx, "is_golden_run", False):
    # skip the send; the record is still composed by _external_action_body (D-16 shape 1)
```

**inside `_exec_external_action`. One line. No signature change. No engine edit. No threading.**
`getattr(..., False)` **is** the live-run answer, matching the engine's own reader exactly.

**⚠ One open hazard the plan must close:** `harness_engine.py:2205` builds a **second**
`SimpleNamespace` ctx (`_build_resume_context`). It does **not** set `is_golden_run`, so a
resumed run defaults to live — correct for the live path, but it means **a resumed golden run
would lose the flag**. Golden runs do not pause (D-19 auto-continues), so this should be
unreachable; the plan should assert that unreachability with a test rather than assume it.

## M7. `secret_cipher.py` — what is reusable, and exactly where the fail-CLOSED inversion lives

### ⚠ CORRECTION #5 — **the function names in CONTEXT D-11 do not exist**

CONTEXT D-11 says: "*The plan must state which of `encrypt_value` / `decrypt_value` /
`sweep_row` it reuses*". Measured `__all__`:

```
$ sed -n '244,252p' backend/app/security/secret_cipher.py
__all__ = ["SECRET_COLUMNS","get_cipher","is_encrypted","encrypt_secret","decrypt_secret","sweep_row","encryption_status"]
```

**The names are `encrypt_secret` / `decrypt_secret`** — not `encrypt_value` / `decrypt_value`.
252 lines total; `backend/app/security/` contains only `__init__.py` and `secret_cipher.py`, so
`egress.py` genuinely is the second module in that package (D-05's sibling claim holds).

### The reuse verdict, per symbol

| Symbol | Signature | 190 verdict |
|---|---|---|
| `get_cipher() -> MultiFernet \| None` | `:74` — returns `None` when unkeyed (D-150-01 fail-OPEN); raises `ValueError` on a malformed key | **REUSE**, and this is the **exact** site of D-11's inversion |
| `encrypt_secret(plaintext: str, cipher: MultiFernet) -> str` | `:91` — returns `enc:v1:<token>` | **REUSE verbatim.** Note it takes the cipher **as an argument** — it cannot fail open on its own |
| `decrypt_secret(value: str, cipher: MultiFernet) -> str` | `:97` — strips envelope, no TTL; raises `InvalidToken` | **REUSE verbatim** at call time |
| `is_encrypted(value) -> bool` | `:86` — prefix test, never a blind decrypt | **REUSE** — classify by prefix, never try-decrypt |
| `_ENVELOPE_PREFIX = "enc:v1:"` | `:43` | **REUSE** (module-private; read via `is_encrypted`, do not re-type the literal) |
| `sweep_row(row) -> dict[str, str]` | `:107` — iterates `SECRET_COLUMNS` over an `app_settings` row | **DO NOT REUSE.** It is hard-keyed to `SECRET_COLUMNS`. |
| `SECRET_COLUMNS` (13 names) | `:50` | **DO NOT EXTEND.** D-11 is correct: it drives `main.py`'s `app_settings` boot sweep and a per-org per-row table does not fit that shape. |
| `encryption_status(row)` | `:172` | Not needed. (Sketch 155-C's `Credential` column is a *connection check* verdict, a different thing.) |

### **Where the fail-CLOSED inversion must live — precisely**

`get_cipher()` returns `None` and **that is the only fail-open surface**. Because
`encrypt_secret` demands a `MultiFernet`, the inversion is one guard at the **write** call
site in `connector_service`:

```python
cipher = get_cipher()
if cipher is None:
    # D-11 INVERSION — app_settings tolerates plaintext (D-150-01); a TENANT credential
    # does not. Refuse the STORE. This is a decision, not a bug.
    raise ConnectorCipherUnavailable(...)          # → HTTP 503 + sketch 156 moment 9
secret_ciphertext = encrypt_secret(plaintext, cipher)
```

Sketch 156 moment 9 is the UI half and it is already designed: **Save goes `disabled`** with
`aria-describedby` pointing at the reason, because it is a refusal the person **cannot** fix
(contrast moment 8, the egress refusal, where Save stays enabled).

**Two more inversion sites the plan must not forget:** the **read** path (`decrypt_secret`)
must also refuse when `cipher is None` — a stored `enc:v1:` value with no key must be a
refusal, not a silent plaintext passthrough — and the **boot** path must not add connector
columns to any sweep.

## M8. The membership-RLS predicate to mirror (D-12), verbatim

The canonical **org-shared** SELECT shape — `skills`, `full-schema.sql:4833`:

```sql
CREATE POLICY "Users can view own and global skills" ON public.skills
  FOR SELECT TO authenticated
  USING (((is_system = true)
       OR ((org_id IN ( SELECT public.current_user_org_ids() AS current_user_org_ids))
           AND ((auth.uid() = user_id) OR (is_org_shared = true)))));
```

The canonical **write** shapes — `workflow_definitions`, `full-schema.sql:4493 / 4626 / 4752`:

```sql
FOR DELETE ... USING  ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = created_by));
FOR INSERT ... WITH CHECK ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = created_by) AND (is_system_global = false));
FOR UPDATE ... USING  ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = created_by))
          WITH CHECK ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = created_by) AND (is_system_global = false));
```

**Applying D-12 (org-shared by default, NO cross-org escape branch):**

```sql
-- SELECT: org-shared, no is_system branch. THE ABSENCE OF THAT BRANCH IS THE DECISION (D-12).
FOR SELECT ... USING (org_id IN (SELECT public.current_user_org_ids()));
-- INSERT/UPDATE/DELETE: creator-scoped inside the org, with NO is_system_global clause
--   (there is no such column on connector_connections — D-12 forbids it).
FOR INSERT ... WITH CHECK ((org_id IN (SELECT public.current_user_org_ids())) AND (auth.uid() = created_by));
```

**The autofill trigger** (`supabase/migrations/106_org_id_autofill_trigger.sql:74-107`) —
`SECURITY DEFINER`, `SET search_path = ''`, forward-compat no-op when `org_id` is already
supplied, fail-safe `NULL` (which the `NOT NULL` column then rejects). Register it in
migration 116 exactly as every sibling does:

```sql
DROP TRIGGER IF EXISTS connector_connections_autofill_org_id ON public.connector_connections;
CREATE TRIGGER connector_connections_autofill_org_id BEFORE INSERT ON public.connector_connections
  FOR EACH ROW EXECUTE FUNCTION public.autofill_org_id_by_owner('created_by');
```

(`TG_ARGV[0]` is `'created_by'` for GROUP 2 tables; `'user_id'` for GROUP 1. `connector_connections`
uses `created_by` per D-10, so GROUP 2.)

## M9. `admin.py` kill-switch allowlist — **⚠ CORRECTION #6: D-26 names the WRONG allowlist**

CONTEXT D-26: "*A code-constant flag (working name `live_connectors`) joins `admin.py`'s
kill-switch allowlist — the exact one-allowlist-entry / zero-new-endpoint path Phase 181 used
for `visual_workflow_canvas`.*"

**Measured — those are two different allowlists, and Phase 181 used the second one:**

```
$ grep -n "visual_workflow_canvas" backend/app/api/admin.py
104:    "visual_workflow_canvas",
```

Line 104 is inside `_VISIBILITY_FEATURES` (the `PUT /admin/visibility` allowlist), **not**
`_FLAG_HUMAN_NAMES` (the `PUT /admin/flags` kill-switch allowlist at `:67-80`).

**The cost difference is a whole migration:**

| Allowlist | Endpoint | Storage | Cost of one new entry |
|---|---|---|---|
| `_FLAG_HUMAN_NAMES` (`admin.py:67`) | `PUT /admin/flags` → `save_app_settings` | **a boolean COLUMN on `app_settings`** — the constant's own comment: *"These are the five booleans added to `main._DIRECT_COLUMNS` (mig 097 added the last three)"*, and the 159 entry records *"The `app_settings` column it writes is created by Plan 03's **migration 103**"* | **a THIRD migration (118)** |
| `_VISIBILITY_FEATURES` (`admin.py:98`) | `PUT /admin/visibility` | **mig-098 JSONB** — audience enum `{everyone, operators, role, off}` | **ZERO migration** |

**Recommendation: take the `_VISIBILITY_FEATURES` path — it is what Phase 181 actually did,
and it is what makes D-26's "zero new endpoint code" claim true at zero migration cost.**
Off-by-default is expressed as audience `"off"` (Phase 181's own precedent, `admin.py:110-111`).
The consumer side is already built: `dependencies.py:672` (`feature_audience(...)`),
`dependencies.py:693` (`resolve_feature_access(...)`), and `api/features.py:69` records that an
`"off"` feature is hidden.

⚠ If the operator prefers the true `/admin/flags` kill-switch semantics (a boolean, plain-language
audit label `flag.live_connectors.off`), **say so at plan-phase and budget migration 118** — do
not discover the column requirement mid-execution.

## M10. Two migrations — the `test_audit_event_registration.py` interaction (D-20)

The G2 fence reads **the highest-numbered migration that DEFINES `harness_audit_event_type_check`**
(`test_audit_event_registration.py:103-116`), not simply the highest-numbered migration:

```python
def _highest_numbered_check_migration() -> tuple[Path, list[str]]:
    for path in sorted(_MIGRATIONS_DIR.glob("*.sql")):
        literals = _extract_check_literals(path.read_text(encoding="utf-8"))
        if literals is not None:
            candidates.append((_migration_number(path), path, literals))
    _, path, literals = max(candidates, key=lambda c: c[0])
```

**So migration 116 (`connector_connections`) is invisible to it and 117 becomes the source of
truth** — the ordering CONTEXT D-20 chose is exactly right and needs no special handling.

The fence is **two-directional**: a literal in Python-but-not-SQL is a mid-run Postgres 23514;
a literal in SQL-but-not-Python is a `ValueError` before the INSERT. **Both layers move in
the same commit:** `_AUDIT_EVENT_TYPES` in `backend/app/db/workflows.py` **and** migration 117.
It also asserts non-vacuity and no duplicates, and `test_g2_parser_survives_parenthesised_grouping_comments`
guards a parser failure mode that would silently report 9 instead of 23.

**Precedent to copy:** `supabase/migrations/114_harness_audit_action_risk_pending.sql` — **49
lines**, the whole shape for one added literal.

---

# Part II — MUST RESEARCH (vendor docs and driven probes)

## R10. DNS-pin-to-validated-IP in Python — **BOTH transports are pinnable**

### httpx — `request.extensions["sni_hostname"]`, CONFIRMED PRESENT in this venv

```
$ python -c "import inspect, httpcore._async.connection as ac; s=inspect.getsource(ac); print('sni_hostname' in s)"
True
$ ... printing the matching lines:
    sni_hostname = request.extensions.get("sni_hostname", None)
    "server_hostname": sni_hostname
```

Installed: **httpx 0.28.1**, Python 3.12.6. httpcore passes `sni_hostname` straight into
`start_tls(server_hostname=...)`, **independently of the host used for the TCP connection**.

**The recipe (the answer to CONTEXT's "transport hook vs explicit wrapper" discretion item):**

```python
# 1. validate the destination ONCE (scheme · registrable host · resolved IPs)
ip, hostname, port = egress.validate_http(url)            # returns the PINNED tuple

# 2. rewrite the URL to the IP literal, restore identity via headers + extensions
pinned = url.copy_with(host=ip)                            # TCP goes to the validated IP
req = client.build_request("POST", pinned, json=..., headers={..., "Host": hostname})
req.extensions["sni_hostname"] = hostname                  # SNI + cert hostname verification
resp = await client.send(req, follow_redirects=False)      # D-07 step 4
```

`follow_redirects=False` is the httpx default, but **set it explicitly** — a default is not a
guarantee and D-07 step 4 is a security property, not a convenience.

**Recommendation: the explicit resolve-then-connect wrapper, NOT an `AsyncHTTPTransport`
subclass.** Reasons: (a) the same validated triple must feed `smtplib`, which has no transport
concept — one validator, two thin binders; (b) a transport subclass makes the guard *implicit*,
and D-06's whole point is that the ordering must be **assertable directly**; (c) the source
fence (D-05) is easier to state over a function nobody may bypass than over a class somebody
may forget to install.

### smtplib — **pinnable, via a measured property of `connect()`**

Both TLS paths derive the certificate hostname from the same private attribute:

```
$ ... inspect.getsource over smtplib:
  [SMTP_SSL._get_socket]  new_socket = self.context.wrap_socket(new_socket, server_hostname=self._host)
  [SMTP.starttls]         self.sock  = context.wrap_socket(self.sock,       server_hostname=self._host)
  [SMTP._get_socket]      return socket.create_connection((host, port), timeout, self.source_address)
  [SMTP.__init__]         self._host = host
```

**The measured fact that makes pinning work:**

```
$ python -c "import inspect, smtplib; print('_host' in inspect.getsource(smtplib.SMTP.connect))"
False
```

`SMTP.connect()` **never assigns `self._host`** — it only uses its `host` argument for the TCP
`create_connection`. And a bare construction does not connect:

```
$ python -c "import smtplib; s=smtplib.SMTP_SSL(timeout=1); print(repr(s._host))"
''
```

**The recipe:**

```python
# implicit TLS (465)
s = smtplib.SMTP_SSL(context=ctx, timeout=T)   # host='' → does NOT connect
s._host = hostname                              # SNI + certificate hostname
s.connect(validated_ip, port)                   # TCP to the PINNED IP; _host untouched

# STARTTLS (587)
s = smtplib.SMTP(timeout=T)
s._host = hostname
s.connect(validated_ip, port)
s.starttls(context=ctx)                         # wraps with server_hostname=self._host
```

Use `ssl.create_default_context()` (which sets `check_hostname=True` and
`verify_mode=CERT_REQUIRED`); `certifi 2026.02.25` is installed.

**A cleaner-reading variant** is an `SMTP_SSL` subclass overriding `_get_socket` — the same
extension point the stdlib itself uses for `SMTP_SSL` and `LMTP`. It depends on the same
private name, so it is a readability choice, not a safety one.

### ⚠ THE HONEST RESIDUAL RISK — restated, because CONTEXT's version is the wrong one

CONTEXT D-07 step 5 offers: "*If pinning proves impractical for SMTP within the phase, that is
recorded as a named residual risk in SECURITY.md with its own trigger.*"

**Measurement says pinning is practical for both.** The escape hatch is not needed for the
mechanism. But a **different** residual risk is real and must be named in SECURITY.md:

> **RESIDUAL-190-01 — both pinning recipes depend on non-public attributes.**
> `smtplib.SMTP._host` is a private attribute and `SMTP.connect()`'s non-assignment of it is
> an implementation detail, not a documented contract; `httpcore`'s `sni_hostname` request
> extension is an httpx/httpcore internal convention rather than a versioned public API.
> A CPython or httpx minor upgrade could silently break the pin **while every functional test
> still passes** — the connection would simply re-resolve and still work.
> **Mitigation (a test, not a sentence):** a fence that asserts (a)
> `"_host" not in inspect.getsource(smtplib.SMTP.connect)` and (b)
> `"sni_hostname" in inspect.getsource(httpcore._async.connection)`, each with its own
> positive control. **Trigger:** any Python or httpx version bump in `requirements.txt`.

*Sources:* [encode/httpx Discussion #2811](https://github.com/encode/httpx/discussions/2811) ·
[PrefectHQ/prefect PR #21591 — DNS-rebinding TOCTOU fix in `validate_restricted_url`](https://github.com/PrefectHQ/prefect/pull/21591) ·
CPython 3.12.6 `smtplib` source, read in `backend/venv`.

## R11. Slack Web API `chat.postMessage`

*Source: [docs.slack.dev/reference/methods/chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage)*

| Item | Value |
|---|---|
| Method / URL | `POST https://slack.com/api/chat.postMessage` — **the host is a module constant (D-02)** |
| Content-Type | `application/json` or `application/x-www-form-urlencoded` |
| Auth | `Authorization: Bearer xoxb-…` (HTTP header; a POST `token` param is also accepted — **use the header**, so the token never lands in a body that could be logged, per D-08) |
| Required scope (bot) | `chat:write`. Add `chat:write.public` to post to a public channel the bot has not joined; `chat:write.customize` only for `username`/`icon_*` overrides — **190 needs neither** |
| Required args | `channel` (channel ID / private group ID / IM id) + message content (`text`) |
| Rate limit | ~**1 message per second per channel**, with "generous burst"; workspace-level limits above that |

### ⚠ **THE TRAP — and it must be a named threat, not a note**

> Errors return **HTTP 200** with a JSON body `{"ok": false, "error": "<code>"}`.

**A naive `resp.raise_for_status()` reads `channel_not_found` / `not_authed` / `missing_scope`
/ `rate_limited` / `invalid_auth` as SUCCESS.** On the one surface in this app whose entire
discipline is not over-claiming (D-31: *"A phase reads 'Complete' for a send that did not
leave the app"*), that is a **shipping-grade defect**, and it is the single most likely way
190 ships a lie.

**The adapter contract: a Slack send is successful iff `resp.status_code == 200 AND
json()["ok"] is True`.** Anything else fails the phase (D-17 → `failed`).
Common `error` codes to surface verbatim (sketch 156's 071-A verbatim-provider-error rule):
`channel_not_found` · `not_authed` · `invalid_auth` · `missing_scope` · `rate_limited` ·
`no_text` · `invalid_blocks` · `too_many_attachments`.

## R12. Jira Cloud REST v3 `POST /rest/api/3/issue`

*Sources: [Jira Cloud platform REST API v3 — Issues](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/) ·
[Basic auth for REST APIs](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/) ·
[Jira Cloud REST API v3 intro](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)*

### Auth — basic, and passwords are deprecated

> The username is the **email address** of the Atlassian account; the password is an **API
> token**, not the account password. Build `email:api_token`, **base64-encode it**, and send
> `Authorization: Basic <encoded>`.
> Atlassian states explicitly: *"Authentication using passwords has been deprecated."*

`httpx` builds this for you: `auth=(account_email, api_token)`. **Do not hand-roll the base64.**

### ADF vs plain text — **ANSWERED: v3 requires ADF for `description`**

> *"Version 3 of the API provides support for the Atlassian Document Format (ADF), including
> in issue resources."* The `description` field takes an ADF **object**, not a string.

**Minimal ADF paragraph — the whole thing 190 needs:**

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    { "type": "paragraph",
      "content": [ { "type": "text", "text": "simple short description" } ] }
  ]
}
```

**Recommendation: build ADF programmatically from the composed plain text — a single
`paragraph` node per line — and NEVER accept an ADF object from the author.** Two reasons that
are both D-32 fences: (a) accepting arbitrary ADF is a rich-content injection surface into a
third-party renderer; (b) a per-field ADF authoring affordance is exactly the "per-field
templating surface" D-09 rules out. The plain-text→ADF converter is ~10 lines, is a pure
function, and is trivially fenced.

**Minimal create payload:**

```json
{ "fields": {
    "project":   { "key": "PROJ" },
    "issuetype": { "name": "Task" },
    "summary":   "…",
    "description": { "type": "doc", "version": 1, "content": [ … ] }
} }
```

Required: `project` (key or id), `issuetype` (name or id), `summary`. `description` is
optional but is the whole point of the capability. `project.key` is D-10's non-secret
`config` field.

### Error envelope

Jira returns proper HTTP status codes (400 / 401 / 403 / 404) with a body of the shape
`{"errorMessages": [...], "errors": {"<field>": "<message>"}}`. **So `raise_for_status()` is
correct for Jira and WRONG for Slack** — the adapters genuinely differ, and the plan must not
factor out a shared "check the response" helper that flattens the difference. Surface
`errorMessages` + `errors` verbatim (071-A).

⚠ **Not driven against a live Jira account** — D-30's blocking dependency. Confidence MEDIUM
on the exact error-body shape; HIGH on the ADF requirement and the auth shape (both stated
directly by Atlassian).

## R13. SMTP header injection — **MEASURED: `EmailMessage` ALREADY raises. The defence is architectural, not a regex.**

Driven in `backend/venv` (Python 3.12.6):

```
$ python probe1.py
=== SMTP HEADER INJECTION (empirical) ===
CRLF    RAISED: ValueError -> Header values may not contain linefeed or carriage return characters
LF-only RAISED: ValueError -> Header values may not contain linefeed or carriage return characters
To CRLF RAISED: ValueError -> Header values may not contain linefeed or carriage return characters
```

All three attempts — `Subject` with `\r\n`, `Subject` with a bare `\n`, and `To` with `\r\n` —
**raise `ValueError` at `__setitem__`, before anything is serialised.**

### The correct defence, stated as three properties

1. **Compose with `email.message.EmailMessage` and set headers via `msg["Subject"] = …`.**
   The stdlib guard is the mitigation. **A regex over the subject is the WRONG answer** — it
   duplicates a stronger check, will disagree with it at some edge, and can be widened later.
2. **Never call `smtplib.sendmail(from, to, raw_string)` with a hand-built string.** That
   bypasses `EmailMessage` entirely and is the only way this class reaches the wire. **Use
   `smtp.send_message(msg)`.** ⚠ Add this to the D-05 source fence: the SMTP adapter must
   contain **zero** occurrences of `.sendmail(`.
3. **Validate ENVELOPE recipients separately.** `msg["To"]` is a *header*; the SMTP `RCPT TO`
   envelope is a different channel. Parse each recipient with `email.utils.parseaddr` and
   require a single `local@domain` with no control characters, before it reaches `send_message`.

**The falsification test:** drive a `send_email` with `subject = "Renewal\r\nBcc: attacker@evil.com"`
and assert the phase **fails with a refusal** — not a 500, and above all not a success with a
silently-stripped subject. Then a **positive control** proving the harness would have caught a
successful injection (assert the same string, hand-built into a raw message, *does* produce a
`Bcc:` line — proving the test is measuring something).

## R14. IPv4-mapped IPv6 and the private/reserved set — **the property predicate has FOUR MEASURED HOLES**

**The 185 lesson binds and this is where it bites.** I started from the property-shaped
predicate the prompt asked for — `not ip.is_global` — and drove 29 addresses through it.

### Driven output — the naive property predicate

```
addr                       is_global   REFUSE = not is_global
169.254.169.254            False       True
127.0.0.1                  False       True
10.0.0.1 / 172.16.0.1 / 192.168.1.1    True
100.64.0.1 (CGNAT)         False       True
::1 / fc00::1 / fe80::1    False       True
::ffff:127.0.0.1           False       True     ← Python DOES unwrap ipv4_mapped
::ffff:169.254.169.254     False       True
224.0.0.1  (multicast)     True        FALSE  ← ✗ HOLE 1
64:ff9b::7f00:1 (NAT64)    True        FALSE  ← ✗ HOLE 2  (embeds 127.0.0.1)
::ffff:0:7f00:1 (SIIT)     True        FALSE  ← ✗ HOLE 3  (embeds 127.0.0.1; ipv4_mapped is None)
fec0::1  (site-local)      True        FALSE  ← ✗ HOLE 4
```

Confirmed embeddings:

```
$ python probe5.py
::ffff:0:7f00:1 exploded = 0000:0000:0000:0000:ffff:0000:7f00:0001
  in ::ffff:0:0/96   -> False        ← the IPv4-MAPPED prefix (what ipv4_mapped handles)
  in ::ffff:0:0:0/96 -> True         ← the IPv4-TRANSLATED prefix (SIIT) — Python gives NO accessor
  low32 = 127.0.0.1
64:ff9b::7f00:1     in 64:ff9b::/96 = True  embedded=127.0.0.1        emb.is_global=False
64:ff9b::a9fe:a9fe  in 64:ff9b::/96 = True  embedded=169.254.169.254  emb.is_global=False
```

**Hole 3 is the one that would have shipped.** `::ffff:0:0/96` (mapped) and `::ffff:0:0:0/96`
(translated) differ by one 16-bit group and read almost identically. `ipv4_mapped` returns
`None` for the second. This is precisely CONTEXT D-07's "*`::ffff:127.0.0.1` is the bypass
people forget*" — and there are **two** such forms, not one.

### The corrected predicate — **unwrap, then test** (driven, 29/29 correct)

```python
import ipaddress

_V4_MAPPED     = ipaddress.ip_network("::ffff:0:0/96")     # handled by .ipv4_mapped
_V4_TRANSLATED = ipaddress.ip_network("::ffff:0:0:0/96")   # SIIT — NO accessor in CPython
_NAT64         = ipaddress.ip_network("64:ff9b::/96")      # RFC 6052 well-known prefix
_SITE_LOCAL    = ipaddress.ip_network("fec0::/10")         # deprecated RFC 3879; is_global says True

def _unwrap(ip):
    """Peel every IPv4-embedding form CPython does NOT peel for you."""
    for _ in range(4):                       # bounded: no crafted address can loop us
        if not isinstance(ip, ipaddress.IPv6Address):
            return ip
        if ip.ipv4_mapped is not None:  ip = ip.ipv4_mapped;  continue   # ::ffff:a.b.c.d
        if ip.sixtofour   is not None:  ip = ip.sixtofour;    continue   # 2002::/16
        if ip.teredo      is not None:  ip = ip.teredo[1];    continue   # 2001::/32
        if ip in _V4_TRANSLATED or ip in _NAT64:
            ip = ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF); continue
        return ip
    return ip

def refuse_reason(ip) -> str | None:
    """None == may be connected to. A STRING == the auditable refusal reason (D-08)."""
    if isinstance(ip, ipaddress.IPv6Address) and ip in _SITE_LOCAL:
        return "IPv6 site-local (fec0::/10)"
    u = _unwrap(ip)
    if u.is_multicast:  return "multicast"
    if not u.is_global: return f"not globally routable ({u})"
    return None
```

Driven result over the full 29-case corpus: **every private / loopback / link-local / CGNAT /
multicast / reserved / unspecified / documentation / NAT64 / SIIT / 6to4 / mapped case
REFUSED; `142.250.185.78`, `1.1.1.1`, `2606:4700:4700::1111`, `2a00:1450:4001:800::200e`
ALLOWED.** Confirmed covered by the `is_global` half without an explicit CIDR entry:
`169.254.169.254`, `100.64.0.1`, `0.0.0.0`, `255.255.255.255`, `240.0.0.1`, `198.18.0.1`,
`192.0.0.170`, `2001:db8::1`, `::`, `2002:7f00:1::1`.

**This is the shape the plan must adopt** — and note the honest framing: `is_global` is itself
a table inside CPython, so this is *not* a pure property either. **What makes it defensible is
the corpus, not the predicate.** The corpus is the artefact; each of the four unwrap clauses
must have a driven case that goes RED when its clause is deleted.

### One more measured note — obfuscated literals

```
$ getaddrinfo("2130706433") / ("0x7f.0.0.1") / ("127.1") / ("0177.0.0.1")  → gaierror 11001
$ getaddrinfo("localhost")                                                 → ['127.0.0.1', '::1']
```

On this platform decimal/octal literals do not resolve at all. **Do not rely on that** —
glibc's resolver differs. The guard's structure already covers it: it validates **resolved
addresses**, so an obfuscated literal either fails to resolve (refused) or resolves to a real
IP that is then validated. The property holds either way; say so rather than claiming platform
behaviour.

## R15. Registrable-domain matching — **no new dependency is warranted at this scope**

```
$ python -c "for m in ('idna','tldextract','publicsuffix2','publicsuffixlist','certifi'): …"
  idna AVAILABLE 3.11        tldextract NOT installed
  publicsuffix2 NOT installed  publicsuffixlist NOT installed
  certifi AVAILABLE 2026.02.25
```

**A PSL library is avoidable, and avoiding it is the better answer** — because the three
destinations do not need registrable-domain semantics at all:

| Capability | Rule | Why |
|---|---|---|
| `post_message` (Slack) | **exact equality** with the module constant `slack.com` | D-02 — no user-supplied URL exists |
| `create_ticket` (Jira) | `host == "atlassian.net" or host.endswith(".atlassian.net")` | Atlassian Cloud sites are always `<site>.atlassian.net` |
| `send_email` (SMTP) | **exact equality** with the stored `config.host` | The org configured that exact host; there is no wildcard requirement |

**Driven — the label-boundary check does exactly what "never a substring" means:**

```
slack.com           vs slack.com     -> True
notslack.com        vs slack.com     -> False   ← the substring trap, closed
slack.com.evil.com  vs slack.com     -> False   ← the suffix trap, closed
xxx.atlassian.net   vs atlassian.net -> True
evilatlassian.net   vs atlassian.net -> False
ATLASSIAN.NET       vs atlassian.net -> True    (lowercased first)
atlassian.net.      vs atlassian.net -> True    (trailing dot stripped first)
```

`h = host.lower().rstrip(".")`, then `h == suffix or h.endswith("." + suffix)`. **The
leading dot is the whole mechanism** and its absence is the CVE.

### ⚠ The URL-parsing trap that matters more than the matching

**Match against `httpx.URL(u).host` — NEVER against the raw URL string.** Driven:

```
https://slack.com/api/chat.postMessage        host='slack.com'
https://slack.com@evil.com/api/               host='evil.com'          ← userinfo bypass
https://slack.com:443@evil.com/               host='evil.com'          ← userinfo + port
https://evil.com/?x=https://slack.com         host='evil.com'          ← query bypass
https://evil.com#slack.com                    host='evil.com'          ← fragment bypass
https://notslack.com/api/                     host='notslack.com'
https://slack.com.evil.com/api/               host='slack.com.evil.com'
https://SLACK.COM/api/                        host='slack.com'         ← already lowercased
https://xn--slck-hoa.com/                     host='slåck.com'         ← ⚠ IDNA-DECODED
```

`httpx.URL.host` strips userinfo, drops query/fragment and lowercases — every classic string
bypass dies at the parse. **But the last row is a live trap: `httpx.URL.host` returns the
DECODED unicode form, not the punycode.** A homograph host therefore never matches an ASCII
allow-list entry (safe direction — it refuses), but the plan should make that explicit rather
than accidental: **require `host.isascii()` and refuse otherwise, with its own driven case.**
`idna 3.11` is available if a normalise-then-compare is ever preferred.

---

## Standard Stack

**Nothing new is installed. This phase adds ZERO dependencies.**

### Core (all already present)

| Library | Version (measured) | Purpose | Why standard |
|---|---|---|---|
| `httpx` | **0.28.1** (`requirements.txt: httpx>=0.28.0`) | Jira + Slack transport | The app's only declared HTTP client; the no-egress sentinel already patches it |
| `httpcore` | bundled with httpx | Provides `sni_hostname` for DNS pinning | §R10 — verified present |
| `smtplib` · `ssl` · `socket` · `email` · `ipaddress` | stdlib, Python **3.12.6** | SMTP transport, TLS, IP validation, message composition | §R13/§R14 — the guards the phase relies on ARE the stdlib's |
| `cryptography` (`Fernet` / `MultiFernet`) | via `app/security/secret_cipher.py` | `enc:v1:` credential envelope | D-11 — reuse wholesale, add no crypto |
| `jinja2` `SandboxedEnvironment` | `template_render_service.py:657`, `tool_dispatcher.py:2473` | SSTI containment | D-09 — CONN-03 SC#3 is a **fence over this**, not new work |
| `certifi` | **2026.02.25** | CA bundle for `ssl.create_default_context()` | Already installed |
| `idna` | **3.11** | Only if IDNA normalisation is chosen over ASCII-refusal | Already installed |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| explicit resolve-then-connect wrapper | `httpx.AsyncHTTPTransport` subclass | Makes the guard implicit; D-06 needs the ordering **assertable**; and `smtplib` has no transport concept, so you would need the wrapper anyway |
| `endswith("." + suffix)` | `tldextract` / `publicsuffixlist` | New dependency, a bundled PSL snapshot that rots, a slopcheck surface — for zero benefit at three fixed destinations (§R15) |
| a plain-text Jira description | author-supplied ADF | Rich-content injection into a third-party renderer + a per-field authoring affordance D-09 forbids |
| `slack_sdk` | first-party `httpx` call | Would construct its own client, breaking D-05's source fence outright, and is a net-new dependency for one POST |

### Package Legitimacy Audit

**NOT APPLICABLE — this phase installs zero external packages.** Every library named above is
already in `backend/requirements.txt` or the Python 3.12 standard library, and each version
above was read from the **installed** venv, not from a registry. No `pip install` line appears
anywhere in this research. If the planner finds itself writing one, that is a scope change and
the audit table becomes mandatory.

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌──────────── AUTHOR TIME ────────────┐
  Settings ─────────►  POST /connectors/connections        │
  → Connections      │    ├─► get_cipher()  ──► None? ─────┼──► ✕ REFUSE (D-11 fail-CLOSED)
  (sixth tab,        │    └─► encrypt_secret(pw, cipher)   │      sketch 156 moment 9
   sketch 155-C)     │        └─► connector_connections    │      (Save DISABLED)
                     │            org_id · created_by      │
                     │            RLS: current_user_org_ids│
                     └─────────────────┬───────────────────┘
                                       │ id only
  Canvas ──► ExternalActionSection ──► ConnectionPicker ──► GET /connectors/connections?capability=
   (unchanged)      (+1 import,+1 JSX)  (NEW child: owns    │
                                         fetch + store)     ▼
                                                 definition JSONB gains
                                                 connection_id  ── NO secret, NO host (SC#4)
                                                            │
  ═══════════════════════════ RUN TIME ═════════════════════▼════════════════════════
                                                            │
  harness_engine._run_phase_with_gates                       │
      ├─ armed action-risk checkpoint (structural, D-04)     │
      │     └─ ctx.is_golden_run? ─► skip the PAUSE (D-19, shipped)
      ▼
  _exec_external_action(phase, accumulated_outputs, ctx)
      │
      ├─ ❶ D-16 GATE ── getattr(ctx,"is_golden_run",False) ─► TRUE ─► skip SEND
      │                                                              record ONLY (one composer)
      ├─ ❷ D-26 kill-switch OFF ────────────────────────────► skip SEND ─► recorded_not_sent
      ├─ ❸ no connection_id ────────────────────────────────► skip SEND ─► recorded_not_sent (D-17)
      │
      ├─ ❹ ═══ security/egress.validate(capability, destination) ═══  ⚠ BEFORE ❺ (D-06)
      │        1 scheme (https / TLS only)     2 host label-boundary match
      │        3 getaddrinfo → refuse_reason() over EVERY answer (§R14)
      │        4 redirects OFF                 5 pin (ip, sni_hostname, port)
      │        6 timeout + response-size cap
      │        └─ refusal → log capability + HOST + reason ONLY (D-08)
      │
      ├─ ❺ connector_service.resolve(connection_id, RUN'S org_id)  ⚠ NEVER id alone (D-14)
      │        └─ decrypt_secret(row.secret_ciphertext, cipher)   cipher None ─► REFUSE
      │
      └─ ❻ ConnectorAdapter.send(pinned_triple, secret, args)
               ├─ SMTP  ─► SMTP_SSL(ctx); _host=hostname; connect(ip,port); send_message(msg)
               ├─ Jira  ─► POST https://<ip>/rest/api/3/issue  Host:+sni_hostname  raise_for_status()
               └─ Slack ─► POST https://<ip>/api/chat.postMessage  ⚠ success iff 200 AND ok:true
                         │
                         └─► harness_audit  event_type='external_action_sent'  (migration 117)
                              status: completed | failed  (D-17 — ZERO new statuses)
```

### Recommended structure

```
backend/app/security/
├── secret_cipher.py            # SHIPPED — reuse, do not extend SECRET_COLUMNS
└── egress.py                   # NEW — the ONLY module that may open a connector socket
backend/app/services/connectors/
├── __init__.py
├── registry.py                 # keyed off EXTERNAL_ACTION_CAPABILITIES + static assert (D-04)
├── protocol.py                 # ConnectorAdapter — MCP-SHAPED (D-01)
├── smtp_adapter.py             # ZERO direct socket/smtplib construction — via egress only
├── jira_adapter.py
└── slack_adapter.py            # SLACK_API_BASE = "https://slack.com/api/" — code constant
backend/app/services/connector_service.py   # resolve(connection_id, org_id) — org-SCOPED (D-14)
frontend/src/components/workflows/
├── ExternalActionSection.tsx   # +1 import, +1 JSX line. Six purity fences STAY GREEN.
└── ConnectionPicker.tsx        # NEW — owns the fetch + the store write (§M4)
frontend/src/pages/settings/     # sixth tab (sketch 155-C) + push/split panel (sketch 156-A)
supabase/migrations/
├── 116_connector_connections.sql        # table + RLS + indexes + autofill trigger
└── 117_harness_audit_external_action_sent.sql   # ONE literal, 23 → 24
```

### Pattern 1: One module owns one dangerous thing (D-05)

**What:** `egress.py` is to sockets what `secret_cipher.py` is to `Fernet` — the single home.
**Enforced by:** a source fence walking `backend/app/services/connectors/**` for `httpx.`,
`requests.`, `smtplib.`, `urllib.request`, `socket.` and requiring **zero**, plus (new,
from §R13) `.sendmail(`. Same shape as `test_189_no_egress.py` Case A, **written RED first**
against a deliberately planted direct client.

### Pattern 2: The guard runs BEFORE credential resolution (D-06 — the n8n CVE class)

**What:** step ❹ strictly precedes step ❺ in the diagram above.
**Why it must be asserted DIRECTLY:** the ordering is invisible in any test that binds a
credential. Drive a send with **no credential bound at all** and assert the failure is the
**egress refusal**, not `MissingCredential`. If the credential error arrives first, the guard
is one line-reorder away from being bypassable.

### Pattern 3: Fail-CLOSED at both ends of the cipher (D-11)

`get_cipher() is None` refuses the **write** (no plaintext tenant credential is ever stored)
**and** the **read** (a stored `enc:v1:` with no key is a refusal, not a passthrough).

### Anti-Patterns to Avoid

- **A shared `_check_response()` helper across Jira and Slack.** Slack succeeds on
  `200 + ok:true`; Jira on `raise_for_status()`. Flattening them ships the "Complete for a
  send that did not leave the app" defect (D-31).
- **A regex over the Subject line for `\r\n`.** §R13 — the stdlib already raises; a regex is a
  weaker duplicate that will be widened later.
- **A CIDR deny-list.** §R14 — the 185 lesson. Unwrap-then-test with a driven corpus.
- **Putting the connection fetch inside `ExternalActionSection.tsx`.** §M4 — six shipped fences
  go RED, and the alternative (a child component) is strictly cheaper.
- **A fourth capability, "just to make the registry generic".** D-04 / D-32.
- **Following redirects "because the library defaults to off".** Set it explicitly; a default
  is not a guarantee.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Private/reserved IP classification | a CIDR table | `ipaddress` + the §R14 unwrap chain | Four measured holes in the naive version; a hand-typed table would have more |
| Basic-auth header for Jira | manual base64 | `httpx` `auth=(email, token)` | Correct encoding, no secret in a hand-built string that could be logged |
| TLS cert verification against a pinned IP | manual `ssl` wrapping | httpx `extensions["sni_hostname"]`; smtplib `_host` + `connect(ip)` | §R10 — both preserve SNI **and** hostname verification for free |
| Email MIME + header safety | string concatenation | `email.message.EmailMessage` + `smtp.send_message` | §R13 — the injection guard is the stdlib's, and it is stronger than yours |
| Credential encryption | new `Fernet` | `secret_cipher.encrypt_secret` / `decrypt_secret` | D-11; "no `Fernet(...)` is constructed anywhere else in the app" |
| Org scoping in SQL | a bespoke predicate | `current_user_org_ids()` + `autofill_org_id_by_owner('created_by')` | §M8 — every sibling table already carries these |
| Registrable-domain matching | a PSL bundle | `httpx.URL(u).host` + label-boundary `endswith` | §R15 — a new dependency for zero benefit at three fixed destinations |
| Template composition | a new expression language | the shipped `SandboxedEnvironment(autoescape=True)` | D-09 — SC#3 is a **fence over** this, and the plan must SAY it proved rather than built |

**Key insight:** every dangerous primitive this phase needs already exists, hardened, in this
codebase or the standard library. **The phase's real work is ORDERING and SCOPING** — the
guard before the credential (D-06), the org before the id (D-14), the golden-run check before
the send (D-16). Those three orderings are what the tests must assert, because no amount of
library quality makes an ordering correct.

---

## Common Pitfalls

### Pitfall 1: Slack's HTTP 200 on failure
**What goes wrong:** `resp.raise_for_status()` passes; the phase reads `completed`; nothing was
posted. **Why:** Slack's Web API signals errors in the body, not the status line. **Avoid:**
success iff `200 AND json()["ok"] is True`. **Warning sign:** a green UAT row with no message in
the channel — which is exactly what D-30's throwaway channel exists to catch.

### Pitfall 2: `::ffff:0:7f00:1` (IPv4-**translated**) vs `::ffff:127.0.0.1` (IPv4-**mapped**)
**What goes wrong:** you call `.ipv4_mapped`, get `None`, fall through to `is_global` → `True`,
and connect to loopback. **Why:** two prefixes one group apart; CPython gives an accessor for
only one. **Avoid:** §R14's `_unwrap`. **Warning sign:** a guard suite with only one
IPv4-in-IPv6 case in it.

### Pitfall 3: The Windows proactor self-pipe fires the socket sentinel
**What goes wrong:** the no-egress fence fails in `proactor_events._make_self_pipe` instead of
in the executor. **Avoid:** build the loop **before** `_block_all_http(monkeypatch)` — already
recorded verbatim at `test_harness_engine.py:1143-1148`.

### Pitfall 4: Quoting a count-gate pin instead of running the gate
**What goes wrong:** the plan pins `ExternalActionSection.test.tsx` at 25; it runs 34; the plan's
arithmetic is wrong from task 1. **Why:** the gate only fails on a *decrease*, so drift is
silent. **Avoid:** `node scripts/vitest-count-gate.cjs` and read the printed number. §M2.

### Pitfall 5: Adding the connector secret to `SECRET_COLUMNS`
**What goes wrong:** `main.py`'s boot sweep iterates one `app_settings` row; a per-org per-row
table cannot be swept that way, and the attempt either no-ops silently or errors at boot.
**Avoid:** encrypt at write, decrypt at call time. D-11 says this; §M7 confirms the mechanism.

### Pitfall 6: Assuming `PhaseFormPanel.tsx` can gain "just one prop"
**What goes wrong:** the picker needs a write seam for `connection_id`; `onChange={set("capability")}`
is key-bound; a fourth prop makes the numstat non-zero and D-23 fails on its own terms.
**Avoid:** the child-component resolution in §M4.

### Pitfall 7: A closure round that adds a capability (G-7)
**What goes wrong:** a review finding in this phase's own morning code becomes a new surface.
**Avoid:** run `node scripts/check-gap-closure-rounds.cjs 190` at all three points CLAUDE.md
names. Given this phase's `threats_open: 0` gate, a capability smuggled into a closure round
would ship un-threat-modelled.

---

## Runtime State Inventory

**Not a rename/refactor phase — but it CREATES runtime state, so the inventory is inverted and
still worth stating.**

| Category | Items | Action |
|---|---|---|
| Stored data | `connector_connections` rows (net-new, mig 116) carrying `enc:v1:` ciphertext | Nothing to migrate — the table does not exist yet. ⚠ Rows are created on the **local** DB only; cloud parity is owed (§D-22) |
| Live service config | **NET-NEW and OWED at deploy:** a Slack app + bot token, a Jira API token, an SMTP account. None exists in git, none exists in cloud. This IS D-30's blocking dependency | Operator provides one throwaway destination per capability |
| OS-registered state | None — verified: no scheduler, no daemon, no supervised process is added (D-18: no queue, no retry) | None |
| Secrets/env vars | `SECRETS_ENCRYPTION_KEY` — **reused, unchanged** (ROADMAP flag + D-11). ⚠ It is already on the owed-cloud-parity list and 190 now makes it **load-bearing rather than optional** | Confirm it is set in cloud **before** 190 deploys, or connector creation refuses (correctly) in production |
| Build artifacts | None — zero new dependencies (§Standard Stack), so `Dockerfile.sandbox` and `SANDBOX_IMAGE` are **untouched** and `docs/SANDBOX-PACKAGES.md` needs no sync | None |
| Deploy artifacts | ⚠ **If 190 reads ANY new env var**, `scripts/check-deploy-drift.sh` hard-fails unless `deploy/onebox.env.example` + `docs/OPERATOR.md` Step-3 + `docker-compose.prod.yml` land **in the same commit** (or the var is registered in `OMITTED_FROM_ONEBOX` with a one-word reason) | **Recommendation: read NO new env var.** All connector config belongs in `connector_connections`, per the shipped settings-vs-env boundary. Then the drift check is a no-op. |
| Cloud parity queue | migrations **099 → 115** owed; 190 appends **116** and **117** | Named, not resolved, by this phase |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Python | everything | ✓ | 3.12.6 (`backend/venv`) | — |
| `httpx` | Jira + Slack | ✓ | 0.28.1 | — |
| `httpcore` `sni_hostname` | DNS pinning (HTTP) | ✓ | verified in-venv | — |
| `smtplib` `_host` pin property | DNS pinning (SMTP) | ✓ | `connect()` does not assign `_host` — measured | Record RESIDUAL-190-01; connect by hostname (loses the pin) |
| `certifi` | TLS verification | ✓ | 2026.02.25 | — |
| `idna` | homograph normalisation (optional) | ✓ | 3.11 | ASCII-only refusal |
| `cryptography` / `MultiFernet` | `enc:v1:` | ✓ | via `secret_cipher` | — |
| `SECRETS_ENCRYPTION_KEY` (local) | storing a connection | **UNVERIFIED** | — | If unset locally, D-11's fail-CLOSED fires and **no connection can be created** — this blocks local UAT. **Verify before Wave 1.** |
| Local Supabase :54322 | migrations 116/117 | assumed ✓ (CLAUDE.md) | — | — |
| A real SMTP mailbox | `send_email` live UAT | **✗** | — | **NO fallback.** Row is ⛔ *awaiting operator-provided destination* (D-30) |
| A real Jira project + API token | `create_ticket` live UAT | **✗** | — | **NO fallback.** ⛔ (D-30) |
| A real Slack workspace + `xoxb-` token | `post_message` live UAT | **✗** | — | **NO fallback.** ⛔ (D-30) |

**Missing dependencies with no fallback:** the three live destinations (D-30). They block
**phase closure**, not planning or implementation — every adapter is testable against a local
stub, and every security property is testable without a real destination. The phase may close
with these rows owed **as a stated DECISION**, never as a claim that everything ran.

**Missing dependencies with fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value (measured) |
|---|---|
| Backend framework | `pytest`; `backend/pytest.ini` → `testpaths = tests` |
| Frontend framework | `vitest` + jsdom; `frontend/vitest.config.ts`; `npm test` → `vitest run` |
| Frontend count gate | `scripts/vitest-count-gate.cjs` — **48 pinned files; running total 2727 vs pinned 2714; failed 0** |
| Typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` → **33 errors (baseline)**. ⚠ Without `-p tsconfig.app.json` it checks ZERO files |
| Quick run (backend) | `python -m pytest tests/unit/test_190_egress.py tests/unit/test_190_connector_service.py -x -q` |
| Quick run (frontend) | `npx vitest run src/components/workflows/ConnectionPicker.test.tsx` |
| Full suite (backend) | `python -m pytest tests/ -q` |
| Full suite (frontend) | `npm test` **then** `node scripts/vitest-count-gate.cjs` |

**Measured pre-190 baselines to pin against:**
`tests/unit/test_189_no_egress.py` + `test_189_external_action_model.py` +
`test_audit_event_registration.py` + `test_publish_service.py` → **67 passed** ·
`tests/test_harness_engine.py` → **46 passed** · `tsc -p tsconfig.app.json` → **33** ·
count gate → **2727 running / 2714 pinned / 0 failed / 48 files**.

### Wave 0 — THE THREE RED TESTS, before any adapter exists

CONTEXT `<specifics>` is explicit: *"Both are latent defects that this phase's own commit
creates… Plan them into Wave 0, RED, before any adapter exists."* There are **three**, because
D-06 has the same shape.

| # | Test | Property | How it goes RED first |
|---|---|---|---|
| **W0-1** | `test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress` | **D-16** — publishing must not send | **ALREADY EXISTS AND ALREADY PASSES.** It goes RED on the commit that adds the send. **Drive it RED, then land the `getattr(ctx,"is_golden_run",False)` gate in the SAME commit and drive it green.** Do not route around it, do not pre-emptively gate. The RED observation IS the evidence. |
| **W0-2** | `tests/unit/test_190_cross_org_credential.py` | **D-14** — a definition in org A carrying a `connection_id` owned by org B must NOT resolve | Author the resolver **id-only** first (`SELECT … WHERE id = $1`), drive a real run, **observe the leak** (the send succeeds using org B's credential), then land `WHERE id = $1 AND org_id = $2` and observe the refusal. An id-only `SELECT` passes every ordinary test — SEED-124/mig 110 and SEED-125/mig 112 are the two precedents. |
| **W0-3** | `tests/unit/test_190_egress_ordering.py` | **D-06** — the guard runs BEFORE credential resolution, unconditionally | Drive a send with **no credential bound at all** and assert the raised error is the **egress refusal**, not `MissingCredential`. RED-first by writing the resolver call **before** the guard call, observing the wrong error, then reordering. |

### The security falsification set (D-28) — every threat, its test, and its RED plant

**Each row must be OBSERVED RED against a real plant in production source**, then the plant
restored md5-identical with `grep -c PLANT` → 0 (the shipped 189 idiom).

| # | Threat (D-28) | STRIDE | Falsifying test | The plant that must turn it RED |
|---|---|---|---|---|
| T1 | SSRF via org-configured host | Tampering | drive `create_ticket` with `config.base_url = https://169.254.169.254/` → expect refusal naming the host | delete the `refuse_reason` call from the validator |
| T2 | DNS rebinding / TOCTOU | Tampering | resolver stub returns a public IP on call 1 and `127.0.0.1` on call 2; assert the socket went to the **call-1** IP | replace `url.copy_with(host=ip)` with the hostname URL |
| T3 | Redirect-based bypass | Tampering | stub a 302 → `http://169.254.169.254/`; assert the client does **not** follow | flip `follow_redirects=True` |
| T4 | Cloud metadata endpoint | Info disclosure | the §R14 corpus, `169.254.169.254` + `::ffff:169.254.169.254` + `64:ff9b::a9fe:a9fe` | delete each `_unwrap` clause **individually** — four separate RED observations |
| T5 | Credential leak in logs | Info disclosure | drive a refusal and a failure; assert the secret substring appears **zero** times in captured logs, with a positive control proving the capture works | log the resolved row instead of `row["id"]` |
| T6 | Credential leak in the definition JSONB | Info disclosure | after binding + publishing, assert `workflow_definitions.definition` contains `connection_id` and **no** secret/host/token key | write `config["smtp_password"]` in the picker |
| T7 | Credential leak in an SSE / API response | Info disclosure | assert `GET /connectors/connections` returns no `secret_ciphertext`, and no `phase_*` SSE frame carries one | add `secret_ciphertext` to the response model |
| T8 | **Cross-org credential resolution (D-14)** | Elevation | **W0-2** | id-only `SELECT` |
| T9 | SSTI via a composed field | Tampering | a field containing `{{7*7}}` / `{{''.__class__}}` renders literally, not evaluated | swap `SandboxedEnvironment` for `Environment` |
| T10 | **Publish-time egress (D-16)** | Tampering | **W0-1** | remove the `is_golden_run` gate |
| T11 | Unbounded response / decompression | DoS | stub a 100 MB / gzip-bomb response; assert the read is capped and the phase fails cleanly | remove the size cap |
| T12 | **SMTP header injection** | Tampering | §R13 — `subject = "Renewal\r\nBcc: attacker@evil.com"` → refusal (not 500, not silent strip); **plus a positive control** proving a hand-built raw message *would* have produced a `Bcc:` line | replace `send_message(msg)` with `sendmail(f, t, raw)` |
| T13 | *(NEW — not in D-28)* **Slack `ok:false` read as success** | Repudiation | stub `200 {"ok":false,"error":"channel_not_found"}`; assert the phase lands **`failed`**, never `completed` | check only `resp.status_code` |
| T14 | *(NEW — not in D-28)* **Host userinfo / homograph bypass** | Spoofing | `https://slack.com@evil.com/`, `https://slack.com.evil.com/`, `https://notslack.com/`, `https://xn--slck-hoa.com/` all refused | match against the raw URL string instead of `httpx.URL(u).host` |

**T13 and T14 are net-new findings from this research and should be added to D-28's minimum
list at plan-phase.** T13 in particular is the most likely way this phase ships a lie.

### Source fences (empty-diff and zero-occurrence)

| Fence | Assertion | Positive control |
|---|---|---|
| **D-05** | `backend/app/services/connectors/**` contains **zero** occurrences of `httpx.`, `requests.`, `smtplib.`, `urllib.request`, `socket.`, **and `.sendmail(`** | plant a direct `httpx.AsyncClient()` in a real adapter file, observe RED, restore md5-identical, `grep -c PLANT` → 0 |
| **D-23** | `git diff --numstat HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` reads **`0 0`** | — (a numstat fence is self-evidencing) |
| **D-24** | `git diff --numstat` reads **`0 0`** for `PhaseNode.tsx`, `PhaseNodeCard.tsx`, **and the six fenced card-subtree modules** (`phaseNodeCardContract.ts`, `ownProperty.ts`, `NodeCornerMarks.tsx`, `NodeRunOverlay.tsx`, `NodeIconWell.tsx`, plus `PhaseNodeCard.tsx` itself) | — |
| **§M4** | `ExternalActionSection.test.tsx`'s six purity fences still pass **after** the `ConnectionPicker` mount line lands | the fences already carry their own positive controls (`:398-412`) |
| **§M3** | `phaseVocabulary.ts` still has **zero** import statements after the D-24 line edit | plant `import x from "y"`, observe RED |
| **D-04** | the adapter registry's key set `==` `EXTERNAL_ACTION_CAPABILITIES` (a module-scope `assert`, derived — **never a re-typed list**) | plant a 4th key, observe the `assert` fire at import |
| **RESIDUAL-190-01** | `"_host" not in inspect.getsource(smtplib.SMTP.connect)` **and** `"sni_hostname" in inspect.getsource(httpcore._async.connection)` | assert each pattern matches a planted literal |

### SC#10 — the 8-row cross-provider scoreboard

**The roster is DERIVED, never re-typed.** Measured:

```
$ python -c "from app.config import MODEL_CAPABILITIES; …group by provider…"
TOTAL model ids: 61  providers: 8
  anthropic  n=7    deepseek n=2    google  n=7    minimax n=8
  moonshot   n=3    openai   n=17   openrouter n=9  zhipu   n=8
```

Exactly the eight CLAUDE.md's roster rule names. **Derive one representative per provider at
plan-time by grouping `MODEL_CAPABILITIES` — prefer the newest, and prefer a registry-backed id**
(an id absent from the registry resolves `capability_source=inferred` and silently loses
`emit_tier`, measuring a weaker configuration than the one that ships — SEED-040 / SEED-135).

**What each row exercises:** a **published workflow containing an `external_action` step, run
end to end**, per provider. A connector step is not an LLM step, so the row proves the
*surrounding run* is provider-correct while the step itself sends.

**The measured method (§M1):** `POST /threads/{thread_id}/messages` with
`{content, model, provider, workflow_definition_id}` — **no global setting is mutated.**
Verdicts read from `workflow_runs` / `workflow_phases` / `harness_audit`.

**The measured cost:** the per-thread anchor takes a **409 lock**
(`workflow_kickoff.py:146-173`), so **8 rows need 8 DISTINCT THREADS to run in parallel; two
rows on one thread are serial.** Stated here so it is a plan input, not a mid-UAT discovery.

**⛔ rows, never silent omissions.** Any provider with no key configured, or blocked by a
known defect, is recorded ⛔ with the reason and the blocking issue id.

### D-30 — the blocking operator dependency

The three live-send rows require a **throwaway mailbox, a Jira project and a Slack channel**.
Until the operator supplies them, each is:

> ⛔ **awaiting operator-provided destination (D-30)** — the adapter is unit-proven against a
> stub; what is unproven is that a real message arrives.

**The phase may legitimately close with these owed** — but **as a DECISION, stated in the
ROADMAP progress row and `STATE.md`, naming which row to run first.** Never as a claim that
everything ran. Recommended first row: **`post_message` (Slack)** — it needs only a bot token
and a channel id, its host is a code constant so it has the smallest SSRF surface, and it is
the one row that falsifies **T13**, the likeliest shipped defect.

### The other three SC#10 axes (CLAUDE.md UAT recipe)

| Axis | Required row |
|---|---|
| Multi-tool | a workflow with `retrieve` (KB) **+** `external_action` in one run |
| Parallel-thread | Thread A streaming a workflow run while Thread B accepts a new prompt (409-safe: different threads) |
| Long-message | ≥ 50 prior messages **or** a ≥ 5 KB prompt on a thread that then kicks off a connector workflow |

### The demo sentence (CONTEXT `<specifics>`) — both halves are UAT rows

> *"a published workflow paused for approval, the operator approved, and an email actually
> arrived — and the same workflow, with the connection unbound, still says 'Not sent —
> recorded' rather than pretending."*

Row **A** is the send. Row **B** is `recorded_not_sent` on the **same definition** with the
connection unbound (D-17). **Row B is not optional** — it is the half competitors do not have,
and it is the only row that proves D-17's terminal survived the phase that made sending real.

### Wave 0 gaps

- [ ] `backend/tests/unit/test_190_egress.py` — the §R14 corpus (29 driven addresses), scheme,
      host label-boundary (§R15), redirect, pin, size cap. Covers T1–T4, T11, T14.
- [ ] `backend/tests/unit/test_190_egress_ordering.py` — **W0-3** (D-06). RED first.
- [ ] `backend/tests/unit/test_190_cross_org_credential.py` — **W0-2** (D-14). RED first.
- [ ] `backend/tests/unit/test_190_connector_source_fence.py` — D-05, with a planted positive control.
- [ ] `backend/tests/unit/test_190_credentials.py` — D-11 fail-CLOSED at both write and read; T5–T7.
- [ ] `backend/tests/unit/test_190_smtp_header_injection.py` — T12, with the positive control.
- [ ] `backend/tests/unit/test_190_slack_ok_false.py` — **T13**.
- [ ] `frontend/src/components/workflows/ConnectionPicker.test.tsx` — **registered with
      `scripts/vitest-count-gate.cjs` in the SAME commit that creates it** (the shipped rule).
- [ ] Re-run of `ExternalActionSection.test.tsx`'s six purity fences post-mount (§M4).
- [ ] **No framework install needed** — pytest and vitest are both configured.

---

## Security Domain

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no (to us) / **yes (outbound)** | Static tokens per D-03. Bearer (Slack), Basic email:token (Jira), SMTP AUTH over TLS. No OAuth (D-03/D-32) |
| V3 Session Management | no | 190 adds no session surface |
| V4 Access Control | **yes** | Org-scoped RLS (§M8) **+** the application org filter at the resolver (D-15). ⚠ The harness engine runs on the BYPASSRLS pool, so **the app filter is the real gate and RLS is the backstop** — the plan must say which applies at each call site |
| V5 Input Validation | **yes** | Pydantic `_StrictBase` (`extra='forbid'`) for `connection_id`; `httpx.URL` for host extraction; `email.utils.parseaddr` for recipients; the closed `Literal` for `capability` |
| V6 Cryptography | **yes** | `MultiFernet` via `secret_cipher` — **no new crypto**, and the fail-CLOSED inversion at `get_cipher() is None` |
| **V12 / V13 (SSRF)** | **yes — the headline** | `egress.py`: scheme → host → resolved-IP property → redirects off → pin → timeout/size cap. §R14 |
| V7 Error handling & logging | **yes** | D-08 — refusals log capability + host + reason **only**; never the secret, never the body. Inherits `secret_cipher`'s "column NAMES + counts only" discipline |
| V9 Communications | **yes** | TLS required everywhere; `ssl.create_default_context()`; hostname verification preserved **through** the pin (§R10) |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| SSRF to cloud metadata | Info disclosure | §R14 unwrap-then-test over **every** resolved address |
| DNS rebinding (TOCTOU) | Tampering | §R10 pin-to-validated-IP, both transports |
| Redirect-based post-validation bypass | Tampering | `follow_redirects=False`, set **explicitly** |
| SMTP header injection | Tampering | §R13 — `EmailMessage` + `send_message`; **never `.sendmail()` with a raw string** |
| Cross-tenant credential access | Elevation | §M8 RLS + the run-org application filter (D-14/D-15) |
| Credential in a definition / SSE / log | Info disclosure | D-13 stores a **reference**; D-08 logging discipline |
| SSTI in a composed field | Tampering | Shipped `SandboxedEnvironment(autoescape=True)` — **fenced, not built** (D-09) |
| Vendor-error-read-as-success | Repudiation | **T13** — Slack `ok:false` at HTTP 200 |
| Publish-time side effect | Tampering | **D-16 / W0-1** |
| Response/decompression DoS | DoS | size cap + timeout on every call |

### The 185 lesson, applied literally

> *A deny-list cannot be made fail-closed by extension — verify the PROPERTY, not the PATCH.*

§R14 is that lesson **enacted and then found insufficient on its own**: even the property
predicate (`is_global`) needed four measured corrections, and the fourth was found only by
driving a case. **The plan's defensible artefact is the CORPUS, not the predicate.** Each of
the four unwrap clauses gets its own driven case that goes RED when that clause is deleted.

---

## Project Constraints (from CLAUDE.md)

| Directive | How 190 complies |
|---|---|
| Python backend must use `venv` | All probes run through `backend/venv/Scripts/python.exe` |
| **No LangChain, no LangGraph — raw SDK calls only** | Three first-party adapters over `httpx` / `smtplib`. No connector SDK. |
| Pydantic for structured outputs | `ExternalActionPhaseConfig` (`_StrictBase`) gains one optional field (D-13) |
| **All tables need RLS** | Migration 116 carries four policies mirroring §M8 |
| Stream chat responses via SSE | Unchanged; `phase_recorded_not_sent` keeps its meaning (D-17) |
| **No blocking I/O in async handlers** | ⚠ **`smtplib` IS BLOCKING.** The SMTP adapter **must** be wrapped in `run_in_threadpool` (or `asyncio.to_thread`) — decision D-v2.5-01. `httpx.AsyncClient` is fine. **This is a real, easily-missed defect and belongs in the plan's acceptance criteria.** |
| Multi-worker uvicorn (`WORKER_COUNT=2`) | No new singleton is introduced (D-PRD-12 audit) — the adapters are stateless |
| **Settings live in `user_settings`/`app_settings`; env is for secrets and infra only** | Connector config lives in `connector_connections`; **no new env var** (see Runtime State Inventory) |
| Migrations: `<digits>_name.sql`, apply via SQL editor, then `regenerate-full-schema.sh` (no `--reset`), commit both, **never `db push`/`db reset`** | D-21. **`116b` would be silently skipped** — 116 and 117, no letter suffixes |
| Deployment-artifact same-commit parity (`check-deploy-drift.sh`) | Trivially satisfied **if no new env var is read** (the recommendation) |
| Sandbox image / `docs/SANDBOX-PACKAGES.md` sync | **Untouched** — zero new packages |
| Provider-docs-first | §R11 (Slack's own docs), §R12 (Atlassian's own docs), §R10/§R13/§R14 (driven against the installed stdlib, not convention) |
| Reported-bugs cross-check at plan-phase | ✓ see below |
| G-2 sketch before plan for UX | **SATISFIED** — sketches 155-C and 156-A shipped 2026-08-08 |
| G-5 hot-file ledger | ✓ see below |
| G-7 gap-closure round cap | `node scripts/check-gap-closure-rounds.cjs 190` at all three points |
| UAT scoreboard SC#10 | §Validation Architecture — 8 rows derived from `MODEL_CAPABILITIES` |

### Reported-bugs cross-check (CLAUDE.md MANDATORY, `/gsd:plan-phase` touchpoint)

The rule: *"Verify every report with `folded_into: 190` is actually addressed by at least one
plan task."* Per CONTEXT `<deferred>`, **no report is folded into 190** — BUG-260808-02 is
DEFERRED with a named trigger; the WR-04 pair (BUG-260807-01, BUG-260808-01) is left open.

⚠ **CONTEXT's actionable note, restated because it is time-sensitive:** the two WR-04 reports
are `security/…` tagged and `/gsd:secure-phase 190` will read this tree. **Sweep them with
`/gsd:fast` BEFORE 190 executes**, so 190's SECURITY.md does not inherit findings it did not
cause. `STATE.md` records `BUG-260807-01`'s **code fix already landed** (`editAffordance.ts:244-247`
+ `providerLogo.tsx:107`) — its `status: open` means the **driven row is owed**, not that code
is missing. **Do not re-fix it.**

### G-5 hot-file ledger check

Measured against 190's `files_modified`:

| Ledger row | 190 touches it? | Verdict |
|---|---|---|
| `PhaseFormPanel.tsx` (G-5 fired at 185, honoured by construction) | **NO — `0 0` required by D-23** | ✅ honoured by construction again |
| `PhaseNodeCard.tsx` (satisfied at 188.2) | **NO — empty diff required by D-24** | ✅ |
| `WorkflowCanvas.tsx` (satisfied at 188.1) | NO | ✅ |
| **`backend/app/api/threads.py` — G-5 FIRES, extraction due (9+ phases)** | **NO** — 190 adds no route there; the workflow-run launch path is only *read* (§M1) | ✅ not aggravated |
| **`backend/app/services/anthropic_service.py` — G-5 FIRES, adapter audit due** | NO | ✅ not aggravated |

**`backend/app/services/harness/phase_types.py` is not on the ledger but should be watched** —
190 makes its ~6th substantive touch on `_exec_external_action`'s neighbourhood. The change is
one function (D-16's gate + a delegation to the registry), so it does not warrant a refactor
phase now, but the planner should **add the row to the ledger** so the next phase inherits an
accurate count rather than re-deriving it.

---

## What the sketches bind (G-2 satisfied — these are contracts, not suggestions)

### Sketch 155-C — "Own tab · instrument table" (winner, operator, 2026-08-08)

**Placement is a DECISION with a recorded reason:** **Connections is a SIXTH Settings tab**, not
a `SectionCard` inside Integrations. Variant B was built to be rejected and did its job — the
five shipped tabs (measured, `SettingsPage.tsx:875-884`: *AI Model · {retrieval} · Integrations ·
Memory · Audit Log*) are each a single-value form saved en masse behind one Save; a connection is
a **row with its own transaction and a write-only secret**. Nesting them means either the
tab-level Save silently skips rows or a row edit is lost on navigate-away.

**The table columns are the contract:** `Connection · Sends to · Used by · Credential · State`,
over a filter bar with capability chips and a live count (`13 of 24`). It is the **068-A
instrument-table roster** already carrying users and the model registry — a re-use, not a new
pattern.

**Binding obligations the plan must carry:**
- **The filter bar and live count are load-bearing at scale, not decoration.** C won on the
  24-row drive, not on taste.
- **The `Credential` column commits migration 116 to a persisted check verdict + timestamp**
  (`last_checked_at`, `last_check_verdict`) — this is a **column decision for 116**, and it is
  the sketch's own recorded open question.
- **`Used by N steps` is a net-new wire** — counting `connection_id` references across
  `workflow_definitions.definition` JSONB in published versions. Cheap as a count, but flag it
  rather than assume it. It exists because deleting a connection three published workflows depend
  on is the **073-A victim-naming** case.
- **State words are never colour alone (WCAG 1.4.1):** `✓ Ready` · `◌ Not checked` ·
  `✕ Credential failed` · `⏻ Disabled` — must read in greyscale.
- **The banner owns platform-wide truth; the row owns only what is true of that row.** At 24
  rows, a per-row platform notice is 24 identical amber lines.
- **Slack rows carry a `fixed` tag** — D-02 makes its host a code constant, and the surface
  should say so.
- **The empty state (0 connections) must explain what a connection IS** without a manual.
- **The seam:** the row's identity (`name · sends-to · state`) is **exactly** what the author's
  picker renders — no second vocabulary at the seam. At empty it reads *"nothing bound — this
  step will record, not send"*, the shipped `recorded_not_sent` terminal (D-17) told at author time.

**Sketch open questions the plan must resolve:**
- Capability glyphs (`✉ ▣ ＃`) are **placeholders** and must not become a fourth icon
  vocabulary — settle the source against `references/icon-convention.md` §4 before build.
- **Does the sixth tab need an org-admin gate?** D-12 makes connections org-shared, but nothing
  in CONTEXT says a *member* may create one. **This is a real, unanswered access-control question
  and it belongs in the threat model, not in a follow-up.**

### Sketch 156-A — "Push/split panel" (winner, operator, 2026-08-08)

400px right-side push/split panel; the list stays visible. Lineage: `PhaseFormPanel` (140-A),
the 037-A rules builder, the 027-A document detail shell. **The form content is byte-identical
across A/B/C by construction** — the comparison was purely about placement.

**THE TWO REFUSALS — the reason the sketch exists, and a binding asymmetry:**

| | moment 8 · egress refused | moment 9 · no encryption key |
|---|---|---|
| Cause | the host you typed resolves to `10.4.2.19` | the platform has no `SECRETS_ENCRYPTION_KEY` |
| Can you fix it? | **yes** — correct the host | **no** — nothing you type helps |
| So Save | stays **ENABLED**, *"Correct the host and try again"* | goes **DISABLED**, `aria-describedby` → the reason |

> **A refusal you can fix leaves the door open; a refusal you cannot fix closes it.**

Both follow the **142-B** rule: name the cause, name what the refusal **costs**, and put the
reason in **real DOM text, never a `title`**. Moment 8 names the host **and the resolved IP**,
nothing else (D-08), and states explicitly that it happened **before the password was read** —
the n8n inversion (D-06) in user-facing words.

**Other binding contracts:**
- **The always-on 🔒 destination footer** updates as you type and is **never** behind an Advanced
  disclosure — 024-A's cure for BUG-260616-01, applied to a destination instead of a model.
- **The write-only secret on edit:** `•••••••• stored 3 Aug · [Replace]`, never the value, with
  the reason stated — *"never sent back to this browser — not to you, not to an admin, not to the
  workflow author who picks this connection."*
- **The check runs on the STORED connection, not the typed form** — no plaintext secret crosses
  the wire for a non-storage purpose, **and** the check exercises the same org-scoped resolver
  D-14 protects. Moment 5's headline is load-bearing: **"Credential works — and nothing was sent."**
  Moment 6 renders the host's error **verbatim** (071-A).
- **Slack (moment 2) has nothing to type** and the form says so out loud: *"it cannot be pointed
  anywhere else, by you or by a workflow."*
- **The org-shared line** states D-12 as a property — the person creating it is authorising
  their colleagues.
- **Moment 10 reuses `recorded_not_sent` verbatim** — *"Not sent — recorded"* — rather than
  inventing a second phrase for the same state.

**⚠ Obligations A inherits that B would have given free — name them in the plan, do not discover
them in review:**
- It must survive **375px** (mobile becomes a bottom sheet, per the shipped shell rule).
- **No free focus trap and no free focus restore** — `Dialog` would have provided both. Both are
  **net-new a11y work** in the panel.

**Sketch open questions the plan must resolve:**
- Is the check `POST /connectors/connections/{id}/check`, or a query param on the read? The
  sketch assumes a dedicated action **because it has a side effect** (it writes `last_checked_at`).
- **What blocks a step from using a `check`-failed connection?** Moment 6 claims *"no step will be
  allowed to use it until this passes"* — **that is a claim the sketch makes that the backend does
  not yet honour.** It is either a real gate at bind/publish time **or the sentence must go.**
- **Does `Replace` on the stored secret invalidate the last check verdict?** It should.

---

## State of the Art

| Old approach | Current approach | When changed | Impact on 190 |
|---|---|---|---|
| Validate hostname, then hand the hostname to the HTTP client | Validate, then **connect to the pinned IP** with `sni_hostname` restoring TLS identity | httpcore's `sni_hostname` extension; the pattern is current practice (Prefect PR #21591, 2025+) | §R10 — this is the shape 190 adopts |
| CIDR deny-lists for SSRF | Property predicates (`is_global`) **plus a driven corpus for the embedding forms the property misses** | ongoing; §R14 shows the property alone is insufficient in CPython 3.12 | The corpus is the artefact, not the predicate |
| Jira REST v2 wiki-markup string `description` | **REST v3 requires ADF** for `description` | Jira Cloud v3 | §R12 — build ADF programmatically; never accept it from an author |
| Jira basic auth with an account password | **API token**; passwords deprecated | Atlassian, stated in their own docs | D-03 |
| Slack legacy tokens / `token` POST param | **`xoxb-` bot token in the `Authorization` header**, granular scopes (`chat:write`) | Slack's current API | §R11; header not body, per D-08 |

**Deprecated / outdated in this context:**
- **Jira basic auth with a password** — Atlassian: *"Authentication using passwords has been
  deprecated."*
- **A regex-based SMTP header-injection guard** — obsolete since `EmailMessage` raises (§R13).
- **`ipv4_mapped` alone as the IPv4-in-IPv6 check** — misses SIIT, NAT64, 6to4, Teredo (§R14).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Jira's error envelope is `{"errorMessages": [...], "errors": {...}}` and it uses proper HTTP status codes | §R12 | The adapter's error surfacing is wrong. **Not driven against a live Jira** (D-30). Verify on the first live row. |
| A2 | Slack's rate-limit response carries a `Retry-After` header | §R11 | 190 has **no retry** (D-18), so a wrong header name costs a log line, not behaviour. |
| A3 | The `ConnectionPicker` relative import `"./ConnectionPicker"` does not trip `ExternalActionSection.test.tsx`'s route-string fence | §M4 | The fence regex requires a **leading slash** (`["'\`]\/(workflows\|api)\/`), so a relative sibling import cannot match — but **run the fence after the mount line lands** rather than trusting this. |
| A4 | A resumed run can never be a golden run (so `_build_resume_context`'s missing `is_golden_run` is unreachable) | §M6 | If reachable, a **resumed golden run would SEND**. **Assert the unreachability with a test; do not assume it.** |
| A5 | `SECRETS_ENCRYPTION_KEY` is set in the local dev environment | §Environment | If unset, D-11's fail-CLOSED fires and **no connection can be created locally** → all local UAT blocks. **Verify before Wave 1.** |
| A6 | The `harness_audit` slug for the send receipt is `external_action_sent` | D-20 | CONTEXT calls it a *working name*. Lock it at plan-phase against `test_audit_event_registration.py`, which moves for the first time. |
| A7 | `getaddrinfo` refusing obfuscated decimal/octal literals is platform-specific (Windows measured; glibc may differ) | §R14 | **Explicitly NOT relied upon.** The guard validates resolved addresses, so the property holds regardless. Stated so nobody later builds on the Windows behaviour. |

---

## Open Questions

1. **Which allowlist does `live_connectors` join? (⚠ blocks a migration decision)**
   - Known: Phase 181's `visual_workflow_canvas` is in `_VISIBILITY_FEATURES` (`admin.py:104`,
     JSONB, **zero migration**), **not** `_FLAG_HUMAN_NAMES` (`admin.py:67`, which needs an
     `app_settings` **boolean column** = **migration 118**).
   - Unclear: CONTEXT D-26 names `/admin/flags` while citing the 181 precedent — the two are
     inconsistent.
   - **Recommendation: `_VISIBILITY_FEATURES` with audience `"off"` by default.** It is what 181
     actually did, it costs zero migrations, and the consumer path already exists
     (`dependencies.py:672/693`, `api/features.py:69`). If the operator wants true kill-switch
     semantics, **budget migration 118 explicitly at plan-phase.**

2. **Does the Settings → Connections tab need an org-admin gate?**
   - Known: D-12 makes connections org-shared with no per-user variant.
   - Unclear: nothing in CONTEXT says whether a plain **member** may create one — and a member
     who can create a connection can bind the org's colleagues to a destination of their choosing.
   - **Recommendation: gate creation on org-admin, leave read/use org-wide.** Raised by sketch
     155's own open questions and it is a genuine access-control decision, so it belongs in the
     **threat model**, not a follow-up.

3. **What blocks a step from using a `check`-failed connection?**
   - Known: sketch 156 moment 6 promises *"no step will be allowed to use it until this passes."*
   - Unclear: nothing in the backend honours that today.
   - **Recommendation: make it real at BIND time** (the picker refuses to select a failed
     connection) **and at RUN time** (the executor treats a failed connection as unbound →
     `recorded_not_sent`, D-17). Two cheap gates, no new status. **If neither ships, the sentence
     must be removed from the UI** — a promise a surface cannot keep is the exact over-claiming
     this whole node type exists to avoid.

4. **Does a `Replace` on the stored secret invalidate `last_check_verdict`?**
   - **Recommendation: yes** — set it back to `not_checked` in the same UPDATE. One column,
     zero ambiguity.

5. **Does `_build_resume_context` need `is_golden_run` threaded?**
   - See A4. **Recommendation: assert the unreachability with a test rather than thread the flag.**
     Threading it into a second ctx builder widens D-16's surface for a path that should not exist.

6. **`Used by N steps` — is the JSONB scan cheap enough at org scale?**
   - Known: sketch 155 flags it as net-new and does not assume it.
   - **Recommendation: measure once against the local corpus (193 definitions per STATE.md) before
     committing to a live count.** If it is slow, the column becomes an on-demand expand rather
     than a table cell — a UI change, not a schema change.

---

## Sources

### Primary (HIGH confidence — driven or read in this repo/venv)
- `backend/app/services/harness/phase_types.py:1700-1903` — `_exec_external_action`, signature, return keys
- `backend/app/services/harness_engine.py:765-845` — the golden-run branch, `getattr(ctx, "is_golden_run", False)`
- `backend/app/services/harness/publish_service.py:840-868` — the one ctx that sets `is_golden_run=True`
- `backend/app/security/secret_cipher.py:40-252` — `get_cipher`/`encrypt_secret`/`decrypt_secret`/`SECRET_COLUMNS`/`__all__`
- `backend/app/api/admin.py:62-111` — `_FLAG_HUMAN_NAMES` vs `_VISIBILITY_FEATURES`
- `backend/app/models/message.py` — `MessageCreate` (model + provider + workflow_definition_id)
- `backend/app/api/threads.py:858-940` · `backend/app/services/workflow_kickoff.py:146-173` — the run launch + 409 lock
- `backend/app/models/harness.py:172-262` — `ExternalActionPhaseConfig`
- `backend/tests/unit/test_189_no_egress.py:84-145, 266-335` — the sentinel + five inertness controls
- `backend/tests/test_harness_engine.py:1106-1180` — the golden-run fence + the Windows trap
- `backend/tests/unit/test_audit_event_registration.py:96-235` — `_highest_numbered_check_migration`, the two-directional G2
- `supabase/full-schema.sql:1124, 4486-4840` — the 23-literal CHECK; the org RLS policies
- `supabase/migrations/106_org_id_autofill_trigger.sql:74-107` — `autofill_org_id_by_owner`
- `frontend/src/components/workflows/phaseVocabulary.ts:500, 784-813` — zero imports; `notConnectedOf`
- `frontend/src/components/workflows/ExternalActionSection.tsx:88-98` · `ExternalActionSection.test.tsx:381-412` — 3 props; 6 purity fences
- `frontend/src/components/workflows/PhaseFormPanel.tsx:730, 1052-1054` — the write seam; the mount
- `scripts/vitest-count-gate.cjs` (run) · `npx tsc -p tsconfig.app.json` (run) · `pytest` (run)
- Python 3.12.6 stdlib source in `backend/venv` — `smtplib.SMTP.connect`, `SMTP_SSL._get_socket`, `SMTP.starttls`, `email.message.EmailMessage.__setitem__`
- `httpcore._async.connection` in `backend/venv` — `sni_hostname` → `start_tls(server_hostname=…)`
- Driven probes (5 scripts, full output reproduced in §R13/§R14/§R15/§R10)
- `.planning/sketches/155-connections-at-rest/README.md` · `.planning/sketches/156-adding-a-connection/README.md`

### Secondary (MEDIUM–HIGH — vendor's own documentation)
- [Slack — `chat.postMessage`](https://docs.slack.dev/reference/methods/chat.postMessage) — scopes, `ok:false` at HTTP 200, error codes, rate limit
- [Atlassian — Basic auth for REST APIs](https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/) — email:token, base64, passwords deprecated
- [Atlassian — Jira Cloud platform REST API v3, Issues](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/) · [v3 intro](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) — ADF requirement, minimal ADF doc

### Tertiary (MEDIUM — corroborating, cross-checked against the driven probes)
- [encode/httpx — Discussion #2811, enhanced custom name resolution](https://github.com/encode/httpx/discussions/2811)
- [PrefectHQ/prefect — PR #21591, DNS-rebinding TOCTOU fix](https://github.com/PrefectHQ/prefect/pull/21591)
- [Invicti — SSRF via SNI proxy misconfiguration](https://www.invicti.com/blog/web-security/ssrf-vulnerabilities-caused-by-sni-proxy-misconfigurations)

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack | **HIGH** | Zero new dependencies; every version read from the installed venv, not a registry |
| Codebase measurements (M1–M10) | **HIGH** | Every one has its command and its actual output; six inherited claims measured FALSE |
| Egress predicate (§R14) | **HIGH** | 29-address driven corpus; four holes found by driving, not reasoning |
| DNS pinning (§R10) | **HIGH** on mechanism, **MEDIUM** on durability | Both recipes verified in-venv; both depend on non-public attributes → RESIDUAL-190-01 |
| SMTP header injection (§R13) | **HIGH** | Driven; `ValueError` on all three attempts |
| Slack API (§R11) | **HIGH** | Slack's own reference; the `ok:false` trap is stated by the vendor |
| Jira API (§R12) | **MEDIUM–HIGH** | Atlassian's own docs for ADF + auth (HIGH); the exact error-body shape not driven (MEDIUM) — D-30 blocks it |
| Sketch contracts | **HIGH** | Both winners operator-decided 2026-08-08, read verbatim |
| Architecture (waves, fences) | **HIGH** | Derived from measured seams, not proposed shapes |

**Research date:** 2026-08-08
**Valid until:** **2026-09-07** for the codebase measurements (30 days — but re-run the count
gate, `tsc`, and the pytest baselines at plan-phase regardless; §M2 shows they rot within a
phase). **2026-08-15** for the vendor API details (7 days — fast-moving surfaces, and the Jira
error envelope is unverified until D-30's destinations exist).
