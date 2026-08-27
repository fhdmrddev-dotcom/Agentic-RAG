# Phase 212 — session handoff

**Written 2026-08-27 by Claude (reviewer), at ~68% context.** Read this first in a new session,
then `212-VERIFICATION.md` §9. Everything below is measured, not remembered.

---

## Where things stand in one paragraph

Phase 212 shipped, was closed on green gates, and was then **re-opened** because driving it with the
operator found **five defects no gate could see**. Three are fixed and committed. **Two are open and
the operator has ruled they are fixed IN 212, not deferred to 213** — that ruling supersedes
`BUS-021`'s closing paragraph. Gemini has the work on **`BUS-022`**. Phase 213 must not start until
they land.

---

## Is the operator's GitHub connection working? YES

This confused the operator and it is worth stating flatly.

- The **connection** works. `discover_connection_tools(id, org)` against their real stored
  credential returned **44 tools**, and the row now holds them:
  `GitHub 44 · DeepWiki 3 · Notion 0`.
- The **button** does not. Settings calls the wrong endpoint (D-4).
- **Notion's `0` is not our bug** — Notion answers `403 restricted_resource "Endpoint
  unavailable."`, i.e. it is refusing the integration. Likely no page shared with it.

---

## The two open defects

### D-4 — the working endpoint is not wired to the button

Two discovery paths exist; the UI calls the one that structurally cannot authenticate.

| path | credential | wired? |
|---|---|---|
| `discover_connection_tools(id, org)` — Phase 206, `POST /connectors/connections/{id}/discover`, client `discoverConnectorTools(id)` at `lib/api/connectors.ts:219` | decrypts the **stored** secret **server-side** | ❌ **zero callers in `components/settings/`** |
| `probeMcpServer({mcp_server_url, secret})` — Phase 212 | needs the secret **in the browser** | ✅ the only one `ConnectionFormPanel` calls |

In edit mode the token renders masked (*"stored since 27 Aug"*) and `draft.secret` is empty **by
design** — the stored value is never returned to a browser, which is correct and must stay.

**Proven, not inferred.** Evidence chain, in order:
1. Browser wire capture: the panel **does** send `{"mcp_server_url": "…", "secret": "…"}` when the
   field is live. Frontend is correct.
2. Server-side: `secret=None` → GitHub `401 missing required Authorization header`;
   `secret='DUMMY_TOKEN_123'` → `400 badly formatted`. The auth-header builder is correct.
3. `discover_connection_tools` with the **stored** credential → **44 tools**.

⚠ **I retracted D-4 once, prematurely, on partial evidence, then reinstated it.** The deciding proof
was the masked field plus *"stored since 27 Aug"* in the operator's own screenshot. Do not re-litigate
it; it is settled.

**Fix shape:** `ConnectionFormPanel` chooses by mode — existing connection → `discoverConnectorTools(connection.id)`;
new draft → `probeMcpServer`. ⚠ The two return **different shapes** (`McpDiscoveredTool[]` vs
`McpProbeResponse {server_url, tools, count}`) — normalise at the call site. ⚠ A **third** case must
not 502: a capability row (slack/jira/smtp) refreshes from its static descriptor with **no network
call**, and a service-only row raises `ConnectorNothingToDiscover`
(`connector_service.py:807-820` documents all three arms).

### D-5 — three of seven Popular services have no configurable form

Driven on a fresh Add panel, typing into the service field:

| typed | fields offered |
|---|---|
| `slack` | Name · Channel · Bot token |
| `custom_mcp` | Name · MCP server URL · Access token |
| **`github`** | Name — **nothing else** |
| **`notion`** | Name — **nothing else** |

`servicesCatalog.ts` ships `github`, `notion`, `google` as `isPopular: true` with `markKey: "mcp"`,
but field reveal is keyed on three hard-coded capability ids plus the literal `custom_mcp`.

**Fix shape:** key the reveal on the catalog entry's **shape**, not an id list. Then adding a Popular
service costs a catalog row instead of a code branch — which is what migration 127's `service_id`
`COMMENT` already promises.

⚠ **This is SC#3 failing**, and it is a hole in the reviewer's own verification: SC#3 was passed
because the Popular row **rendered**; nobody clicked through to a form.

---

## The three fixed defects — and the one habit behind them

| | defect | commit |
|---|---|---|
| D-1 | the IP pin lost **SNI** — broke **all** MCP discovery, incl. Phase 206's shipped path | `ac159cc7` |
| D-2 | `list_tools` rejected the route's own `timeout` kwarg — `POST /discover-tools` had **never once succeeded** | `474ef7ea` |
| D-3 | the upstream reason was computed, sent, then **discarded** by the client | `724f9b9f` |

⚠ **All three were hidden by the same habit: a test that MOCKS THE THING UNDER TEST.** D-1's pin
monkeypatched `_post` away and asserted only that `server_hostname` was *handed* to it — while its
docstring claimed *"and SNI"*. D-2's seam stub **invented the `timeout` parameter the real function
lacked**. 2,796 passing tests, a green count gate and a green typecheck saw none of it.

**A mock proves the caller is self-consistent; it cannot prove the wire is right.** Both new pins
assert the real signature / the real request instead. Apply the same rule to D-4's test: do not mock
`discoverConnectorTools` in the test that proves the mode switch — assert **which endpoint was
called**.

⚠ **All three fixes are reviewer-authored with NO independent verifier.** `/code-review ultra` is
the real gate and is owed.

---

## Gate baselines to hold

| gate | value |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`) | **34** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **OK · 118/118 · total 5847 · failed 0** |
| `./venv/Scripts/python.exe -m pytest tests/unit -q` (from `backend/`) | **68 failed / 2796 passed** |
| `node scripts/check-claude-md-size.cjs` | **~86k · 57.5% · OK** |

**G-7 FIRES** — 2 gap-closure rounds used. D-4/D-5 are larger than a G-3 fast fix, so they are
neither a round nor a patch; they are the operator's explicit instruction to finish 212.

---

## Environment traps that cost time this session

- ⚠ **Vite binds IPv6 ONLY.** `curl 127.0.0.1:5173` → refused; `localhost` / `[::1]` → 200. A
  `127.0.0.1` probe reports the frontend DOWN while it is serving. Backend `:8000` and Postgres
  `:54322` **do** answer on v4, which is why only the frontend looks dead. A second `npm run dev`
  prints `Port 5173 is in use` and silently takes **5174** — kill it.
- ⚠ **The app has NO URL router** (`SEED-185`) — `/settings` lands on chat. Click the nav.
- ⚠ **`take_screenshot` times out** in this Chrome setup. Read the DOM via `javascript_tool`.
- ⚠ **Backticks in a handed-over Bash command are command substitution** — they ate five identifiers
  out of `BUS-020` and it had to be rewritten.
- ⚠ **The commit-msg hook caps the body at 12 content lines.** Trailers are not counted.
- ⚠ `import app.main` first when calling `connector_service` from a script, or a circular import
  through `harness/phase_types.py` raises `ImportError: cannot import name 'ConnectorDisabled'`.
- The operator's backend was briefly running from **system Python**, not the venv. Start it with
  `./venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`.

---

## What to do, in order

1. **Wait for Gemini** (`BUS-022`). Do not start 213.
2. When he posts a summary, **re-drive**: GitHub discovering from the **saved** row *through the
   button*, and `Connect` on GitHub/Notion opening a **fillable** form.
3. Re-derive all four gates and read the verdict lines verbatim.
4. Update `212-VERIFICATION.md` §9 (flip D-4/D-5), `STATE.md`, and the ROADMAP row/checkbox.
5. Only then is 213 ready. It is **Claude-built** (§3.1 criterion 3).

## Still owed by the operator

- `/code-review ultra` on `ac159cc7`, `474ef7ea`, `724f9b9f` — plus `review-210-211-base` for 210/211.
- **Cloud drive of SC#3** — `BUG-260810-01` stays `folded`, never `closed`, until then.
- A **Rovo connector detail screenshot** for 213's design bar (`BUS-019`) — the one the ROADMAP cites
  is not in `screenshots/`.

## Open bus items

`BUS-010`, `BUS-014` … `BUS-018`, `BUS-020`, `BUS-021`, **`BUS-022`** → gemini ·
`BUS-019` → operator.

⚠ **`BUS-018` — the operator ruled CONNECTIONS ARE PER USER, not per organization.** Today
`connector_connections` is org-scoped with `org:manage` on every write. This must be settled **before
213 fixes the grant grain**; `SEED-146` warns the table shape must not be committed a third time.
⚠ **Still unanswered: an unattended run has no user session** — whose credential fires a workflow
scheduled at 03:00?
