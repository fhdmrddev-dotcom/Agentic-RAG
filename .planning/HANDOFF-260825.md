# Session handoff — 2026-08-25

**Everything below is committed and PUSHED** (`develop` @ `ed4046cf`, level with origin).
⚠ `STATE.md` was rewritten mid-session by an executor and lost its `stopped_at` detail — **this file
is the accurate record**, and STATE.md's *"Phase 206.3 COMPLETE"* is the one line to distrust
(206.3 was EXECUTED; it has no independent verification pass).

## What shipped

| Phase | Result |
|---|---|
| **206.1** | 3 plans. 4/5 SC met. Marks, dense row, MCP create door + edit fix |
| **206.2** | 4 plans. **6/6 SC met, verified independently.** The MCP round trip works end to end — bind → discover → grant → run, driven in a browser |
| **206.3** | Gemini planned + executed; I wrote the pre-flight (4 gaps, 5 recs — all closed). **⚠ NOT independently verified — that is owed** |
| **3 bugs** | Ingestion MIME + NUL, HTML markup, OpenRouter 404. Post-check accepted all three |

Gates at close: backend `68 failed / 2678 passed` (baseline held) · `tsc -p tsconfig.app.json` **34**
· count gate `OK — 114/114, failed 0, total 5755` · `api.ts` untouched all session (Phase 207 owns it).

## ⚠ What is OWED

1. **Cloud verification of the two reported bugs.** Both are marked `closed` on LOCAL-only evidence
   and each says so in its own frontmatter. **A `closed` bug is invisible to every future scan** —
   fold these into the next production deploy's parity walk:
   - upload a `.docx` and a `.pdf` on cloud
   - re-run the OpenRouter model that 404'd, **capturing the model id this time** (it was never captured)
2. **An independent verification pass on 206.3.**
3. **CLAUDE.md is 133,006 chars** against a 150,000 HARD limit. Split escalated as ROADMAP row 208.
4. **`0289e873`** added `@iconify-json/vscode-icons` without the legitimacy gate — retro-check owed.

## Registered but unplanned

- **207** `api.ts` split · **208** CLAUDE.md split · **209** *A step says what it actually does*
  (registered today from live UAT — node face names the real action, effect banner stops lying about
  read-only tools, connections filter stops being three verbs)

## The connections work — where the thinking got to

- `SEED-202` — the operator's vision, **verbatim**. ⚠ Two of my supporting claims were **REFUTED**
  and corrected beside the originals: `external_action` is **not** write-only
  (`phase_types.py:2542` already returns MCP tool text into `accumulated_outputs`, so the
  read-and-blend step is **executable at HEAD**), and the approval gate **defaulted correctly**
  (MCP specifies `destructiveHint: true`).
- `.planning/research/connections-competitor-study.md` — the four owed questions answered.
- ⭐ **Driven live 2026-08-25:** `readOnlyHint` is **absent** on all three DeepWiki tools — including
  `read_wiki_structure`. **It cannot be the direction mechanism.** `outputSchema` **is** present on
  all three and `mcp_client.py:293-296` throws it away. Atlassian `401`, GitHub gated — **2 of 3
  servers unreachable without OAuth, measured.**
- **The open question is a PRODUCT decision, not research**: how a person picks a service and an
  action without knowing what MCP is.

## Local state

Infra up (`:8000` `:5173` `:54321`). The `DeepWiki (206.1 UAT)` connection is a deliberate fixture —
**do not delete it.** 14 `MCP Publish Drive` test workflows were cleaned out; 291 definitions / 241
runs survive. Working-tree noise (Supabase snippets, `backend/RUN-BACKEND.md`, `115_*_results.json`)
is all pre-existing from 2026-08-08, not this session.
