# Phase 222 — Measurement Pack

**Written by the reviewer (Claude) BEFORE `discuss-phase` opens, per `AGENTS.md` §3.1.**
Everything here was re-derived on the untouched tree at `9c3876994`. Nothing is copied forward
from an earlier pack, because this project's own repeated finding is that a figure written at a
phase's close goes stale on the next commit that touches the file.

⚠ **THERE ARE NO RECOMMENDATIONS IN THIS FILE, BY DESIGN.** `AGENTS.md` §3.1: *"A measurement
pack that contains a suggested fix is a design direction wearing a lab coat."* Every section
below is a fact with its derivation attached. What to do about any of it is the builder's call
or the operator's.

---

## 0 · How this phase is split

**Operator ruling, 2026-09-01.** Phase 222 hits **four of §3.1's five critical-phase criteria**
(credentials · outbound egress · permission model · can-fail-open), which by that test would make
it Claude-built. The operator ruled instead that it is **SPLIT**:

| Half | Agent | Scope |
|---|---|---|
| **The door** | **Gemini** | discuss → plan → execute on the connect surface, the catalog entry, the states and the copy |
| **The crypto** | **Claude** | the PKCE join, RFC 9728 / RFC 8414 discovery, the pinned egress on those fetches, token storage |

⚠ **§3.1 calls a split *"the exact shape of the Phase 204 defect"*** — each side individually
correct, individually green, and the join dead. It therefore **owes an integration test that
mocks NEITHER side, and that test is a blocking gate.** Phase 204 shipped a spend cap that never
armed with 106 tests green for precisely this reason.

---

## 1 · Gate baselines

| Gate | Value | How |
|---|---|---|
| `tsc` | **66 errors** | `npx tsc --noEmit -p tsconfig.app.json`, run from `frontend/`. ⚠ The bare form checks ZERO files. Matches STATE.md's recorded baseline of 66. |
| count gate | **182/182 · total 7112 · pinned 6391 · failed 0** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the repo root |
| backend unit | **70 failed** | ⚠ Quoted from STATE.md at the 221 close, **not re-derived here**. |
| CLAUDE.md size | 106,048 chars · 70.7% | `node scripts/check-claude-md-size.cjs` at the 221 close |

⚠ **A growing count-gate total is the gate WORKING**, not drifting — its contract is *no per-file
decrease* and *zero failing*, never a fixed grand total. Re-derive rather than quote.

### 1.1 Count gate — verdict line, verbatim

```
  total                                      6391    7112    +721
  total 7112  ·  failed 0  ·  pinned total 6391
count gate OK — 182/182 pinned files present, no per-file decrease, 0 failing.
```

Re-derived on this tree rather than inherited. It **reproduces the 221 close exactly**
(`182/182 · 7112 · 6391 · 0`), so the tree is quiet and the baseline is confirmed, not quoted.
⚠ This is the figure this project has published a stale version of **six times** — re-derive at
your own base rather than copying this line.

**Five suites print as `new` (unpinned), and the gate names them every run:**

| Suite | cases |
|---|---|
| `RunHero.test.tsx` | 18 |
| `automationFacts.test.ts` | 11 |
| `nodeEffectBanner.test.ts` | 8 |
| `toolReadOnlyMap.test.ts` | 7 |
| `PromptVariableChips.test.tsx` | 3 |

⚠ `221-CARRY-FORWARD.md` §E1 says *"Six suites remain unpinned"* and then names **five**. The gate
prints **five**. The sixth, if it exists, is not in this run's output.

---

## 2 · G-5 scan — re-derived, and three files have never had a row

Triples are `commits / phases / lines`, derived with CLAUDE.md's own recipe (six-digit dated
quick-task buckets subtracted).

| File | measured | G-5 | Ledger says |
|---|---|---|---|
| `backend/app/security/egress.py` | **10 / 3 / 938** | ⚠ **FIRES** | ⛔ **NO ROW IN EITHER FILE** |
| `backend/app/services/oauth_service.py` | 4 / 1 / 362 | no | ⛔ **NO ROW IN EITHER FILE** |
| `frontend/src/lib/api/connectors.ts` | **9 / 4 / 488** | ⚠ **FIRES** | ⛔ **NO ROW IN EITHER FILE** |
| `backend/app/services/mcp_client.py` | **6 / 4 / 435** | ⚠ **FIRES** | `4 / 2 / 407`, *"young (211, 212)"* — **STALE, and it crossed the threshold** |
| `backend/app/api/connectors.py` | 18 / 8 / 1338 | ⚠ FIRES | `17 / 7 / 1338` — STALE |
| `backend/app/services/connector_service.py` | 18 / 6 / 1493 | ⚠ FIRES | `16 / 5 / 1461` — STALE |
| `backend/app/models/connector.py` | 13 / 7 / 471 | ⚠ FIRES | `12 / 6 / 471` — STALE |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 24 / 8 / 1578 | ⚠ FIRES | `23 / 8 / 1578` — STALE by 1 |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 17 / 7 / 2376 | ⚠ FIRES | matches |
| `backend/app/services/connectors/service_tools.py` | 11 / 1 / 2018 | no (0 phases) | matches — its buckets are all dated quick tasks |

⚠ **`egress.py` is the outbound boundary itself and has been invisible to its own guardrail for
its entire life.** Verified by `grep -c` against both `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md`:
zero hits in each, for `egress.py`, `oauth_service.py` and `lib/api/connectors.ts`.

⚠ **`mcp_client.py`'s row reads *young* and it now FIRES at 4 phases.** A row that is present and
WRONG answers the auditor with a verdict and stops the audit, which is worse than an absent row.

---

## 3 · Register sweep

### Reported bugs — a clean result, stated so nobody re-derives it

**No open bug targets Phase 222.** Two open reports name connectors and neither is this phase's
shape: `BUG-260828-06` (email body delivered as flattened raw markdown, `smtp-adapter`) and
`grant-override-marker-claims-a-person-changed-it` (migration 128's backfill, minor). Both carry
`folded_into: null`.

### Seeds naming this phase

| Seed | Status | Relevance |
|---|---|---|
| **SEED-237** | `planted` | The phase's own source. Carries the costed sequence; 222 is its **step 2**. |
| **SEED-177** | `planted` | Records the CORRECTION that MCP standardizes authorization — *"OAuth per vendor is wrong"*. Its re-open trigger #3 still measures **0 hits** on the roadmap. |
| **SEED-233** | new at 221 | `connector_tokens` RLS. **Measured live in §5.1 — it reproduces.** |
| **SEED-146** | `planted` | The umbrella: the FULL integration capability surface. |
| **SEED-144** | `planted` | Connections should be PROVIDER-shaped — OAuth, not pasted tokens. |
| **SEED-204** | `planted` | Three paths to any external application. |
| **SEED-013** | `planted` | Open Platform — the inbound twin. |

⚠ **`SEED-237` is still `status: planted` at HEAD.** CLAUDE.md's rule is that a seed answered by a
shipped phase must be written back, or it is re-proposed forever. **That write is the builder's at
discuss-phase; I deliberately did not do it.**

---

## 4 · The code as it stands today

### 4.1 The OAuth door has exactly three vendors, hardcoded

`oauth_service.py:28` — `OAUTH_PROVIDERS: dict[OAuthProvider, dict[str, Any]]`, holding
`google` (`:29`), `microsoft` (`:98`) and `github` (`:111`). Each carries a literal `auth_url`
and `token_url`. Three call sites resolve through it — `:235`, `:283`, `:313` — each doing
`OAUTH_PROVIDERS.get(provider)` and raising on a miss.

`github` is defined and **unused**: the live GitHub connection runs over MCP (§5), not this.

### 4.2 ⚠ THE TWO EGRESS PATHS ARE NOT THE SAME, AND THE CONTRAST IS THE MEASUREMENT

`mcp_client._send_jsonrpc` (`:214`) was hardened at 212-01 and today carries the full shape:

- `:225` — validation via `run_in_threadpool(validate_mcp_destination, ...)`, off the event loop
- `:228-230` — the returned `PinnedDestination` is **consumed** to rewrite the URL to the IP
  literal (the TOCTOU DNS-rebinding fix), with `Host` restored at `:234` for SNI
- `:247-252` — `follow_redirects=False`, `verify=True`, `trust_env=False`, each commented in-file
  as a security property rather than tidiness

`oauth_service.py` does **none of it**. Two raw clients:

| Line | Call | Guards |
|---|---|---|
| `:300` | `async with httpx.AsyncClient(timeout=15.0)` → `POST token_url` (code-for-token exchange) | **none** — no scheme check, no allow-list, no DNS pin, no redirect refusal, no size cap |
| `:321` | `async with httpx.AsyncClient(timeout=10.0)` → `userinfo_url` | **none** |

⚠ **Stated precisely, because the distinction is the whole point:** both URLs come from the
hardcoded registry in §4.1 today, so neither is currently attacker-influenced. **This is a
measurement of what those call sites are, not a claim that they are exploitable at HEAD.**

This is the same shape as the `cloud_storage.py` finding recorded in `BUS-037` — a raw client on
a path the `services/connectors/` source fence never walked. `egress.py:642 send_pinned_http` is
the binder those calls were routed through.

### 4.3 The MCP door authenticates with a pasted string

`mcp_client._build_auth_headers` (`:59-83`) formats a stored secret four ways — a `bearer ` prefix
passed through, a `basic ` prefix passed through, a `user:token` pair base64'd, else
`Bearer {secret}` — and does nothing else. There is **no authorization-code path, no refresh, and
no call into `oauth_service` from this file.** `grep` for `oauth` in `mcp_client.py` returns
nothing.

### 4.4 The tool registry is closed

Recorded in `SEED-237` and visible in `oauth_service.py:84`'s own comment: `_TOOL_REGISTRY` is the
audit surface, and an unknown key raises — deliberately, as a safety property.

---

## 5 · The live install — SEED-237's step 1, measured

⚠ **`SEED-237` names this as *"hours, no code, and it changes the sizing of everything below it"*.
It is done; here it is.** Read from local Postgres `:54322` directly.

| Connection | auth | shape | last check | tools |
|---|---|---|---|---|
| GitHub | `static_key` | MCP + secret | `not_checked` | **44** |
| DeepWiki (206.1 UAT) | `static_key` | MCP, no secret | `not_checked` | 3 |
| **Notion** | `static_key` | **MCP + secret** | **`not_checked`** | **0** |
| **Jira · KAN** | `static_key` | capability | ⛔ **`failed`** (2026-08-31) | 5 |
| **Microsoft 365** | **`oauth_byo`** | neither | `not_checked` | **0** |
| Google Workspace ×2 | `oauth_byo` | neither | one `ok`, one `not_checked` | 26 each |
| Slack ×2 | `static_key` | capability | `ok` | 6 each |
| Email (SMTP) | `static_key` | capability | `ok` | 1 |

**Both of SEED-237's step-1 claims reproduce:** Notion has never been checked and holds **zero**
tools; the Jira credential check reads **`failed`**.

⚠ **The cost anchor is live on this box.** GitHub carries **44 tools for zero lines of tool code**,
against Google's 26 tools at ≈96 lines of spec + adapter each.

⚠ **Microsoft 365 reproduces SEED-237's other half**: `oauth_byo`, connected, **zero tools**.

### 5.1 ⚠ SEED-233 REPRODUCES — measured, not quoted

```
pg_class.relrowsecurity / pg_policy count, schema public:
  connector_connections   RLS=True   policies=4
  connector_tokens        RLS=True   policies=0     <-- zero
connector_tokens rows: 2
```

RLS enabled with **zero policies** means every user-JWT read of that table returns empty, on two
real rows. **This phase writes tokens to that table.** The migration is recorded in
`221-CARRY-FORWARD.md` §B as a decision put to the operator and not taken.

### 5.2 Two duplicate `Google Workspace` rows still exist

Both `oauth_byo`, both 26 tools; one `ok`, one `not_checked`. Recorded because a UAT row that
picks the wrong one measures the wrong thing.

---

## 6 · Proposed file fence — NOT yet operator-agreed

Offered so the split has a boundary before either side writes a line. ⚠ **`BUS-004`'s fence was
agreed by the operator before execution; this one is not yet.**

| Owner | Files |
|---|---|
| **Claude (crypto)** | `services/oauth_service.py` · `services/mcp_client.py` · `security/egress.py` · any migration on `connector_tokens` |
| **Gemini (door)** | all of `components/settings/` · `lib/api/connectors.ts` · `servicesCatalog.ts` · the copy files |
| ⚠ **THE SEAM** | `api/connectors.py` · `models/connector.py` — the wire between the two halves |

⚠ **The seam files are where the Phase 204 defect lives.** Whatever the discovery / authorize /
callback contract ends up being called, it is **written** on the crypto side and **consumed** on
the door side. Name every field on both sides and pin them in the one test that mocks neither.

---

## 7 · What is NOT measured here, stated rather than implied

- The **backend unit baseline of 70** is quoted from STATE.md, **not re-derived**. `tsc` and the
  count gate WERE re-derived (§1); this one was not, and the distinction is deliberate.
- **No browser drive** of any connector surface was run for this pack.
- The **`_TOOL_REGISTRY` dynamic-resolution question** is described in §4.4 as it stands; how
  connection-scoped tools should resolve is not answered here.
- I did **not** write back `SEED-237`'s frontmatter, route any bug, or update a ledger row. Those
  are discuss-phase writes and they belong to the builder.
- The two duplicate Google rows were **not** deleted. That is operator data.
