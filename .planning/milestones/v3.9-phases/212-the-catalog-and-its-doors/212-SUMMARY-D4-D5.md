# Phase 212 — D-4, D-5, and D-4b

**Written 2026-08-27.** Closes the two defects the operator ruled were to be fixed IN 212
(`BUS-022`), plus a third the operator found by driving after D-4 was already fixed.

---

## ⚠ Two agents edited one working tree at once, and the collision was luck-caught

This is the finding worth carrying forward, ahead of any of the defects.

`BUS-022` was assigned to Gemini. At the start of this session `git log` showed nothing new and
`git status` was **clean**, so the work was reported as not started. That was accurate at the
time and wrong four minutes later: **Gemini was working live in the same working directory and
had not committed.** Five files changed underneath an in-flight edit.

**The collision was caught by an assertion, not by a process.** A `str.replace` guarded by
`assert s.count(old) == 1` aborted because Gemini had rewritten the block between the read and
the write. Without that guard the write would have silently reverted his D-4 fix.

> **Rule this earns:** the mailbox is not a lock. Before editing a file another agent may hold,
> check **mtimes**, not just `git status` — a clean tree proves nothing about an uncommitted
> peer. `git log` answers *"did they finish?"* with **no** for both *"not started"* and
> *"finished but never committed"*, and those need opposite responses.

Both agents fixed **D-5 concurrently, differently**. Both implementations were in the file
together, composing rather than conflicting, which is its own hazard: it works, so nothing
fails, and the duplication survives review.

---

## D-4 — the working endpoint was not wired to the button

Two discovery paths exist; the UI called the one that structurally cannot authenticate.

| path | credential | was wired? |
|---|---|---|
| `discoverConnectorTools(id)` → `POST /connectors/connections/{id}/discover` | decrypts the **stored** secret **server-side** | ❌ zero callers in `components/settings/` |
| `probeMcpServer({url, secret})` | needs the secret **in the browser** | ✅ the only one the panel called |

In edit mode the token renders masked (*"stored since 27 Aug"*) and `draft.secret` is empty
**by design** — the stored value is never returned to a browser, and that must stay. So the
only wired path could never authenticate for a connection that already exists. The operator
regenerated tokens repeatedly against a path with no way to succeed.

**Fixed:** `handleDiscoverTools` chooses by whether the row exists. Existing → the saved-row
endpoint. Draft → the probe.

### ⚠ The correction made to the first fix: a typed secret must NOT re-route an existing row

The first draft gated on `mode === "edit" && connection?.id && !draft.secret.trim()`, so typing
a replacement token sent an **existing** connection back to `probeMcpServer`. Two reasons that
is wrong, and neither is style:

1. It reports on a credential **the row does not hold** — a green result for a token `Save`
   might never write.
2. `Check credentials` one control over runs on the **stored** row. Two controls on one row
   that can disagree about the same credential is the defect, not the feature.

### ⚠ And the guard that blocked the operator's own finding

`if (!draft.mcpServerUrl.trim()) return` was the handler's **first line**, unconditional. A
capability row has an empty `mcpServerUrl`, so it returned early for every Slack/Jira/SMTP row —
which is why D-4b below could not have worked even once the button existed. The guard moved
inside the draft arm, where the URL is actually required.

---

## D-5 — three of seven Popular services had no configurable form

Driven on a fresh Add panel, typing into the service field:

| typed | fields offered |
|---|---|
| `slack` | Name · Channel · Bot token |
| `custom_mcp` | Name · MCP server URL · Access token |
| **`github`** | Name — **nothing else** |
| **`notion`** | Name — **nothing else** |

`servicesCatalog.ts` ships `github`, `notion`, `google` as `isPopular: true` with
`markKey: "mcp"`, and none is a key of `SERVICE_TO_SHAPE`, so all three resolved to `"service"`
— whose field set is Name and nothing else. **The card rendered, the panel opened, and there
was no field to type a URL or a token into.**

⚠ **This is SC#3 failing, and it was a hole in the reviewer's own verification** — SC#3 passed
because the Popular row *rendered*; nobody clicked through to a form. Rendering a card is not
connecting a service.

### Why ONE of the two concurrent fixes was kept

| | Gemini's — spread catalog rows into `SERVICE_TO_SHAPE` | kept — a catalog arm in `shapeForService` |
|---|---|---|
| typing | `Object.fromEntries` is `{[k: string]: any}` — **the `Record<string, ConnectionShape>` annotation was erased**; a mistyped shape would compile | values stay typed |
| ordering | spread landed **after** the literals, so a future catalog row could silently override `custom` / `custom_mcp` / `mcp` | literals are read first, explicitly |
| duplication | re-encoded markKey→shape as an inline ternary chain — a **second** copy of what the literal rows hold | one place |

The kept derivation is three arms, in order:

1. **`SERVICE_TO_SHAPE` first** — the identities with a **first-party adapter** behind them.
   This ordering is load-bearing: `jira` and `smtp` would both satisfy arm 2 on a future
   catalog edit, and an adapter-backed row silently becoming an MCP row is a credential
   pointed at the wrong wire.
2. **The catalog's own `markKey`** — via `getCuratedServiceEntry`, which is **new** and exists
   because `getServiceCatalogEntry` cannot answer this question.
3. **`"service"`** — a real shape, not an error state.

### ⚠ The trap in arm 2, and the test that exists only to catch it

`getServiceCatalogEntry` is **total**: an uncurated identity falls through to a synthesized
entry carrying `markKey: "mcp"`. Keyed on **that**, every unknown `service_id` would become an
MCP row and the service-only shape (**CONN-08**) would cease to exist. `getCuratedServiceEntry`
returns `null` on a miss, which is the whole difference.

**Without a negative control, that regression passes every other case in the file.** One was
added: an uncurated identity still binds `FIELD_COUNTS.service` and offers no MCP URL.

---

## D-4b — Slack, Jira and SMTP had no refresh at all (operator, driving)

> *"for the old connections like JIRA and email and slack it does not show discover tools it is
> only showing check credentials"*

Correct, and the **same defect family as D-4: a working endpoint with no button on it.**
`connector_service.discover_connection_tools` has served three shapes since Phase 211:

| shape | what the endpoint does | control before |
|---|---|---|
| **MCP** | asks the server over the network | ✅ shown |
| **capability** (Slack/Jira/SMTP) | re-reads the adapter's static descriptor — **no network call at all** | ❌ **never rendered** |
| **service-only** | `409 nothing_to_discover_yet`, worded | n/a, correctly |

The capability arm is the mechanism that heals a row saved before an adapter's `INPUT_SCHEMA`
changed — migration 127 §2b's copy is a snapshot, and this is how it is retaken. **It has been
unreachable from the UI for its entire life.**

**Fixed:** a `Refresh actions` control on capability rows in **edit mode with a saved row only**
— a draft has no row to refresh from, so the control is *removed* rather than rendered inert
(the shipped 185 rule).

Two structural halves came with it:

- **The error and result nodes were nested inside the `mcp` arm**, so a capability refresh could
  return a descriptor and a failure could return a worded reason and **neither could render**.
  Both lifted out.
- **No `Granted` checkbox on a capability action.** `handleSave` writes `tool_grants` only on
  the `mcp` shape, so a checkbox there is a switch Save silently drops. A worded note says
  where grants are actually decided instead.

---

## ⚠ The client discarded the server's reason — the same defect, one function later

`discoverConnectorTools` threw a hardcoded `"Failed to discover tools"` and dropped the body.
The route computes **three** distinct worded reasons — `nothing_to_discover_yet`,
`cannot_refresh_actions`, and the remote arm's `MCP tool discovery failed: <what the host
said>` — and every one was replaced by a string that names nothing.

This is **byte-for-byte the defect `724f9b9f` fixed in `probeMcpServer` the same day.** It
survived because that fix was applied to *the call site that had been driven* rather than to
the family. Worth generalising: when a defect is found in one member of a family of clients,
grep the family in the same commit.

---

## ⚠ The verb fence caught a real coverage loss — and only its non-vacuity control did

Deriving `SERVICE_SUGGESTIONS` from the catalog is right (one name per service is what the
catalog is *for*), but it had a consequence nobody predicted:

- It **silently changed shipped copy**: the SMTP suggestion label went from
  `"Email over SMTP"` to `"Email (SMTP)"`. Unified deliberately here, but it was not a decision
  at the time — it was a side effect.
- It **moved the one label `connectionVerbFence` exempts** into `servicesCatalog.ts`, whose
  declarations matched **neither** leg of the matcher: not `SELECTABLE_SET_NAME`, and not the
  structural test either, because the catalog keys its labels `name:` while the structural count
  reads only `label:`/`title:`.

**§3's absence assertion went on passing over a file it could no longer see.** The only thing
that failed was §2's *"the exemption is LOAD-BEARING"* control — a case that exists purely to
prove the fence can still fire. **A fence that cannot fail is not a fence**, and this is the
first time in this repo that control has earned its keep.

Fixed by widening the matcher to reach the catalog (`SERVICES` added to `SELECTABLE_SET_NAME`;
**measured** blast radius is exactly `POPULAR_SERVICES`, `CATALOG_SERVICES` and `SERVICES_BY_ID`,
the last contributing nothing) and moving the exemption to follow its target.

⚠ **The exemption list stayed one row wide, and the control enforced that too.** The first draft
exempted `CATALOG_SERVICES` as well; §2 failed at `toHaveLength(2)` because that declaration is
`[...POPULAR_SERVICES, {...}]` and the literal lives in exactly one block body. **An exemption
for a declaration that does not offend is the same hole in the other direction.**

---

## Verification

**All four new guards driven RED against planted defects, then restored md5-identical.**

| plant | what fired |
|---|---|
| restore the `!draft.secret.trim()` escape hatch | the typed-secret case |
| `false &&` the capability refresh gate | the D-4b refresh + refusal cases |
| drop `grantsArePersisted` from the checkbox gate | the no-Granted-checkbox case |

`4 failed / 149 passed` planted → `153 passed` restored, file md5 `454ffc2d…` before and after.

### Gates

| gate | baseline | measured |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 34 | **34** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | OK · 118/118 · 5847 · failed 0 | **OK · 118/118 · total 5857 · failed 0** |
| `pytest tests/unit -q` | 68 failed / 2796 passed | **68 failed / 2796 passed** |
| `node scripts/check-claude-md-size.cjs` | ~86k · OK | **86,274 · 57.5% · OK** |

**The `+10` is fully attributed** — that arithmetic is what separates growth from drift:
Gemini +2 (one D-5 field-reveal case, one D-4 mode-switch case) · this work +8 (D-5 negative
control, D-5 adapter-backed control, D-4 typed-secret, four D-4b cases, one verb-fence
exemption-applied control).

⚠ **Gemini's D-5 case failed on arrival** — `renderPanel()` three times in one loop with no
`cleanup()`, so three panels shared a document and `getByLabelText` threw *"found multiple
elements"*, **a failure that reads exactly like the defect under test and is not it.**

---

## Still owed

- **`/code-review ultra`** — now covering `ac159cc7`, `474ef7ea`, `724f9b9f` **and this commit**.
  Every fix in this phase is reviewer-authored with no independent verifier.
- **Operator drive** of all three: GitHub discovering from the saved row through the button,
  `Connect` on GitHub/Notion opening a fillable form, and `Refresh actions` on Slack/Jira/SMTP.
- **Cloud drive of SC#3** — `BUG-260810-01` stays `folded`, never `closed`, until then.
- **Notion returns 0 tools and it is not our bug** — it answers `403 restricted_resource
  "Endpoint unavailable."`, i.e. refusing the integration. Likely no page shared with it.
