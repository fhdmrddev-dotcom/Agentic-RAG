---
phase: 239-any-mcp-server-with-files
plan: "05"
kind: gap-closure
gap_closure_round: 1
scope: frontend
subsystem: connections · sources · settings
base: dc021defc
head: 17769bd88
review: 239-REVIEW.md (uncommitted in the main working tree — see "A note on the review file")
findings_owned: [HI-01, HI-02, "CR-01 (UI half)", LO-01]
findings_fixed: [HI-01, HI-02, "CR-01 (UI half)", LO-01]
findings_disputed: ["HI-02 compounding sub-claim (picker hidden) — REFUTED"]
findings_not_fixed: ["HI-04 UI half (root_path control) — G-7, not fixed, owed"]
backend_owed: [CR-01 boundary half, CR-02, ME-01, ME-04, "HI-04 empty-root refusal"]
tags: [source-capability, mcp, over-claiming, config-wipe, destructive-tool, tdd-red]
---

# Phase 239 Plan 05: Frontend gap-closure round 1 — Summary

Source capability is now **proven from evidence** rather than inherited from a default
`service_id`; an MCP-over-OAuth save keeps its `source_tools` binding instead of deleting it; and
the "File content tool" dropdown no longer offers `delete_file`.

**Base:** `dc021defc` · **Head:** `17769bd88` · **8 commits** · **6 frontend files + 2 docs, zero
backend files.**

⚠ **The worktree landed on `1335b4b1a` (the old master merge) for the FOURTH time running**, exactly
as the brief predicted. `git reset --hard dc021defc` was run at agent startup, before any other
command, and `bootstrap-worktree.sh` was re-run after the reset. Every measurement below is from
`dc021defc`.

---

## A note on the review file

`.planning/phases/239-any-mcp-server-with-files/239-REVIEW.md` **is not committed on any branch** —
`git log --all --diff-filter=A -- "*239-REVIEW.md"` returns nothing. It exists only as an untracked
file in the main working tree, and was read from there, read-only. **A 676-line authority that is
not in git is one `git clean` away from not existing**; it should be committed.

---

## Per finding

### HI-01 — `✓ Ready as source` on every `custom_mcp` row — ✅ FIXED

**The mechanism, confirmed by driving rather than inherited from the review.** Against the shipped
registry in the project venv:

```
{service_id: "custom_mcp", auth_type: "static_key", config: {}}
  _protocol_of  -> None
  get_adapter   -> <McpSourceAdapter object at 0x…>
  families      -> ['custom_mcp', 'google', 'google_workspace', 'mcp', 'microsoft',
                    'microsoft_graph', 'mock_source']
```

`custom_mcp` is **both** the `service_id` every by-URL MCP connection is created with and a family
the server publishes, so `families.includes(id)` matched before any evidence door was reached.

**RED evidence** (`test(239-05): RED — custom_mcp claims "Ready as source"…`, `d8b58693b`):

```
FAIL src/components/sources/__tests__/sourceCapability.test.ts
  ⛔ HI-01 — a `custom_mcp` row with NO evidence is NOT a source…
  AssertionError: expected true to be false

FAIL src/components/settings/__tests__/ConnectionsTab.test.tsx
  ⛔ HI-01 — a never-contacted `custom_mcp` row does NOT print `✓ Ready as source`
  AssertionError: expected '✓ Ready as source' to be '◌ Not checked'
    Expected: "◌ Not checked"
    Received: "✓ Ready as source"
```

The second is the **rendered word**, not a block presence — Phase 235's rule applied to the surface
that reported the bug.

**The fix consults evidence.** `PROTOCOL_SERVICE_IDS` (`{mcp, custom_mcp}`) marks service ids that
name a **transport** rather than a vendor; those are excluded from the exact-id arm and must reach
the verdict through `protocolOf` (declared `auth_type: "mcp"`, or a non-empty `config.source_tools`).
A `custom_mcp` row **with** evidence is still a source — pinned, because refusing the name outright
would silence every real MCP file source the product ships.

**The test's premise was fixed too, and the fix caught its own first attempt.** The old negative case
used `service_id: "mcp.acme.internal"`, a value the product never writes. The fixture is now derived
from the catalog and cross-pinned against `McpAuthDoor`'s create-path literal. ⚠ **The first
derivation keyed on `shape: "mcp"` and resolved to `github`** — seven of the eight popular catalog
entries carry that shape, because it names the FORM, not the door. The premise case failed and said
so; without it the whole HI-01 block would have passed vacuously against a `github` fixture.

**Structural fence, driven:** dropping `custom_mcp` from `PROTOCOL_SERVICE_IDS` in the shipped file
fired the sync fence with `expected [ 'mcp' ] to include 'custom_mcp'`. Restored **md5-identical**
(`b7e791c252987e4af8d95670a2fcc98b`).

### LO-01 — a comment asserting a false invariant — ✅ FIXED (same commit as HI-01)

The comment said the server *"resolves no adapter for them"*. Driven above: `_protocol_of` returns
`None` (true) but `get_adapter` returns `McpSourceAdapter` through the **exact-key** arm (so the
conclusion was false). The comment now states that this client is deliberately **stricter** than
that arm, and why.

### HI-02 — an MCP-over-OAuth save deletes `source_tools` — ✅ FIXED

**RED evidence** (`d20b11bd0`):

```
FAIL ⭐ HI-02 THE OAUTH WIPE — an MCP-over-OAuth binding survives a plain rename
  AssertionError: expected undefined to deeply equal { list_tool: 'ls', …(2) }
FAIL ⭐ HI-02 — and a binding CHOSEN in the picker on an OAuth row is actually saved
  AssertionError: expected undefined to deeply equal { list_tool: 'list_directory', …(1) }
FAIL ⛔ …and an oauth arm that IS bound keeps its client id alongside the binding
  AssertionError: expected { custom_client_id: 'abc.apps' } to deeply equal
    { custom_client_id: 'abc.apps', …(1) }
```

Every prior case in that suite used `auth_type: "mcp"`. That is why a whole wave shipped over it.

**The fix** adds `source_tools` to `configFromDraft`'s oauth arm, **conditionally**:
`OAuthConnectionConfig` is `extra="forbid"` and declares no such key, so an unconditional one would
422 every first-party OAuth connection in the org. A bound row composes `{custom_client_id?,
source_tools}` — a key set `McpConfig` accepts, and `mcp` is not in `CONFIG_MODEL_FOR_CAPABILITY`,
so `_reject_config_capability_mismatch` is a no-op for it. Both checked against the shipped models.

#### ⚠ DISPUTED — HI-02's "compounding" sub-claim is REFUTED

The review states the picker *"renders only under `capability === "mcp"` … so for these same rows the
binding is invisible and unrecoverable in the UI."* **Measured false.** `ConnectionFormPanel`'s local
`capability` is derived from `connection.mcp_server_url`, **not** from `draft.capability`
(`ConnectionFormPanel.tsx:1132-1137`), so the card renders for these rows and is selectable. Only the
**save** path reads `draft.capability`.

**That makes it worse, not better.** A person could open the panel, pick `read_file`, press Save, and
the selection was discarded — the one repair available in the UI silently did nothing. Pinned as its
own case: *"⚠ the picker DOES render on an MCP-over-OAuth row — the panel reads the ROW, not the
draft."*

### CR-01 (UI half) — `delete_file` offered as the file reader — ✅ FIXED

**RED evidence** (`230b985e3`):

```
FAIL ⛔ CR-01 — a destructive tool is NEVER offered under `File content tool`
  AssertionError: expected [ 'list_directory', 'read_file', …(3) ]
                  to deeply equal [ 'list_directory', 'read_file' ]
```

`delete_file`, `write_file` and `move_file` were all selectable as the FILE READER.

**Three things in the fix are not obvious from the finding:**

1. **The stored value is ALWAYS offered, even when it would be withheld.** A `<select>` whose value
   is absent from its options renders unselected — so a filter alone would silently re-point a
   stored binding on OPEN. That is HI-02's wipe class, re-introduced by its neighbour's remedy.
2. **Whole tokens, not substrings — a deliberate divergence from the server.** Planted, the server's
   `_looks_like_a_mutation` rule (`word in name`) makes the picker return `expected []` — it empties
   entirely, because `set` ⊂ `assets` and `put` ⊂ `input` (review ME-04). On the boundary an
   over-catch merely refuses a write; here it removes the only readers a server has. **The word SET
   is shared and fenced against the Python via `?raw`; the matching RULE is the safer one per side.**
3. **The withholding is stated on screen**, with a count. An unexplained absence reads as a discovery
   bug, and the repair a person then reaches for is a hand-crafted PATCH — the one door with no
   picker in front of it.

⛔ **It is a deny-list and the code says so.** `purge`, `drop`, `clear`, `destroy`, `trash`, `exec`
and `rm` are absent from the shared word set, so **`execute_command` is still offered today.** This
narrows a real, reachable mis-click; it does not make the surface safe against a hostile server.
That is CR-02, and it is the backend's.

**Structural fences, both driven in shipped files:**

| Plant | Verdict it produced | Restore |
|---|---|---|
| substring matching in `looksLikeSourceToolMutation` | `expected [] to deeply equal [ 'list_assets', … ]` | md5 `09e3f070…` |
| `"delete"` removed from the shared word set | `expected [ 'append', 'copy', 'create', …(14) ] to deeply equal [ …(15) ]` + `delete_file` reappears in the options + the note reads `3 tools` | md5 `09e3f070…` |

`ConnectionFormPanel.tsx` restored `34eb916ff3abeb70b73986f1898f287b`; `connectionFormCopy.ts`
restored `09e3f070fa397da2605088090daca0fc`.

### Extra — the two Library consumers have NO test suite at all

Measured at this round: **neither `CreateWatchModal.tsx` nor `ConnectedSourceSection.tsx` has a test
file.** HI-01 put a never-contacted MCP server into the Library's watch picker and **nothing on that
surface could have caught it.** A source fence now pins that both route through `isSourceCapable`
and carry no `includes("google")` string guess — planted (`rows.filter(c =>
c.service_id.includes("google"))` in `CreateWatchModal`), fired
(`expected '/**\r\n * Phase 234 (LIB-08 / SURF-01…' to contain 'isSourceCapable(c, families)'`),
restored md5 `6c2a61d88be792915a655b6c9150e97b`.

⚠ **A source fence is weaker than a render and the test says so inline**: it cannot see whether the
filtered list reaches the screen. **The render harness is OWED** (below).

---

## Findings NOT fixed — stated explicitly, because silence reads as fixed

### HI-04 (UI half) — the `root_path` control — ⛔ NOT FIXED, deliberately

The review asks for *"a plain text input bound to `draft.sourceRootPath`"* on the File source mapping
card. It was not built, and the reason is a project guardrail rather than time:

> **G-7:** *"A closure round may NEVER introduce a new user-facing capability: that is a phase, not a
> gap."*

A root-path input is a new control on a surface with no prior review cycle — precisely the shape that
shipped a blocker inside Phase 187's round 5. It is also outside the scope this agent was given.
**The consequence stands unchanged: `root_path` can still only be set by a hand-crafted PATCH, and
the virtual root still resolves to `path: ""`.** `sourceToolsFromDraft` already carries the field, so
the control is a small addition whenever it is scheduled.

### Everything else in the review — backend, not touched

`CR-02`, `HI-03`, `HI-04` (server half), `ME-01`–`ME-07`, `LO-02`–`LO-06` are all backend files. A
backend agent was running concurrently on the same report. **Zero files under `backend/` were
modified by this round** (`git diff --numstat dc021defc HEAD` confirms).

---

## Owed to the backend — found here, not reached across for

1. **CR-01's boundary half.** `reject_unoffered_source_tools` still accepts
   `{"read_tool": "delete_file"}` when the server offered it. The UI no longer proposes it; the
   boundary is what makes it unstorable. **Both halves are wanted** — a UI-only fix is defeated by
   one PATCH.
2. **`@SourceRegistry.register("custom_mcp")` is the root of HI-01 and is still there.** The
   frontend is now deliberately stricter than the server: `get_adapter` resolves an adapter for a
   never-contacted `custom_mcp` row, and the client refuses to call it a source. The alternative fix
   the review offers — dropping that registration — would align the two. Whichever is chosen, **the
   frontend sync fence will fail loudly if the adapter's registration set changes**, which is the
   point.
3. **`connectionFormCopy.ts`'s remaining wipes, pre-existing and NOT fixed here:** the `oauth` arm
   also drops `headers`, and the `mcp` arm drops `custom_client_id` (Phase 222's defect one field
   over). Both are three lines from what this round edited. Not fixed because neither is in the
   review's frontend findings and both need the model's key sets checked per capability.
4. **A render harness for `CreateWatchModal` / `ConnectedSourceSection`.** Frontend work, but
   phase-sized rather than closure-sized (G-7).

---

## Gates — verbatim verdict lines

### `tsc --noEmit` — set diff, both directions

```
base  66 errors   ·   after 66 errors
REMOVED (in base, not after):  5   ← all ConnectionFormPanel.tsx
ADDED   (in after, not base):  5   ← all ConnectionFormPanel.tsx
```

⚠ **All ten are the SAME five errors, shifted +2 lines** by the import block this round added
(`981→983`, `1030→1032`, `1031→1033`, `1061→1063`, `1157→1159`; identical TS codes throughout).
Normalising the line number and re-diffing:

```
REMOVED: (empty)
ADDED:   (empty)
```

**Net real change: zero added, zero removed.** "tsc is clean" is unsatisfiable here — 66 errors are
pre-existing at base, across 30 files.

### `vitest run src/components/settings src/components/sources`

```
 Test Files  1 failed | 30 passed (31)
      Tests  17 failed | 784 passed (801)
```

**The single failing file is `src/components/sources/sourceComposition.test.tsx`**, and it is
**provably unmodified since `dc021defc`** (`git diff --numstat dc021defc HEAD -- <file>` is empty).
It is the standing Phase 235 red CLAUDE.md names verbatim — *"sits at 16 failed | 33 passed in
NEITHER knob, by a Phase 235 decision"*. Its count varies run to run (16/17/19/21 observed), which is
itself why it is unpinnable.

**Every suite in `src/components/settings` is green**, including all three this round edited.

⚠ **The baseline run of this same command, taken before any edit, was worse:** `26 failed`, of which
5 were `Test timed out in 5000ms` in four settings suites (`sourceTools`, `refreshReceipt`,
`ConnectionFormPanel`, `ConnectionsTab`). A backend agent was running `pytest` concurrently; that
run took **185 s** against **35 s** once the box was quiet. The failing set **rotated between runs on
byte-identical files** — including two `sourceComposition` cases going green with no cause of mine —
which is the load-flake signature, not a defect.

One of my own cases (`⛔ a binding ALREADY stored on a mutating tool stays VISIBLE`) failed once in
the loaded run with `Error: STACK_TRACE_ERROR` — the timeout signature. Captured from the gate's own
persisted JSON **before** re-running anything, then re-run alone **four consecutive times: 25/25
passed each time.** ⚠ CLAUDE.md's correction is respected: `STACK_TRACE_ERROR` is not a reliable
tell on its own, so the attribution rests on the rotation and the four clean repeats, not the
signature.

### `scripts/vitest-count-gate.cjs` — run twice, both captured

```
run 1:  total 7889  ·  failed 1  ·  pinned total 7131
        RESULT: COUNT GATE VIOLATED (1 reason(s))
          FAIL [failing-tests] 1 test(s) failed — the gate requires 0.

run 2:  total 7889  ·  failed 0  ·  pinned total 7131
        count gate OK — 244/244 pinned files present, no per-file decrease, 0 failing.
```

**Run 1's single failure, identified from the gate's own persisted JSON before any re-run:**
`src/pages/WorkflowBuilderPage.canvas.test.tsx` — *"clicking Canvas flips aria-selected and mounts
the canvas"*, `Error: STACK_TRACE_ERROR`. That is **SEED-171's fifth named flaky suite**, and it is
**provably unmodified since base**. The worker cap was **not** touched — it is measured not to fix
these.

⚠ **`total 7889 / pinned 7131 / 244 pinned files` supersedes CLAUDE.md's 2026-09-07 figures
(`7816 / 7020 / 241`)** — the seventh re-derivation. `+758` over the pinned baseline, of which the
gate attributes 47 to five newly-adopted suites it names (`RunHero`, `automationFacts`,
`nodeEffectBanner`, `toolReadOnlyMap`, `PromptVariableChips`) that are **not** this round's. **No
per-file decrease was reported in either run.** A growing number is the gate working.

### `check-hot-file-ledger.cjs 239`

```
  scan list: 231 rows · subject: 0 files · watched: 0
ledger gate OK — every watched file has a row.
```

⚠ **`subject: 0 files` means this run was VACUOUS.** The gate reads `files_modified` out of PLAN.md
files, and a gap-closure round has no plan — so it watched nothing and could not have failed. Not a
green worth quoting. The rows were therefore updated by hand, and verified with the other gate:

```
  CLAUDE.md   85998 chars   57.3% of limit   headroom 64002   [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

⚠ **That gate FAILED first, on my own prose** — `[disposition-too-long] line 9162 203 chars (cap
200) frontend/src/components/sources/sourceCapability.ts` — and was fixed by trimming the cell. The
guard fired in the turn the prose was authored, which is what it was built for.

---

## Ledger — three triples re-derived, all three stale

| File | row said | re-derived |
|---|---|---|
| `frontend/src/components/sources/sourceCapability.ts` | `2 / 2 / 98` | **`3 / 2 / 138`** |
| `frontend/src/components/settings/connectionFormCopy.ts` | `15 / 8 / 1216` | **`17 / 8 / 1293`** |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | `24 / 10 / 2545` | **`25 / 10 / 2577`** |

⚠ **`sourceCapability.ts` has now been stale at every close it has appeared in** (`0/0/38` →
`2/2/98` → `3/2/138`), and `ConnectionFormPanel.tsx` at **three consecutive** closes. Re-derive;
never quote.

`docs/HOT-FILE-LEDGER.md` gains **§239-05**, kept **beside** §239-03 rather than overwriting it —
because §239-03 reasons carefully about which door `sourceCapability.ts` must NOT open
(`mcp_server_url`) and never asks what the door **above** it already lets through. That is the
finding, and deleting the original would delete it. Both `CLAUDE.md`'s FIRING shortlist and the
detail file were updated in the same commit.

---

## Commits

| Hash | Message |
|---|---|
| `d8b58693b` | `test(239-05): RED — custom_mcp claims "Ready as source" with no evidence (HI-01)` |
| `5f76b8e0a` | `fix(239-05): source capability is PROVEN, never inherited from a service id (HI-01, LO-01)` |
| `d20b11bd0` | `test(239-05): RED — saving an MCP-over-OAuth row deletes its source_tools (HI-02)` |
| `ef8c3cf87` | `fix(239-05): the oauth arm carries source_tools, so an MCP-over-OAuth save keeps it (HI-02)` |
| `230b985e3` | `test(239-05): RED — the picker offers delete_file under "File content tool" (CR-01, UI half)` |
| `089fb048b` | `fix(239-05): the picker no longer offers a destructive tool as a file READER (CR-01, UI half)` |
| `b12e6086d` | `test(239-05): fence the two Library consumers HI-01 put a dead control into` |
| `17769bd88` | `docs(239-05): ledger rows and §239-05 — three triples re-derived, all three stale` |

Files changed: `sourceCapability.ts`, `sourceCapability.test.ts`, `connectionFormCopy.ts`,
`ConnectionFormPanel.tsx`, `ConnectionFormPanel.sourceTools.test.tsx`, `ConnectionsTab.test.tsx`,
`docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`. **Nothing under `backend/`. Nothing pushed.**

---

## What the operator can now check by hand

The UAT parked on HI-01 should reproduce as follows:

1. Settings → Connections → *Custom MCP Server* → paste a **Linear / Sentry / Jira** MCP URL, save,
   do **not** press *Refresh actions*. The row should read **`◌ Not checked`**, never
   `✓ Ready as source`, and must **not** appear in Library → watch a folder.
2. Press *Refresh actions* on a real MCP **file** server so a binding is detected. The row flips to
   `✓ Ready as source` and appears in the picker.
3. On that same connection, **rename it and Save**. Re-open: the File source mapping must still show
   the bound tools. (Do this on an **OAuth**-connected MCP server too — that is the arm HI-02 fixed.)
4. On a filesystem-ish server, open File source mapping and read the **File content tool** dropdown:
   `delete_file` / `write_file` must be absent, and a line must say how many tools were withheld.

⚠ `SEED-257` records that MCP sources could not be driven locally at all, so steps 2-4 need a real
reachable MCP file server. Step 1 needs no server contact and is the one that closes HI-01.

---

## Self-Check: PASSED

- All 8 commit hashes quoted above resolve in `git log --all` (8/8).
- All files named as created/modified exist on disk.
- `git diff --numstat dc021defc HEAD` names 8 files, **none under `backend/`**.
