# Phase 238 — Verification

**Date:** 2026-09-07 · **Verified by:** Claude — ⛔ **who also BUILT this phase.**

> ⚠ **READ THIS FIRST.** AGENTS.md §6.3: *whoever REVIEWS a phase must not have shaped the
> build.* I shaped all of it. **This document is a self-verification and every verdict in it
> should be read at that discount.** An independent review is posted `--to operator` as owed.
> Nothing below is recorded as "verified" where it was only "claimed".

---

## Success criteria

### SC#1 — a person connects a Microsoft account, browses OneDrive, picks a folder, previews it in the same four buckets

**Structural: PASS. Behavioural: ⛔ OWED — not driven.**

| Half | Evidence | Verdict |
|---|---|---|
| The connect path | Already shipped before this phase: `servicesCatalog.ts`'s **Microsoft 365** entry (`shape: "oauth"`, `oauthProvider: "microsoft"`), `OAuthProvider` includes `"microsoft"`, `oauth_service.py:104-116` carries the `/common` provider block with `Files.Read.All`. **Nothing in this phase touched OAuth.** | ✅ read at file:line |
| Browse | `MicrosoftGraphSourceAdapter.browse` — driven over a fake egress in 4 cases including virtual root, folder-facet filtering, and `@odata.nextLink` re-issue | ✅ unit |
| The connection is OFFERED at all | `GET /connectors/source-families` publishes `microsoft`; `isSourceCapable` admits it. 5 route cases + 6 predicate cases | ✅ unit |
| Preview in four buckets | `preview_service` is provider-agnostic and consumes `FilePage`/`SourceFile` only; the Graph adapter passes the same conformance suite Drive does | ✅ by construction |
| **A real Microsoft account, browsed in a browser** | — | ⛔ **OWED (see Blocked rows)** |

⛔ **The SharePoint document-library half of this row is DEFERRED to `SEED-256`** — *no
work/school tenant; a personal Microsoft account has no `/sites/` to address.* Recorded blocked,
with its blocking id. Never passed, never omitted.

### SC#2 — files are read and appear in the Library on the schedule, including files large enough to need the two-step download

**Structural: PASS. Behavioural: ⛔ OWED.**

- The two-step is driven at unit level and is the phase's most-asserted behaviour: exactly two
  calls, `["graph_read", "graph_download"]` in that order, the `$select` carrying
  `@microsoft.graph.downloadUrl`, **no `Authorization` header on the download**, and a
  `/content` fence asserting the redirect path is never taken.
- ⚠ **"Large enough to need the two-step" is a misreading the code makes impossible and this
  row should say so:** on Graph the two-step is not a large-file path, it is **the only
  download path**. Every file, at any size, goes through it, because `/content` answers a
  redirect for all of them. The 25 MB `max_bytes` ceiling is unchanged from `google_drive.py`.
- ⛔ Bytes actually landing in the Library from a real OneDrive: **OWED**.

### SC#3 — everything Phase 234 promised behaves identically for a Graph source

**PASS by construction, and the construction is the point.**

`watch_service` resolves its adapter through `SourceRegistry.get_adapter(conn)` and then never
asks what family it got. Deletion-does-not-delete, disconnect-freezes, connection-scoped
visibility and `SourceListing.complete`'s fail-closed rule are all implemented above the
adapter, so a Graph source inherits them by being an adapter.

⭐ **And this phase made that MORE true rather than less:** `watch_service`'s
`get_adapter("google")` fallback is gone, so a Graph connection can no longer be silently read
by the Drive adapter — which was the one way "a person cannot tell which family they are
watching" could have been true for the wrong reason.

⛔ **Still true, carried from Phase 235 item #1: NO STOPPED SOURCE HAS EVER BEEN OBSERVED IN
THIS PRODUCT.** Every claim about a broken source, for any family, is unit-level. This phase
does not change that and does not pretend to.

### SC#4 — if the phase was not small, that is a finding

**PASS — and it produced a finding, which is the outcome this criterion actually wants.**

Full derivation in `238-SUMMARY.md`. In one table:

| | |
|---|---|
| `base.py` lines changed for the adapter | **0** |
| Adapter size | **352 L** vs Drive's **399 L** |
| New contract parameters | **0** |
| Conformance invariants changed | **0** |
| Migrations | **0** |
| **Provider leaks already above `adapters/`** | **4** — and the fence meant to catch them exempted the one that existed |

**The finding, in the form SC#4 asks for:** the contract expressed the *adapter* and did not
express *resolution*. `SourceAdapter` is clean; `SourceRegistry` was an exact lookup with a
provider-shaped escape hatch at every miss, and three call sites had each invented their own.
**What the contract could not say is "there is no adapter for this connection."** All four
leaks are a caller answering that question with a guess.

⭐ The fourth leak was found **by the rewritten fence, on its first run, unprompted**:
`import_service.fetch_cloud_file` fell back to the Drive adapter on the connection's **display
name**, so a Microsoft connection named *"Google migration"* would have been read by the Drive
adapter under a Microsoft token.

---

## Gates

| Gate | Result |
|---|---|
| Backend `pytest tests/unit -q --continue-on-collection-errors` | **71 failed, 4010 passed, 2 xfailed, 2 xpassed, 0 collection errors** — at the CLAUDE.md ceiling. Diffed against the baseline's **full 71-name set** with `comm -13`: **zero new names**. `+39` newly passing. |
| `tests/unit/services/sources` | **118 passed** (94 before the phase) |
| `tests/unit/test_190_egress.py` | **77 passed**, including the extra-key wiring assertion |
| `tsc -p tsconfig.app.json --noEmit` | **66** — exactly the 232 baseline |
| vitest count gate | **`count gate OK — 242/242 pinned files present, no per-file decrease, 0 failing`** · `total 7822 · failed 0 · pinned total 7026`. Baseline before the phase: `241/241 · 7816 · 7020`. **+6 = exactly `sourceCapability.test.ts`.** Verdict line read verbatim, from the repo root, `GSD_VITEST_MAX_WORKERS=2` |
| `check-hot-file-ledger.cjs 238` | **ledger gate OK** — 229 rows, every watched file has a row |
| `check-claude-md-size.cjs` | **OK** — 81,332 chars, 54.2% of limit |

⚠ **Baselines were captured BEFORE the first edit**, on a quiet tree, and the backend one was
captured as a **NAME SET** rather than a count — the standing lesson that a count hides a swap.

⚠ **`sourceComposition.test.tsx` is red at `16 failed | 33 passed`, INHERITED from Phase 235**
and in neither gate knob by decision. Red before this phase, red after; nothing in it asserts
anything 238 touched.

---

## UAT — the G-4 table. Every row present; blocked rows carry their reason and blocking id.

| # | Row | Status |
|---|---|---|
| M-1 | Connect a Microsoft 365 account through Settings → the OAuth round trip completes and the connection lists as `active` | ⛔ **OWED — operator prerequisite.** Needs `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET` from an Azure app registration (`/common` authority, redirect URI matching `oauth_service`'s exactly). I cannot create one. |
| M-2 | The Microsoft connection **appears** in Library → Add files → connected sources, and in Create Watch | ⛔ OWED (depends on M-1). Unit-covered by the families route + predicate suites. |
| M-3 | Browse OneDrive, drill into a subfolder, page past 200 items | ⛔ OWED (depends on M-1). The `@odata.nextLink` re-issue is unit-driven. |
| M-4 | Preview a OneDrive folder → the same four buckets a Drive folder shows | ⛔ OWED (depends on M-1). |
| M-5 | Confirm the preview → files land in the Library with real content (the two-step download, end to end) | ⛔ OWED (depends on M-1). **The highest-value row: it is the only one that proves the 302 dance against the live CDN host rather than a fake.** |
| M-6 | A watch on a OneDrive folder runs on schedule and brings in a file added after the watch was created | ⛔ OWED (depends on M-1). |
| M-7 | Delete a file at the source → the Library document is **not** deleted; the run says what it saw | ⛔ OWED (depends on M-1) — and see the standing Phase 235 gap: no stopped source has ever been observed in this product, for any family. |
| M-8 | Disconnect the Microsoft connection → watching freezes, nothing is deleted | ⛔ OWED (depends on M-1). |
| M-9 | A watch rule on `path contains '/Finance/'` fires for a OneDrive file that IS in Finance | ⛔ OWED (depends on M-1). ⭐ This is SEED-253's closure row and the only place the real `parentReference.path` is proven end to end. |
| **S-1** | **Browse a SharePoint document library and preview it** | ⛔ **BLOCKED — `SEED-256`.** *No Microsoft 365 work/school tenant; a personal Microsoft account has no `/sites/` to address.* No scope unlocks it. Deferred by operator decision 2026-09-07. |
| **S-2** | **`Sites.Read.All` self-consents in an enterprise tenant, or needs admin approval** | ⛔ **BLOCKED — `SEED-256`.** Unresolved and un-softened; it is the first thing to drive when that seed's trigger fires, before promising the capability to anyone. |

**9 rows owed on one prerequisite, 2 blocked on an account boundary. 0 rows claimed.**

⭐ **M-1 unblocks nine of the eleven.** It is the one thing to do first when the operator
returns, and it is ~10 minutes of Azure portal work plus two env vars.

---

## Cross-checks

- **Reported bugs** (`status: open`, `surface: Agentic-RAG`): `BUG-260905-01`
  (*cloud import lives in chat and dumps into Library root*) overlaps on `connectors` /
  `ingestion` — **reviewed, NOT folded.** Its fix is *moving* the chat picker surface, not
  *widening* it; widening a surface that is being retired is work with a negative half-life.
  Left `open`. No other open report's `affected_areas` touches this phase's blast radius.
- **Seeds**: `SEED-253` folded and **narrowed, not closed** (Drive still has no path).
  `SEED-256` untouched and still `planted` — this phase is the reason it exists.
- **G-5 hot-file ledger**: 5 rows added (`sources/base.py`, `microsoft_graph.py`,
  `mock_source.py`, `sources/__init__.py`, `sourceCapability.ts`), 2 stale rows re-derived
  (`import_service.py` `2/2/172` → `3/3/277`; `preview_service.py` `1/1/549` → `5/3/772`).
  ⚠ Four of the five added rows were absent **for the file's entire life**.
- **G-8 plan-count**: 3 plans, inside the 3-5 target.
- **G-7 gap-closure rounds**: 0.
