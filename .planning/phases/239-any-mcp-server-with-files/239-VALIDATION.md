# Phase 239 — G-4 lived-experience UAT

**Driven:** 2026-09-08, Chrome MCP against the local app (`localhost:5173` + backend `:8000`).
**Tree:** `5356bcaf3` — both gap-closure rounds merged.
**Driver:** claude (the builder). ⚠ **Recorded as a limitation, not hidden:** `OV-239-01` leaves this
phase with no agent reviewer, so these rows are self-driven. The operator was present for the setup
and enabled the Microsoft 365 connection; the rows themselves were driven unattended.

---

## Scoreboard

| # | Row | Verdict |
|---|---|---|
| 1 | A source-capable connection with zero action tools reads **✓ Ready as source** | ✅ **PASS** |
| 2 | *Refresh actions* seeds the tool pickers immediately, without reopening the panel (F-6) | ⚠ **INCONCLUSIVE — not a pass** |
| 3 | **Negative control:** a connection that cannot browse must NOT claim source readiness | ✅ **PASS**, on two independent surfaces |

---

## Row 1 — PASS

**Microsoft 365** — the exact connection `BUG-260907-01` was filed against — reads **`✓ Ready as
source`** in Settings → Connections. Before this phase it read `⚠ Not usable`.

⚠ **A pass here needs more than the words appearing; it needs the verdict to DISCRIMINATE.** Read
verbatim from the same page, same moment:

| Row | Shape | Verdict |
|---|---|---|
| Microsoft 365 | source-capable, 0 action tools | **`✓ Ready as source`** |
| DeepWiki (206.1 UAT) | MCP, 3 action tools, **no** `source_tools` | `✓ Ready` — **not** "as source" |
| Notion | MCP, action tools | `✓ Ready` |
| Jira – KAN | bad credential | `✕ Credential failed` |
| Linear · Figma · Sentry · Intercom · Miro | never contacted | `Not connected` |

**Five distinct verdicts across five distinct shapes.** A fix that merely printed the new words
everywhere would show one.

⚠ Also confirmed while the connection was still `⏻ Disabled`: it did **NOT** claim readiness. TM-239-07
requires a disabled row to stay silent, and it does. That arm was observed before the operator enabled
it, so both sides of the status gate are evidenced.

Screenshot: `claude-chrome-screenshots-DgXNkA/screenshot-1788841160701-0.jpg`.

## Row 3 — PASS, on two surfaces

This is the row that mattered most: **wave 3 caught a FALSE GREEN in its own plan**
(`Boolean(mcp_server_url)`), and the review then found a third over-claiming arm (`HI-01`) that was
still live — `custom_mcp` short-circuiting a family check before any evidence was consulted.

1. **Settings → Connections.** DeepWiki is a connected `custom_mcp` row with **no** `source_tools`.
   It reads `✓ Ready`, **not** `✓ Ready as source`. Pre-`HI-01`-fix this row would have claimed source
   readiness it cannot deliver.
2. **Library → Ingestion → "From a connected source".** The picker offers **`Google Workspace`** and
   **`Microsoft 365`** and nothing else. **DeepWiki is absent.** The review's repro was that such a
   server *"prints ✓ Ready as source and appears in `CreateWatchModal`"*; it now does neither.

## Row 2 — INCONCLUSIVE, and the reason is itself a finding

Pressing **Discover tools** on DeepWiki returned **`✓`** — discovery succeeded — and **both pickers
still read `Not set`**.

**That is CORRECT behaviour, and it is why the row cannot be scored.** DeepWiki's tools are
`ask_question`, `read_wiki_contents`, `read_wiki_structure` — **wiki-topic tools for a GitHub
repository, not a file surface.** Auto-detection binding `read_wiki_structure` as a directory lister
would have been a wrong guess. **With nothing to seed, the receipt behaviour F-6 describes cannot be
observed either way.**

⛔ **Do not read this as a pass.** F-6 needs a server whose tools genuinely auto-detect. Until one is
driven, F-6 is UNVERIFIED IN THE PRODUCT.

⭐ **What the row DID prove, unplanned:** `read_wiki_contents` is described by its server as *"View
documentation about a GitHub repository."* That is exactly the description-shaped language `CR-02`
warned could steer a binding — and **it steered nothing.** The detector judged the tool's own name and
declined. **`CR-02`'s fix is confirmed in the running product, not only in a unit test.**

Also rendered honestly on that panel, verbatim: *"This server does not say whether this action only
reads. Treated as if it changes things."* — the untrusted-hint rule, stated to the user rather than
assumed.

---

## What this UAT found that no test did

**`BUG-260908-02` — a DISABLED connection is still offered in the Library's source picker.** Observed
while Microsoft 365 read `⏻ Disabled` and the picker listed it anyway. Same *shape* as `HI-01`, a
different defect: `HI-01` was a capability short-circuit, this is a missing **status** gate on a
surface that starts an ingest. ⚠ Filed with an honest limit — the connection was enabled immediately
after, so it is recorded verbatim and **not re-verified**.

⚠ **Why nothing caught it, and this is the durable lesson:** the frontend round reported that
**`ConnectedSourceSection` and `CreateWatchModal` have NO test suite at all.** Both defects that
reached this surface reached it through the same hole. **A surface with no suite cannot regress,
because it was never held.**

---

## Still owed — the phase is NOT closed

1. ⛔ **SC#2 remains UNMET, and a correction to the record: DeepWiki is NOT a second MCP FILE server.**
   An earlier recommendation in this phase proposed it as one, reading its tool *names* rather than
   what they do. Its surface is wiki topics, not files. **SC#2 still needs a genuine public HTTPS MCP
   file server, and none is yet named** — see `SEED-257`, which records that stdio is unsupported and
   `egress.py` refuses loopback and `http://` by deliberate design.
2. ⛔ **F-6 unverified** (row 2 above).
3. ⛔ **`HI-04`'s root-path UI control is in nobody's scope** and was refused under G-7 by the frontend
   round. **Until it ships, no MCP source can be pointed at a real folder through the product** — which
   independently blocks SC#2.
4. ⚠ **`MAX_MCP_BODY_BYTES`** caps MCP file import at ~1.5 MB; an operator decision, still open.
