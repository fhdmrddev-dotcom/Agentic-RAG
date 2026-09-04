---
type: verification
phase: 212
phase_name: "The Catalog and Its Doors"
builder: gemini
reviewer: claude
verified_at: 2026-08-27
tree_state: verified at `4aa28090` (phase executed through `8eeaeb6b`; five defects fixed through `ac159cc7`, `474ef7ea`, `724f9b9f`, `4aa28090`)
verdict: CLOSED — all five driven defects fixed and operator-confirmed 2026-08-27, with owed rows named
owed:
  - "/code-review ultra on ac159cc7, 474ef7ea, 724f9b9f, 4aa28090 — no independent verifier"
  - "cloud drive of SC#3 — BUG-260810-01 stays folded, never closed"
  - "Rovo connector detail screenshot for 213's design bar (BUS-019)"
blocked_rows:
  - "Notion — 403 restricted_resource; mcp.notion.com/mcp is OAuth-only. Blocked on Phase 215."
routed_out:
  - "BUG-260827-02 (capability rows bypass the grant gate) → 213 GRANT-04"
  - "SEED-214 (the 1:1 lock) → 213 SC#1"
---

# Phase 212 — verification

**Method.** `AGENTS.md §3.1` makes the reviewer owe a **driven** check after an ordinary phase, not
a re-read. Gates were re-derived and read verbatim; the surface was driven in a browser; the egress
path was driven against a **real remote MCP server**. Two findings came only from driving, and one
of them was a blocking regression no gate could see.

⚠ **A blocking regression was found and fixed during this verification.** It is written up in §3
before the success criteria, because it changes what SC#4 means.

---

## 1 · Gates — re-derived, verbatim

| Gate | Baseline (212 open) | At close |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 34 | **34** ✅ |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | OK · 116/116 · 5829 · failed 0 | **OK · 118/118 · total 5847 · pinned 5217 · failed 0** ✅ |
| `pytest tests/unit -q` | 68 failed / 2788 passed | **68 failed / 2795 passed** ✅ |
| `node scripts/check-claude-md-size.cjs` | 85,424 · 56.9% | **86,274 · 57.5% · OK** ✅ |
| `bash scripts/check-deploy-drift.sh` | — | **PASS** ✅ |

The pinned count grew 116 → 118 because both new suites were added to `TARGETS` — the `GATE-1`
finding from `212-PREFLIGHT.md` was fixed. **A growing number is the gate working.** The backend rot
set is **unchanged at 68**; passes rose by 7 across the phase and by **+1** for the regression pin
added in §3.

**212 added no migrations**, so no cloud DB parity is owed from this phase.

---

## 2 · Success criteria

| # | Criterion | Verdict |
|---|---|---|
| 1 | searchable list of services, each with mark, name, one-line purpose | ✅ **DRIVEN** |
| 2 | `All / Connected / Not connected`, no filter describing what a connector can *do* | ✅ **DRIVEN** |
| 3 | **on a cloud install**, connect a Popular service in one click, from the same list | ✅ **LOCAL HALF DRIVEN 2026-08-27** — D-5 fixed (`4aa28090`), operator confirmed a fillable form on every Popular service. ⚠ **the CLOUD half stays unverified** — `BUG-260810-01` stays `folded`, never `closed` |
| 4 | paste an MCP URL, tools discovered and **become grantable**, no code changed | ✅ **DRIVEN 2026-08-27** — five defects fixed (§9 D-1..D-5). A SAVED connection discovers through the button: **GitHub 44 tools**, measured on the row |
| 5 | edit preserves per-tool grants; delete removes cleanly | ⚠ **EDIT HALF DRIVEN; delete NOT executed** |

### SC#1 — driven
13 rows render with mark, name and a one-line purpose. Search matches the purpose line, not only the
name (`matchesTagline`). Purposes are in the house voice — *"Post updates and read channels in your
workspace."*, *"Raise and track issues for your team."* — not category nouns.

### SC#2 — driven
Three chips only. Partition measured **All 13 = Connected 4 + Not connected 9**, exact. A grep for
capability/verb filters across `components/settings/` returns one hit, in
`connectionRefusalCopy.ts:203`, which maps a capability to a word inside a *refusal message* — not a
filter. `connectionVerbFence.test.ts` holds 20 assertions.

⚠ This criterion **failed on the first drive and was fixed in gap round 2**: `DeepWiki`, a
configured and working MCP connection, appeared under **Not connected**, because the predicate keyed
on `connectionStateOf(...) === "ready"` and an MCP row has no credential to check. It now reads
`item.kind === "configured"`. Re-driven: DeepWiki sits under **Connected**.

### SC#3 — the cloud half is unverified, and that is the half the bug was filed for
The Popular card row renders (Slack / GitHub / Notion, each with `Connect`), inside the same list,
under a `POPULAR` group header. **All of it was driven on LOCAL only**, on an install whose
`live_connectors` is flipped to `everyone` while the shipped cold default is `off`
(`user_settings.py:1214`). `BUG-260810-01` reproduces on `production` at `5d5ea200`; nothing here was
driven there. The write affordance sits behind **two** conjuncts — `isOrgAdmin && liveConnectorsOn` —
and only the second was exercised.

**`BUG-260810-01` therefore stays `folded`, not `closed`, with `verified_closed_by: null`.** A
`re_open_trigger` was written into it at this verification recording exactly what is owed.

### SC#4 — see §3. Discovery was broken for every URL; it is fixed but "grantable" was never observed.

### SC#5 — edit half driven, delete half not
Driven through the UI: renamed `DeepWiki (206.1 UAT)` → `… x` → back. `tool_grants` is
**byte-identical** across both saves and `discovered_tools` stayed at 3:

```
before  [('DeepWiki (206.1 UAT)',   {'read_wiki_contents': True, 'read_wiki_structure': True}, 3)]
during  [('DeepWiki (206.1 UAT) x', {'read_wiki_contents': True, 'read_wiki_structure': True}, 3)]
after   [('DeepWiki (206.1 UAT)',   {'read_wiki_contents': True, 'read_wiki_structure': True}, 3)]
```

⚠ **Two facts qualify that pass, and neither is an opinion.**

1. **Grants were verified only in the DATABASE, because the panel exposes no grant surface at all.**
   The edit panel renders no tool list and no per-tool controls; the only occurrence of the word
   "tool" in it is the `Discover tools` button. This is the same absence recorded on `BUS-019`:
   **Phase 212 shipped no connection detail screen**, which 213's stated dependency assumes it did.
2. **Each `Save changes` issues TWO writes** — `PATCH /connectors/connections/{id}` **and**
   `PATCH /connectors/connections/{id}/grants`. So the grants survived a rename **because the panel
   re-sent the same grant map**, not because a rename leaves grants untouched. The criterion's words
   are satisfied; the mechanism is more fragile than they imply, and a future edit path that omits
   the second PATCH would silently clear grants.

**The delete was never executed** — only the confirmation sheet was opened and cancelled. It is a
genuine victim-naming sheet, verbatim:

> **"Delete DeepWiki (206.1 UAT)?"** — "1 published workflow step sends through this connection.
> They will read "Not sent — recorded" until another connection is bound. The stored credential is
> destroyed and cannot be recovered. This is recorded with your name."

So *"removes it cleanly"* is unverified beyond that wording.

---

## 3 · ⛔ The blocking regression — found by driving, invisible to every gate

**Symptom.** The browser drive of SC#4 pasted `https://mcp.deepwiki.com/sse`, clicked
`Discover tools`, and the panel rendered **"Failed to fetch"**. Zero tools, on **every** URL tried,
across ~6 attempts and two page loads.

**Root cause, driven not reasoned.** `_send_jsonrpc` rewrites the URL to the pinned IP literal — the
DNS-rebinding TOCTOU fix `212-PREFLIGHT.md` asked for — and set only a `Host:` header.
**A `Host:` header is HTTP-layer; SNI rides the TLS `ClientHello`, which is sent before any header
exists.** So certificate verification targeted the IP:

```
https://mcp.deepwiki.com/sse -> McpClientError ... [SSL: CERTIFICATE_VERIFY_FAILED]
    certificate verify failed: IP address mismatch,
    certificate is not valid for '54.149.123.220'
```

Isolated proof, one variable, against the real server:

```
WITHOUT sni_hostname (as shipped) -> ConnectError CERTIFICATE_VERIFY_FAILED
WITH    sni_hostname              -> 200  {"result":{"tools":[{"name":"ask_question", …
```

⚠ **`egress.py` warns about this failure in writing, in the sibling path 212-01 was told to copy:**
*"A pin that loses SNI silently points certificate HOSTNAME verification at an address no
certificate carries, which is a worse bug than the one being fixed."* (`egress.py:53`, and the
working line at `egress.py:663`.)

⚠ **This is a REGRESSION, not a missing feature.** `_send_jsonrpc` is shared, so it also broke Phase
**206**'s already-shipped `POST /connections/{id}/discover`. DeepWiki was discovered successfully on
2026-08-25; after 212-01 it could not be.

⚠ **`server_hostname` was already threaded from `_send_jsonrpc` into `_post` — and then went
completely unused.** The plumbing was built and only the last step was missed.

### Why nothing caught it

`test_mcp_pinned_ip_rewrites_transport_and_preserves_host` **monkeypatches `_post` away** and asserts
only that `server_hostname` was *handed to it*. `_post` never used it and the assertion still passed.
Its own docstring says *"while setting Host header and SNI"* — **the SNI half was never on the wire
and never checked.** That is a test pinning the plumbing rather than the effect, and it is the same
failure class this project keeps recording.

### Fix — `ac159cc7`

`_post` now passes httpx's `sni_hostname` extension, the shape `egress.py:663` already uses. A new
test, `test_mcp_sets_sni_hostname_on_the_actual_request`, drives a real `httpx.Request` through a
`MockTransport` and asserts the extension **on the wire**, so the effect is pinned rather than the
plumbing. Seven over-specified `mock_post` stubs were widened to accept the new kwarg.

Verified after the fix: `list_tools('https://mcp.deepwiki.com/mcp')` → **3 tools**
(`ask_question`, `read_wiki_contents`, `read_wiki_structure`). Backend suite: **68 failed / 2795
passed** — rot set unchanged, +1 pass for the new pin.

⚠ **REVIEWER-AUTHORED, SO NO INDEPENDENT VERIFIER EXISTS FOR IT.** Same disclosure as `7bd77065` and
`ca015df9` on Phase 210. `/code-review ultra` remains the real gate on this file.

### G-7 — why this was a fast fix and not a third round

`node scripts/check-gap-closure-rounds.cjs 212` **FIRES** — 2 rounds completed, cap is 2. G-7's own
instruction is to triage rather than iterate, and: *"≤ 1 file / ≤ 10 lines with no schema or API
surface is `/gsd:fast` under G-3 — never a round."* This was one call site in one file. It was
therefore fixed inline, not routed.

---

## 4 · What SC#4 still owes

The fix restores discovery, but **the criterion was never driven end to end through the UI**:

- The pre-save probe rendering a tool list in the panel — **not observed**. Only the API-level call
  was driven after the fix.
- *"…and become grantable"* — **not observed at all**, because the panel exposes no grant surface
  (§2, SC#5 note 1).
- ⚠ The panel renders the browser's raw `TypeError` message, **"Failed to fetch"**, verbatim as its
  error state. That is not plain human language and says nothing about what happened. The
  *client-side* refusals are excellent by contrast and are worth keeping as the standard:
  *"refused — an address inside a private network is refused"* and *"refused — a plain, unencrypted
  address is refused"*, with `Save is off until the server address starts with https://.`
- ⚠ `https://mcp.invalid-nothing-here.example/sse` is **not** refused client-side (correctly — it is
  a well-formed public HTTPS address), so the *unresolvable* arm can only be distinguished
  server-side. It currently reads identically to every other failure.

---

## 5 · Findings fixed by the reviewer during close

Both were G-3 fast fixes, taken because G-7 blocks a third round.

**`57838680` — the ledger rows `212-05` claimed.** Four were written and were **already stale before
the phase closed** (they predate both gap rounds), and every one understated. Two —
`SettingsPage.tsx` and `ModelPillRow.tsx` — were claimed in the must_have and **never written** (a
fixed-string match returns `0`).

| file | row said | measured at close |
|---|---|---|
| `ConnectionsTab.tsx` | 10 / 3 / 1153 | **13 / 5 / 1414** |
| `ConnectionFormPanel.tsx` | 8 / 4 / 2010 | **9 / 5 / 2009** |
| `connectionsCopy.ts` | 7 / 4 / 573 | **8 / 6 / 573** |
| `connectionFormCopy.ts` | 6 / 4 / 968 | **7 / 5 / 968** |

`ConnectionsTab` crossed 3 → 5 phases and `connectionsCopy` 4 → 6 **inside the gap rounds**, so both
dispositions were written against smaller numbers. Five rows added with sections in the same commit:
`SettingsPage.tsx` **34 / 21 / 1426** (fires; absent for its entire life), `ModelPillRow.tsx`
**4 / 3 / 141**, `connectionRefusalCopy.ts` **1 / 1 / 567**, `servicesCatalog.ts` **2 / 1 / 211**,
`catalogCopy.ts` **1 / 1 / 22**.

⚠ **`SettingsPage.tsx`'s re-open trigger did NOT fire** — 212 never named it in any `files_modified`.
The row closes a known blind spot; it does **not** discharge the trigger, and its section says so.

**`BUG-260810-01` gained a `re_open_trigger`** recording that its cloud half is unverified (§2, SC#3).

---

## 6 · Preflight findings — disposition

All nine from `212-PREFLIGHT.md`, checked in code rather than read from summaries.

| # | Finding | Outcome |
|---|---|---|
| S-1 | `discoverConnectorTools` name collision | ✅ fixed — pre-save call named `probeMcpServer`; the shipped `discoverConnectorTools(id)` and its `McpToolPicker` caller are intact |
| S-2 | phantom type `DiscoveredTool` | ✅ fixed — `McpDiscoveredTool` used; zero occurrences of the phantom |
| S-3 | discover-tools seam, no test mocking neither side | ⚠ **HALF closed** — `test_212_discover_seam.py` pins `server_url`/`tools`/`count` on the real route, but it is backend-only. `McpProbeResponse` is a hand-written frontend type nothing checks against it; a backend rename would typecheck and fail at runtime. **Accepted, deferred to 213**, which touches this API |
| S-4 | `starterPrompts` authored, consumed by nothing | ⚠ still true — `servicesCatalog.ts` declares them, nothing reads them. Correct: CAT-04 is **Phase 216** |
| SEC-1 | new egress endpoint outside the kill switch | ✅ fixed — `connectors.py:743` carries `require_visible("live_connectors")` + `require_org_manage`, with a test pinning the refusal when off |
| SEC-2 | two "or"s in security must_haves | ✅ fixed — `follow_redirects=False` flatly, `trust_env=False`, 2 MB body cap, threadpooled validation |
| REACH-1 | cloud banner pointed org admins at operator-only `/admin` | ✅ fixed — the banner now names the flag instead of linking |
| SKETCH-1 | Popular inside the list | ⚠ **my finding was wrong and was withdrawn.** Screenshot `202011` puts Popular as a card row **above** the list, with the same services also appearing below. Gemini's original shape was right; the correction was issued on `BUS-015` and he restored it |
| SKETCH-2 | tools badge on a not-connected service | ✅ fixed — no such badge exists |

---

## 7 · Owed after this phase

1. ⚠ **SC#3's cloud half** — drive the Add affordance and a one-click Popular connect on a **cloud**
   install. Until then `BUG-260810-01` stays `folded`.
2. ⚠ **SC#4 end to end through the UI** — the probe rendering a tool list, and *"become grantable"*.
   Blocked in part on 213, which builds the grant surface.
3. ⚠ **`/code-review ultra`** on `ac159cc7` — reviewer-authored with no independent verifier, on the
   egress boundary. Also still owed for 210/211: `/code-review ultra review-210-211-base`.
4. ▪ The panel's `"Failed to fetch"` error string (§4).
5. ▪ S-3's frontend half of the seam (§6).
6. ▪ **211's five per-shape UAT rows.** Row 3 (SMTP · `send_email`) is **no longer blocked** — the
   operator created a real Gmail SMTP connection during this verification and it verified
   (`verdict: ok`, `smtp.gmail.com:587`, `starttls`).

---

## 8 · What was NOT verified

- **Nothing was driven on cloud.** Every drive was local, on a flag-flipped install.
- **The delete path was not executed** — only its confirmation sheet.
- **The backend serving `:8000` during the browser drive was launched from system Python, not the
  project venv**, and `POST /connectors/discover-tools` returned `503` there rather than the `502`
  the route's own code produces. The root defect was reproduced and fixed **in the venv**, against
  the real remote server; the `503`'s origin was never identified and is not explained by the
  regression fixed in §3.


---

## 9 · ⛔ Defects found by DRIVING, after the phase was first closed

**Recorded 2026-08-27, during a live operator session.** The phase had already been marked
complete on green gates; **every defect below was invisible to all of them.** They are numbered in
the order they were found, because each one hid the next.

⚠ **The unifying cause of D-1, D-2 and D-3 is one habit: a test that MOCKS THE THING UNDER TEST.**
Each defect had a passing test sitting directly on top of it. A mock proves the caller is
self-consistent; it cannot prove the wire is right.

### D-1 — SNI lost on the IP pin ✅ FIXED (`ac159cc7`)
See §3. Broke **all** MCP discovery, including Phase 206's shipped path.
Hidden by a test that monkeypatched `_post` away and asserted only that `server_hostname` was
*handed* to it — while its docstring claimed *"and SNI"*.

### D-2 — `list_tools` rejected the route's own keyword ✅ FIXED (`474ef7ea`)
`connectors.py:760` calls `list_tools(server_url=, secret=, timeout=)`. The module wrapper omitted
`timeout`, so **`POST /connectors/discover-tools` had never once succeeded**:
`TypeError: list_tools() got an unexpected keyword argument 'timeout'`, observed in the operator's
uvicorn traceback. `McpClient.list_tools` accepted it all along.
Hidden by `test_212_discover_seam.py:88`, whose stub **invented the missing parameter**
(`mock_list_tools(server_url, secret=None, timeout=None)`).

### D-3 — the upstream reason was computed, sent, then discarded ✅ FIXED (`724f9b9f`)
`probeMcpServer` threw a hardcoded `"Failed to probe MCP server"`. `readConnectorReasonCode` only
read an **object** detail with `reason_code`, so this route's **plain-string** details were dropped.
After the fix the operator immediately got two distinct, actionable upstream messages
(`HTTP 401: bad request: missing required Authorization header` from GitHub;
`{"error":"invalid_token"…}` from Notion). Same family as `BUG-260815-06`.

### D-4 — ✅ FIXED (`4aa28090`), operator-confirmed 2026-08-27 — a SAVED MCP connection can never discover its tools
`ConnectionFormPanel` imports **only** `probeMcpServer`, the **pre-save** probe. It never calls
`discoverConnectorTools(id)` — the Phase 206 endpoint that decrypts the stored secret server-side.

In edit mode `draft.secret` is empty **by design** (*"never rendered back to any browser once
saved"*), so the probe posts `secret: undefined` and the remote server sees no `Authorization`
header. **Measured:** `Notion` and `GitHub` both have `secret_ciphertext` stored, and both probes
still failed with *missing Authorization*. The operator regenerated both tokens — which of course
changed nothing, because no token was being sent at all.

**Consequence:** the pre-save probe is the only wired path, and it structurally cannot authenticate
for a connection that already exists. This is the second half of SC#4's *"become grantable"*.

### D-5 — ✅ FIXED (`4aa28090`), operator-confirmed 2026-08-27 — three Popular services have no configurable form
The form reveals fields by service id. Driven in the browser, on a fresh Add panel:

| service typed | fields offered |
|---|---|
| `slack` | Name · **Channel** · **Bot token** |
| `custom_mcp` | Name · **MCP server URL** · **Access token** |
| **`github`** | Name — **and nothing else** |
| **`notion`** | Name — **and nothing else** |

`servicesCatalog.ts` ships `github`, `notion` and `google` as `isPopular: true` with
`markKey: "mcp"`, but MCP fields render only for the literal id `custom_mcp`, and credential fields
only for the three legacy capability shapes. **So `Connect` on GitHub or Notion opens a panel with
nothing to fill and nothing to save — 3 of the 7 Popular services are decorative.**

⚠ **This is SC#3 failing, not polish.** *"connects one of the curated Popular services in one
click"* is false for three of them.

⚠ **AND IT IS A HOLE IN MY OWN VERIFICATION, not only in the build.** §2 recorded SC#3 as driven
locally on the evidence that the Popular row **rendered**. I never clicked through to a configurable
form. Rendering a card is not connecting a service, and the criterion says *connects*.

### D-4b — ✅ FIXED (`4aa28090`), operator-confirmed 2026-08-27 — Slack, Jira and SMTP had no refresh at all

⚠ **FOUND BY THE OPERATOR, DRIVING, AFTER D-4 WAS ALREADY FIXED**, in these words: *"for the old
connections like JIRA and email and slack it does not show discover tools it is only showing check
credentials."*

Correct, and the **same defect family as D-4 — a working endpoint with no button on it.**
`discover_connection_tools` has served the capability shape since **Phase 211**, re-reading the
adapter's own static descriptor with **no network call at all**, precisely so a row saved before an
adapter's `INPUT_SCHEMA` changed can self-heal in one click. **The control was never drawn, so that
arm had been unreachable from the UI for its entire life.**

Two structural halves came with the fix:

* **The error and result nodes were nested inside the `mcp` arm.** A capability refresh could return
  a descriptor and a failure could return a worded reason, and **neither could render.**
* **No `Granted` checkbox on a capability action.** `handleSave` writes `tool_grants` only on the
  `mcp` shape, so a checkbox there is a switch Save silently drops. ⚠ **That is the honest rendering
  of `BUG-260827-02`, NOT a fix for it** — see the disposition below.

### ⛔ Notion returns 0 tools, and it is NOT our defect — measured, not inferred

| connection | `mcp_server_url` | tools |
|---|---|---|
| GitHub | `https://api.githubcopilot.com/mcp/` | **44** |
| DeepWiki | `https://mcp.deepwiki.com/mcp` | 3 |
| **Notion** | **`https://mcp.notion.com/mcp`** | **0** |
| Slack · Jira · Email | *(none — capability shape)* | 1 each |

`https://mcp.notion.com/mcp` is Notion's **official hosted remote MCP server, and it authenticates
by OAuth only.** The stored credential is an internal-integration secret presented as a Bearer
token, which Notion refuses with `403 restricted_resource · "Endpoint unavailable."` — its wording
for *"this credential type may not call this endpoint."*

⚠ **It is not a scope problem and not a page-sharing problem, and a better token cannot fix it.**
GitHub succeeds at today's credential shape because `api.githubcopilot.com/mcp/` **accepts a personal
access token**; that is the entire difference between the two rows.

**So Notion is ⛔ BLOCKED ON PHASE 215 (BYO OAuth)**, exactly as Atlassian Rovo is. Recorded as a
blocked row with its reason rather than dropped — *a scoreboard that lists only what passed is not a
scoreboard.* It is also a live data point confirming the ROADMAP's **MCP-first, then OAuth**
ordering rationale.

⚠ **And the tool counts above are `SEED-214` in one line: 44 · 3 · 1 · 1 · 1.** The three ones are
not thin adapters by neglect — `connector_connections.capability` is a SINGLE column, so a
first-party connection **structurally holds one action.**

### Disposition — ✅ CLOSED 2026-08-27

All five defects fixed and driven. `4aa28090` reconciles the work, `74cf0577` routes what it exposed.

⚠ **G-7 fired (2 rounds used) and this was neither a third round nor a G-3 patch.** It is the
**operator's explicit instruction** that D-4 and D-5 be fixed *in* 212 rather than carried to 213 —
which supersedes `BUS-021`'s closing paragraph and the earlier disposition this block replaces.

**Two things this phase surfaced are routed OUT of it, deliberately:**

* **`BUG-260827-02`** — Gate 6 (`phase_types.py:2511`) is nested inside `if
  connection.mcp_server_url:`, so `tool_grants` is enforced for MCP rows **only** and a capability
  send consults no grant at all. Folded into **213** (GRANT-04). ⭐ **Ordering is binding: the gate
  closes before or with `SEED-214`'s unlock, never after.**
* **`SEED-214`** — the 1:1 lock between a connection and its single action. Its unlock is folded
  into **213**, because that phase's SC#1 (*"every tool a connection offers in one list"*) is
  **unsatisfiable as written** while three of the operator's connections hold one action each.

**Still owed on this phase:**

* `/code-review ultra` on `ac159cc7`, `474ef7ea`, `724f9b9f` **and `4aa28090`** — every fix here is
  reviewer-authored with no independent verifier.
* **The cloud drive of SC#3.** `BUG-260810-01` stays `folded`, never `closed`, until then.
* A **Rovo connector detail screenshot** for 213's design bar (`BUS-019`) — the one the ROADMAP
  cites is not in `screenshots/`.

⚠ **The layout question the operator raised while driving is NOT owed here and must not be patched
here:** *"should we open each one in a pop up window instead of being on the right and splitting the
screen which is already narrow to 2 halves."* `D-27` locked the push/split panel for a **3-5 field
form**; 213's **44-row tri-state grant list** is a different object that neither 400px nor a modal
holds. It is recorded in 213's flags and settled by that phase's **owed G-2 sketch**.
