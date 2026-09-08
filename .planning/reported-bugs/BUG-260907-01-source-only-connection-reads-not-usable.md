---
id: BUG-260907-01
title: A working OneDrive source connection reads "⚠ Not usable" — the row verdict counts action tools and knows nothing about source capability
reported: 2026-09-07
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [frontend/settings, connections, sources, honesty]
folded_into: 239
verified_closed_by: "239"   # driven live 2026-09-08 at 5356bcaf3 — see 239-VALIDATION.md rows 1 and 3
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7370fe543
  date: 2026-09-07
---

# BUG-260907-01: A working source connection is labelled "Not usable"

## What we observed

Immediately after Phase 238's OneDrive connection completed its OAuth round trip, Settings →
Connections showed:

```
Microsoft 365
⚠ Not usable    Used by —    Credential OAuth connected
```

and the detail panel showed, in red:

> *"This connection names a service but no way to reach it yet, so there are no actions to list."*

**The connection is fully functional.** Driven the same session against real Microsoft:

- `check()` → `ok=True`, `drive_type=personal`
- `browse("onedrive")` → 6 real folders
- `list_files()` → 21 files in Desktop, 5 in Dokument, with correct mime, size and
  `lastModifiedDateTime`
- `read_file()` → `Antigravity.lnk`, 1395 bytes, correct `.lnk` magic, size matching the listing
- database row: `service_id=microsoft · status=active · is_enabled=True · last_check_verdict=ok`

So the row is telling a person that the thing they just successfully connected does not work.

Google Workspace on the same page reads `✓ Ready` — not because it is healthier, but because it
happens to have action tools.

## Why it matters

**Major, because it is an honesty defect on the first screen a person sees after connecting.**
The one moment a new connection needs to be legible is right after the OAuth round trip, and the
page says the opposite of the truth. The predictable user response is to disconnect and retry, or
to conclude the integration is broken and stop — for a connection that works perfectly.

It is also self-inflicted by Phase 238: before that phase, a connection with zero actions really
was unusable, so the verdict was correct. Adding a *source* family created a class of connection
the verdict cannot describe.

## Hypothesized cause

**Verified, not hypothesised.** `frontend/src/components/settings/connectionRowVerdict.ts`:

```ts
if (toolCount <= 0) return discoveryHasRun ? "unusable" : "undiscovered"
```

`toolCount` is `discovered_tools.length` — **workflow action tools only**. The Microsoft
connection has `discovered_tools = []` because Phase 238 shipped a `SourceAdapter`
(`services/sources/adapters/microsoft_graph.py`), not connector action tools in
`services/connectors/`. Clicking *Refresh actions* sets `discoveryHasRun`, which flips
`undiscovered` → `unusable`.

⚠ **The file's own docblock shows this was reasoned about carefully for the case that existed
then** — it was written *because* Microsoft 365 once claimed `✓ Ready` with zero tools, and it
explicitly refuses to call an undiscovered row unusable ("absence read as success is the old
defect"). The logic is sound; its **input set is now incomplete**. It has no way to ask *"can
this connection be browsed as a source?"*, and as of Phase 238 the server can answer that:
`GET /connectors/source-families` publishes the registry.

## Suggested fix

Add a fourth input, `isSourceCapable`, fed from the families route the same phase added, and
return a verdict that names what the connection *can* do rather than only what it cannot:

- actions > 0 → existing behaviour, unchanged
- actions == 0 **and source-capable** → a positive verdict (e.g. `source-only` / "Ready as a
  source") — it can browse, preview and be watched
- actions == 0 and not source-capable → today's `unusable` / `undiscovered` split, unchanged

⛔ Do **not** fix this by making zero-action rows read `Ready` again — that is the exact defect
`connectionRowVerdict.ts` was created to close, and reintroducing it would be worse than the
current wrong label.

## Surface classification

`Agentic-RAG` — our own UI, our own verdict function.

## Suggested routing

- **Fold into in-flight phase:** n/a — Phase 238's plans are executed and committed. Folding a
  new frontend capability into a closed phase is the G-7 anti-pattern.
- **Defer to future phase / milestone:** **Phase 239** is the natural home. It adds MCP file
  sources, which are the *second* family of source-only connections — it will hit this exact
  label, and it already touches the families route.
- **Plant as seed:** n/a — it has a concrete home one phase away.
- **External — note only:** no

## Workarounds

None needed for function — the connection works. For a person reading the page: the
`Credential OAuth connected` text on the same row is accurate, and Library → Add files will
offer the connection regardless of this label.

## Reference / evidence links

- `frontend/src/components/settings/connectionRowVerdict.ts` — the verdict, and its docblock
  explaining the defect it was built to close
- `backend/app/api/connectors.py` → `GET /connectors/source-families` (Phase 238 / D-238-08) —
  the input this verdict needs and does not yet read
- `.planning/phases/238-microsoft-graph-onedrive/238-VERIFICATION.md` — the live drive proving
  the connection works
- Commit `7370fe543`

---

## ✅ CLOSED 2026-09-08 — driven live, not inferred

Verified in the running app at `5356bcaf3` (Chrome MCP, Settings → Connections). **Microsoft 365 — the
connection this report was filed against — reads `✓ Ready as source`.** It read `⚠ Not usable` before
Phase 239.

⚠ **Closed on DISCRIMINATION, not on the words appearing.** A verdict that printed the new label
everywhere would be a worse bug than the one reported. Read verbatim, same page, same moment:

| Row | Shape | Verdict |
|---|---|---|
| Microsoft 365 | source-capable, 0 action tools | **`✓ Ready as source`** |
| DeepWiki | MCP, 3 action tools, no `source_tools` | `✓ Ready` — not "as source" |
| Jira – KAN | bad credential | `✕ Credential failed` |
| Linear · Figma · Sentry | never contacted | `Not connected` |

And while this same connection was still `⏻ Disabled`, it did **not** claim readiness — so both sides
of the status gate are evidenced, not just the happy one.

⚠ **The fix as originally PLANNED would not have closed this report.** Phase 239's plan specified
`Boolean(mcp_server_url)` as the capability test — a client-side guess at something only the server
knows, which would have printed `✓ Ready as source` on rows that resolve no adapter. The executor
caught it; a later code review then found a third over-claiming arm (`HI-01`) still live. **Both are
fixed and both were re-driven here** — see `239-VALIDATION.md` row 3.

**Not claimed by this closure:** F-6 (the discovery receipt) is UNVERIFIED, and `BUG-260908-02` — a
*disabled* connection still offered in the Library source picker — was found by this same UAT and is
a separate, open defect.
