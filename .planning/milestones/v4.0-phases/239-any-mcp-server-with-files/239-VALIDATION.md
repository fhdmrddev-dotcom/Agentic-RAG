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

---

# SC#2 — DRIVEN 2026-09-08 against a real second server. **PARTLY MET. NOT met.**

**Server 2: GitHub MCP** (`api.githubcopilot.com`), already connected and authenticated. Bound
**entirely through the UI**: `list_tool = get_file_contents`, `read_tool = get_file_contents`,
root `fhdmrddev-dotcom/Agentic-RAG`.

⭐ **THE ZERO-CODE CLAIM IS PROVEN, and it was proven the strict way**: `git rev-parse HEAD` read
`91e8cc4ba` **before and after**, `git log <base>..HEAD -- backend frontend` returned **0**, and
`git status --porcelain` was **empty** throughout.

## What worked — with no code at all

- The binding saved and persisted as data on the connection row.
- **GitHub appeared in the Library's "From a connected source" picker**, where it had never been —
  it previously offered only Google Workspace and Microsoft 365.
- `GET /connectors/connections/{id}/browse` **fired and returned `200`**.
- ⭐ **And the reverse held too**: clearing the binding removed GitHub from the picker again, still
  with zero code. **The rows control the family in BOTH directions**, which is a stronger result
  than the criterion asked for.

## What did not — and this is SC#2's actual answer

**The listing came back EMPTY**: *"GitHub · 0 documents · 0 chunks · 0 jobs · 0 folders"*, `Add 0`.

Verified in both directions rather than inferred:

- `mcp_source.py:822` sends `{"path": folder_path}`; `:956` sends `{"path": file_id}` — **a lone
  `path`, always**.
- GitHub MCP's `get_file_contents` requires **`owner` + `repo` + `path`**, three separate arguments.
  Confirmed by invoking that same tool directly against that same server.

⭐ **So the contract carries tool NAMES as data and tool ARGUMENT SHAPES as code.** The first half is
genuinely proven — `list_directory` vs `ls` vs `get_file_contents` really is a row. The second half
was never exercised by anything, because `SEED-257` records that no MCP file server could be driven
locally at all.

⚠ **Recorded as a finding AGAINST Phase 232's contract, which is what ROADMAP 239 instructs**:
*"naming the specific thing the contract could not express."* **The specific thing is a tool's
argument shape.** Full analysis and four unranked options: **`SEED-259`**.

## ⛔ The separate, more urgent half

**It failed as `HTTP 200` with an empty listing, not as an error** — review finding `HI-03`'s
fail-open shape, reproduced on a different path after `HI-03` itself was fixed. An empty-but-complete
listing is exactly what the **`H-5` deletion guard** consumes: on a watched folder, *"the source
returns nothing"* is indistinguishable from *"everything was deleted"*.

⚠ **Nothing was lost** — this was a browse, no watch was created, and the binding has been reverted
so the operator's environment is as it was found. But **a misbound server that reads as empty is one
`Add Watched Folder` away from being a deletion signal**, and that should be treated as more urgent
than the shortfall itself.

## Verdict

⛔ **SC#2 is NOT met**, and it should not be marked met on the picker evidence alone. It is
**partly** met — decisively so on "rows, not code" for registration, resolution and surfacing, and
**not** met on "a second, different MCP file server works". `SEED-259` is the ruling the criterion
now waits on, and it is an operator decision, not a build task.

---

# SC#2 — RE-DRIVEN 2026-09-08 after `SEED-259`'s option 2 shipped

Tree `f57cf35dc`. Same second server (**GitHub MCP**), same method, now with argument mapping.

## ⭐ The UI derived the whole mapping from the server's own schema

Binding `list_tool`/`read_tool` to `get_file_contents` **changed the form in front of me**:

- `Argument that carries the path` turned from a free-text box into a **picker**, offering
  `fields · owner · path · ref · repo · sha` — **GitHub's actual `get_file_contents` arguments**,
  read from its published `inputSchema`.
- **Two rows appeared, labelled `owner` and `repo`** — exactly the other required arguments.

⛔ **No vendor name is involved anywhere.** The product had never heard of GitHub; it read the
server's schema and asked for what that schema requires. **That is "rows, not code" doing the thing
it claims.**

Also on screen, unprompted: *"10 tools whose name says they change something are not offered here —
whatever is bound is called on every file, unattended, on every check."*

## ⭐ THE FAIL-OPEN IS CLOSED, and this is the headline

**Same connection, same folder, before and after:**

| | Result |
|---|---|
| Before (`0926df45e`) | **`200` + empty listing** — `0 documents · 0 chunks · 0 folders` |
| After (`f57cf35dc`) | **`502`** — *"The provider said: MCP server responded with HTTP 401: unauthorized: AuthenticateToken authentication failed"* |

⭐ **A silent empty listing became a named error carrying the provider's own words.** That is review
finding `HI-03`'s exact class — and an empty-but-complete listing is what the **`H-5` deletion
guard** consumes, so the old behaviour was one `Add Watched Folder` away from reading as *"everything
was deleted"*. **Demonstrated in the running product, not in a fixture.**

## Where SC#2 actually stands

- ✅ **Zero code, again** — the entire mapping was set through the UI.
- ✅ **The call is constructed and dispatched** with the mapped arguments; it reached the server and
  got a real HTTP response. Before this work the same binding produced nothing at all.
- ⛔ **The listing still did not come back — but the reason has MOVED, and that is the point.** It is
  no longer *"the contract cannot express this server's argument shape"*. It is now
  **`HTTP 401` — the connection has no usable credential for the MCP endpoint**; the Connections page
  shows its Credential as `—`. **That is an operator credential matter, not a defect and not a
  contract limit.**

⚠ **SC#2 is therefore STILL NOT MET, and must not be marked met on this evidence.** What changed is
that the *blocking reason* is now a credential rather than a design gap. **The final row is: bind a
second MCP file server whose credential actually authenticates, and see a real listing.** That row is
owed and it needs a working credential nobody has supplied yet.

⚠ The GitHub connection was **reverted to its prior unbound state** after this drive; the operator's
environment is as it was found.

---

# ⭐ SC#2 — **MET**, driven 2026-09-09 against a real second MCP file server

Tree `b918c408e`. Operator supplied a GitHub PAT; everything else was set through the UI.

## The zero-code claim, proven the strict way

`git rev-parse HEAD` read **`b918c408e` before AND after**; `git log <base>..HEAD -- backend frontend`
returned **0**; `git status --porcelain -- backend frontend` was **empty**. **No code was written,
edited or committed between server one and server two.**

## What was driven

**Server 2: GitHub MCP** (`api.githubcopilot.com`) against the public repo
`modelcontextprotocol/servers`, root `src`. Bound entirely as rows: `list_tool` / `read_tool` =
`get_file_contents`, `arg_path` = `path`, statics `owner` / `repo`.

⭐ **Its file vocabulary has NOTHING in common with the reference server's.** Not `list_directory`,
not `read_file`, and it needs **three arguments where the contract sends one** — which is exactly the
gap `SEED-259` opened and `239-06`/`239-07` closed.

| Step | Result |
|---|---|
| `browse(mcp:root)` | **`200`** — 7 real folders: `src/everything · src/fetch · src/filesystem · src/git · src/memory · src/sequentialthinking · src/time` |
| `browse(src/time)` — recursion | **`200`** — `src/time/src`, `src/time/test` |
| `POST /preview` | **`200`** — real files with buckets, reasons, sizes |

⭐ **The preview is the strongest single piece of evidence**, because it is Phase 233's four-bucket
machinery running on a family nobody wrote a line of code for, and it stayed HONEST:

> *"No extension and no declared type. The source will not say what this is, so we cannot tell
> whether it is readable until we open it."*

⭐ And `modified_at: "size:5"` — **`D-239-06`'s deterministic size fallback firing exactly as
designed**, because GitHub's listing carries no timestamp. A decision made at planning time, first
exercised here by a server chosen months later.

## The credential detour, recorded because it is the useful part

1. **`HTTP 401`** before the PAT — no credential.
2. **`HTTP 404`** with the PAT, against `fhdmrddev-dotcom/Agentic-RAG`. **Not a contract failure:**
   the operator's PAT belongs to `fhdmrd` and the repo to `fhdmrddev-dotcom`, so GitHub correctly
   reported it as not found. Re-pointed at a **public** repo to isolate credential scope from the
   contract — and the contract worked.

⚠ **Every one of the three responses was a NAMED error carrying the provider's own words**, never
the `200`-plus-empty that this phase's earlier drive produced. The fail-open closed by `239-06` stayed
closed under three different real failures.

## Verdict

✅ **SC#2 MET.** *"Adding that source added rows, not code — a person can add a second, different MCP
file server afterwards with no change to the product at all."* **Driven, with the zero-code claim
proven by commit hash rather than asserted.**

✅ **SC#3 substantially met** — it browses, recurses and previews with the same machinery as Drive.
⚠ **NOT driven: deletion, disconnect and visibility behaviour**, and no watch was created (that would
ingest real files into the operator's Library). Those rows remain owed and are named rather than
absorbed.

⚠ The GitHub connection was **reverted to unbound** afterwards; the operator's environment is as it
was found.
