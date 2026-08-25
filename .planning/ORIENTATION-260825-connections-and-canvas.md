# Orientation — 2026-08-25: where v3.8 stands, what the connections story actually is, and the canvas shape

**Written for:** a fresh session, and for Gemini picking up discuss → plan → execute.
**Read this before scoping anything.** It is a map, not a decision — every decision it points at
lives in the document named beside it.

---

## PART 1 — v3.8: what is captured, what is covered, what is left

**Milestone:** *Document Intelligence, Automations & Connectors*, opened 2026-08-24.
**Phases:** 201–206 CORE, plus inserts 204.1 / 206.1 / 206.2 / 206.3, plus guardrail-debt 207 / 208.

| Phase | What it delivers | Status |
|---|---|---|
| 201 | CSV / spreadsheet → `document_tables`, `query_table` works on CSV | ✅ |
| 202 | Table chunks injected into `document_chunks` so semantic search finds cell facts | ✅ |
| 203 | `.msg` / `.eml` parsing, thread dedup, attachment links | ✅ |
| 204 | Cron/interval scheduler + spend caps + **a brake that really stops work** (L-01) | ✅ verified live |
| 204.1 | The library card says a workflow runs itself | ✅ seen in browser |
| 205 | Stateful / incremental workflows — a run reads its own prior state | ✅ |
| 206 | **MCP connector client** — official MCP servers, per-tool grants, no per-vendor code | ✅ |
| 206.1 | Settings → Connections can CREATE an MCP connection | ✅ 5/5 |
| 206.2 | An MCP connection can be BOUND to a step, discovered, granted | ✅ 6/6, driven live |
| 206.3 | A workflow reaching outside can PUBLISH | ✅ 6/6, independently verified |
| 207 | `api.ts` split (guardrail debt) | ✅ ⚠ no GSD ceremony |
| 208 | `CLAUDE.md` split (guardrail debt) | ✅ ⚠ no GSD ceremony |
| **209** | **A step says what it actually does** | ⬜ **THE ONLY PHASE LEFT** |

**Requirements:** TAB-01, TAB-02, EML-01, EML-02, SCHED-01, SCHED-02, L-01, STATE-01, STATE-02,
CONN-02, CONN-03 — all delivered. (CONN-01 shipped in v3.6.)

### So: v3.8 is one phase from done, and that phase is a *legibility* phase, not a capability one.

⚠ **Two process debts carried into this milestone**, both audited under `STATE.md → Guardrail
overrides`: 207 and 208 ran with **no discuss/plan/execute and no independent verification**, and
their CONTEXT/SUMMARY/VERIFICATION were written after the fact. 207 additionally **owes a live smoke
of the app** — it moved the module every screen loads through, and no page was ever opened.

---

## PART 2 — connections, MCP and authentication: what is TRUE today

This is the part that is easy to get lost in, because the story was **rewritten mid-milestone** and
several early claims were later **refuted by measurement**. Here is only what survives.

### 2.1 What actually works, driven in a real browser against a live server

The full round trip is real. On 2026-08-25, against `https://mcp.deepwiki.com/mcp`:

```
create connection (Settings)  →  bind to an external_action step (Builder)
   →  discover tools  →  grant one  →  run
        grant OFF ⇒ tool_refused / permission_denied
        grant ON  ⇒ external_action_sent, raw_status 200, DeepWiki's real page list returned
   →  publish (206.3)  ⇒  status='published', v1
```

**That is a genuine, governed, end-to-end integration path**, and it needs zero per-vendor adapter
code. It is the thing v3.8 set out to prove.

### 2.2 ⚠ The direction question — and the two claims that were WRONG

`SEED-202` (the operator's vision, recorded verbatim) said `external_action` is **write-only** and
that half the vision — *"go to Slack and READ"* — was therefore impossible.

⛔ **That was REFUTED at source.** `phase_types.py:2542` already returns the tool's text into
`accumulated_outputs`. **The read-and-blend step is executable at HEAD** against any MCP server
exposing a read tool. What is missing is much smaller and much cheaper than the seed claimed:

1. a way for a step to **declare its direction**, and
2. a first-party path **for someone who does not know what MCP is**.

⛔ **A second claim was also refuted:** *"it stopped for an approval it did not need."* MCP specifies
`readOnlyHint: false` and `destructiveHint: true` as defaults — an unannotated tool is *specified* to
be treated as destructive. **Our gate defaulted correctly.**

### 2.3 ⭐ The open question was ANSWERED LIVE, and the answer closes a door

The competitor study called one question *"the thing the whole direction rests on"*: **do real MCP
servers set `readOnlyHint`?** A raw `tools/list` was driven against three servers.

| Server | Result | `annotations` | `outputSchema` |
|---|---|---|---|
| DeepWiki | 200 · 3 tools | ⛔ **absent on all 3** | ✅ **present on all 3** |
| Atlassian | **401 invalid_token** | unreachable | — |
| GitHub | non-JSON (gated) | unreachable | — |

- ⛔ **`readOnlyHint` CANNOT be the direction mechanism.** `read_wiki_structure` — a tool whose *name
  begins with "read"* — ships no hint at all. A design reading direction from the annotation has **no
  signal** against the one server we can reach. Use it as an optimisation when present, never as the
  mechanism. **A mechanism that works only on servers that opt in is not a mechanism.**
- ✅ **`outputSchema` is present on every tool — and `mcp_client.py:293-296` throws it away**, along
  with `annotations` and `title`. That is the output-shape answer arriving from a real server today
  and being discarded. **This is the cheapest actionable finding in the whole thread.**

### 2.4 Authentication — the honest state

- **There is NO OAuth in this product.** None. Connections carry static credentials.
- **Measured, not predicted:** 2 of the 3 MCP servers tried are **unreachable without OAuth**.
- Of the operator's eight named services, **six are reachable at today's credential shape**; only
  **Google** and **Microsoft Graph** need OAuth.
- ⚠ **Sequencing consequence:** a "Google + Microsoft first" tier front-loads 100% of the OAuth cost
  before a single read ships. **Start with the six that work.**

### 2.5 What is NOT in v3.8, and is a milestone of its own

`.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` — the connection model as a platform asset, breadth
(the "famous applications" catalog), catalog IA, per-connector prompt suggestions, the **approval
model as a hard prerequisite**, inbound/Open Platform, and OAuth. ⚠ **`SEED-202` is the requirement
that milestone should be scoped against**, and the study's four owed questions are now answered in
`.planning/research/connections-competitor-study.md`.

⚠ **Standing rule, do not break it:** never add an outbound capability to `_TOOL_REGISTRY` before the
approval model exists. Every capability is a WRITE.

---

## PART 3 — the canvas and workflow shape

### 3.1 Where the visual target comes from

`SEED-199` — the **xyOps canvas grammar** (`github.com/pixlcore/xyops`, BSD-3-Clause), registered
from the operator's own direction: *"the visual representation of this workflow is exactly how I
imagined it… this is exactly what I am concerned about especially with the connectors."*

⚠ **Useful finding:** xyOps' canvas is hand-built jQuery + SVG with **no flow library at all**. So
**the look is not tied to their stack** — it is reachable in `@xyflow/react`, which we already ship.
Nothing here requires a rewrite.

### 3.2 The grammar, in one line

> **TWO node classes, not one.** Big **cards** for work steps, with config visible on the face.
> Small **glyphs** — icon plus label — for **triggers, constraints and connectors**.

We register exactly **one** entry in `nodeTypes`. That is why our canvas reads flat, and why every
concern that is not a work step has had to become a **dialog**.

| xyOps idea | Where it lands here |
|---|---|
| **Triggers are nodes** (`Schedule Jul 9`, `On-Demand Manual Run`) | Phase 204 shipped scheduling as a **modal**. A disabled schedule stays visible on their canvas; a modal hides it entirely |
| **Constraints are attachable nodes** (`Max Run Time`, `Max Memory`), joined by **dotted** edges | SCHED-02's spend caps, which we shipped as two dialog fields — and theirs attach to a **specific step**, not just the run |
| **Connectors are glyph nodes** hanging off edge outcomes | ⭐ the operator's stated concern, and the shape the connector work should target |
| **Config on the card face** | ours needs `PhaseFormPanel` opened for anything past name + subtitle + ≤2 badges |
| **The EDGE carries the branch semantic** (`On Success` / `On Error` / `On Critical`) | ⚠ **NOT** the same axis as `connectionState.ts`, which is connection HEALTH. Do not conflate |
| **Solid vs dotted = flow vs constraint attachment** | we have one edge meaning |
| **Test a SINGLE node** from a selection toolbar | we can only run a whole workflow |

### 3.3 ⚠ THE CONSTRAINT THAT BINDS ALL OF IT

**The v3.6 D-14 red line: 7 harness executors at open, 7 at close — the canvas never became a second
runtime.** New node classes must add **zero** executors. A trigger glyph and a constraint glyph are
*renderings of existing configuration*, never new things that run.

### 3.4 Phase 209 is the first step of this, and it is scoped already

*A step says what it actually does* — three frontend items, all measured at HEAD:

1. The node face reads the connection's **service** and the step's **`tool_name`**. Today a grep for
   `tool_name` across `nodeVocabulary.ts` + `canvasModel.ts` returns **ZERO** — the face
   *structurally cannot* name the tool it runs.
2. A **read-only** tool stops claiming it changes something outside. `nodeEffectBanner.ts:40` keys on
   the phase TYPE, not the resolved capability.
3. The Connections filter stops being three verbs. An MCP row has **no capability**, so it matches
   none of `send_email` / `create_ticket` / `post_message` and **disappears when any chip is clicked**.

⚠ **Two of the three were flagged in advance** by plan `206.2-03`: *"Without this flag the first UAT
round reports them as bugs."* This phase is that re-open, not a new defect.

⚠ **Three forbidden fixes, written down because each is the tempting one:**
- **Do NOT add a fourth `MCP` chip** — same mistake one row down, breaks again at the fifth kind.
- **Do NOT make the effect banner vaguer** to accommodate read tools. `CHANGES SOMETHING OUTSIDE` is
  Phase 185 governance vocabulary; losing it on a step that really does change something outside is a
  regression wearing a copy improvement's clothes. **It must get more ACCURATE, never softer.**
- **Do NOT hand-draw a service mark.** `connectionMark.tsx` and `fileTypeMark.tsx` are the one shared
  seam; the icon convention forbids approximating a trademark.

Reference designs are in `screenshots/` — Claude.ai Connectors, the Claude.ai Plugins directory, and
the xyOps workflow editor. **They are the acceptance bar; read them before planning.**

---

## PART 4 — what is still owed, in priority order

| # | Owed | Where it is recorded |
|---|---|---|
| 1 | **Phase 209** — the last v3.8 phase | ROADMAP row 209 + `PHASE-209-PROPOSAL-*.md` |
| 2 | **A live smoke of the app after the 207 `api.ts` split** | `207-VERIFICATION.md` → Owed |
| 3 | **Independent verification of 207 and 208** | both VERIFICATION files |
| 4 | **Cloud verification of two bugs closed on LOCAL-only evidence** — a `.docx` + `.pdf` upload, and the OpenRouter model that 404'd (**its id was never captured**) | `HANDOFF-260825.md` |
| 5 | **`SEED-203`** — the judge passed a golden run whose deliverable refuses the work, at score 100 | `SEED-203-*.md` |
| 6 | **Scope the Connections & Open Platform milestone** against `SEED-202` | `CONNECTIONS-MILESTONE-CANDIDATE.md` |

### The product decision nobody has made yet

⚠ **It is a PRODUCT question, not a research one, and the research is finished:**

> **How does a person pick a service and an action without knowing what MCP is?**

Everything shipped so far assumes the user knows what an MCP server is and can paste its URL. The
catalog, the describe-to-build flow and the connector-as-glyph-node all wait behind that answer.
